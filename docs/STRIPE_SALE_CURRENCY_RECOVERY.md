# Stripe sale wallet currency recovery

## Scope and deployment boundary

The sale document and its receipts remain in the customer's checkout currency.
The billing `account_balance` wallet is USD. Historical financial effects could
credit a non-USD gross/commission numerically into that wallet. Webhook retries
cannot fix completed effects: they intentionally skip the completed financial
step. Recovery is a separately approved operational action, not webhook replay.

Relevant sources:

- Original execution: `20260917210300_stripe_settlement_effect_execution.sql`.
- USD guard: `20261014220000_stripe_sale_wallet_usd_guard.sql`.
- Recovery RPC: `20261014220100_repair_stripe_sale_wallet_currency.sql`.
- Resolver: `app/api/stripe/webhook/sale-wallet-amount.ts`.
- Operator script: `scripts/repair-stripe-sale-wallet.cjs`.

Review and deploy forward-only migrations using the project's approved workflow
only after explicit target approval. There is no repository migration command.
Installing this RPC does **not** automatically change any balances. No remote
application, financial repair, journal rebuild or deployment is authorized by
running local tests. See [Database migrations](DATABASE_MIGRATIONS.md),
[Stripe webhook security](STRIPE_WEBHOOK_SECURITY.md) and [Accounting](ACCOUNTING.md).

## Preconditions

Obtain operator approval for exactly one site, session, Supabase project and
Stripe mode. Use trusted server credentials supplied explicitly to the process:

- `SUPABASE_URL`: `https://PROJECT_REF.supabase.co`, matching `--project` exactly.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service credential. Legacy JWT role
  and project claims are checked; Supabase remains the authentication authority.
- `STRIPE_SECRET_KEY`: a test/live secret or restricted server key matching
  `--mode`, with read access to Checkout Sessions, PaymentIntents, charges and
  balance transactions.

Do not put secrets in command arguments, output, documentation or source. The
script does not load `.env` or `.env.local`; an operator may explicitly use
Node's `--env-file` option with an approved private file. Check that file's
Stripe mode before use. A test key cannot retrieve a live payment. A
`resource_missing`, provider error or missing USD evidence must stop recovery;
it is not permission to guess a rate or use a different site's payment.

The script requires Node 22+, installed npm dependencies and `ts-node`. It
registers CommonJS/moduleResolution=node/transpileOnly to load the same resolver
as the webhook; that resolver has no runtime alias dependency.

## Preview first

Use operator-owned values, not identifiers copied from another incident:

```bash
node scripts/repair-stripe-sale-wallet.cjs \
  --site "$SITE_UUID" --session "$CHECKOUT_SESSION_ID" \
  --project "$SUPABASE_PROJECT_REF" --mode live
```

This performs provider/database reads and calls the RPC with `p_apply=false`.
The RPC takes serialization locks but performs **no persistent writes** in
preview. The script prints only scoped identifiers, proposed USD cents,
commission, wallet delta/before/after and commission expense ID, not complete
payment/provider payloads. Save sanitized preview evidence in the private
incident record and review it before adding apply flags.

The script re-fetches the Checkout Session and verifies paid/complete payment
mode and expected live/test mode. Session metadata sale/site/type/order,
PaymentIntent, checkout amount and currency must agree with the existing DB
effect, sale and original payment. Metadata is not used to choose a tenant.
The current succeeded PaymentIntent and captured charge must match; refunds
(including partial refunds) and disputes require separate review.

By default `resolveStripeSaleWalletAmount` provides USD gross from direct USD
checkout, legacy Stripe USD conversion evidence, or a matching charge's USD
balance transaction. It never treats balance-transaction **net** as gross,
fetches live FX quotes, divides a local amount by an arbitrary factor, or
relabels a local amount as USD. Native non-USD settlement without USD evidence
fails closed. The incident's authoritative USD amount must still be obtained
with the correct live credentials or independently verified historical proof.

## Explicit independently verified USD evidence

For native non-USD Stripe settlement, the automatic resolver may correctly have
no USD amount. A privileged operator may supply a documented, independently
verified **historical USD gross** from approved settlement/accounting evidence.
It must not be a guessed/current FX conversion, processing-fee net amount or
an unverified amount suggested by this guide.

All three flags are required together and are an explicit alternative, **not**
an automatic fallback after Stripe errors:

```bash
node scripts/repair-stripe-sale-wallet.cjs \
  --site "$SITE_UUID" --session "$CHECKOUT_SESSION_ID" \
  --project "$SUPABASE_PROJECT_REF" --mode live \
  --verified-usd-minor "$VERIFIED_HISTORICAL_USD_CENTS" \
  --evidence-reference "$APPROVED_PRIVATE_PROOF_REFERENCE" --ack-manual-usd
```

The reference is a short non-secret incident/statement identifier, not a secret
URL, credential, customer details or full provider payload. The script still
re-fetches and verifies the paid Stripe identity and unrefunded/undisputed
charge. No manual amount can bypass those checks. The RPC audits source
`verified_operator_usd`, acknowledgement and reference. Automatic evidence uses
source `resolveStripeSaleWalletAmount`.

SQL cannot fetch Stripe or independently prove either USD amount. The RPC is
service-role-only; its amount is trusted server/operator evidence. Keep the
service credential out of browser/API caller input. Do not expose this RPC as
a user-controlled repair endpoint.

## Apply and verify

After approval and reviewed preview, repeat the same scoped command with
`--apply`; live mode additionally requires `--confirm-live`. Test mode still
requires `--apply`. The script always performs a fresh preview before apply;
the RPC revalidates every row under locks. If unrelated spending changes the
balance meanwhile, the RPC uses the current locked balance, not a saved reset.

The RPC locks effect → sale → site advisory lock → billing → payments →
commission expense, sharing the settlement site's advisory key. It requires:

- A settled/completed effect with no compensation/refund, same-site fully paid
  sale with the same checkout and PaymentIntent, and no accounting refund.
- Exactly one billing row, one deterministic sale payment and one commission
  payment. Extra same-sale ledger rows, absent rows or mismatched identities
  require manual investigation.
- The expected old gross/commission/currency, original checkout evidence,
  `gross_amount` and consistent commission rates in both payment details.
  A manually relabeled USD row without the repair audit is refused, even if
  someone has also changed the displayed balance. Do not rerun recovery over
  an inconsistent manual correction.
- Exactly one same-site expense matching `Platform commission for order ORDER`
  or `Platform commission for sale SALE`, original commission amount/currency
  and expected expense classification. Missing, duplicate, changed or ambiguous
  expenses are refused; the script never creates guessed replacements.
- Sufficient wallet balance to apply the net differential without going negative.

Commission is recomputed using the **stored historical rate**, not today's
subscription plan. The adjustment is:

```text
new gross = verified USD minor integer / 100
new commission = round(new gross × stored rate, 2)
delta = (new gross − new commission) − (old gross − old commission)
account_balance = current account_balance + delta
```

This preserves all other wallet credits/debits and never resets the balance.
`credits_available`, purchased/monthly grants, payment IDs/dates, sale currency,
receipts, effect completion, orders, inventory and fulfillment are untouched.
Correct USD payments from other sessions remain untouched. The commission
expense amount/currency is corrected and its accounting state becomes
`pending`, except intentional `unpublished` remains unchanged.

Both payments receive identical immutable-by-convention `details.fx_repair`
version-1 audits containing original gross/commission/expense rows, USD cents,
stored rate, delta, wallet before/after, timestamp and evidence. Other details
are preserved; gross payment `gross_amount` is updated to USD. A replay with
the same amount and intact audit/corrected rows returns `already_repaired`
without another delta. A conflicting amount or inconsistent audit fails.
Subsequent wallet activity does not invalidate a valid replay.

After apply, privately verify both ledger currencies and amounts, original
audits, expense state, wallet delta and untouched unrelated credits. Keep the
evidence reference with the approval record. A failed RPC rolls back all money,
ledger, expense and audit changes together; do not compensate with independent
ad hoc balance writes.

## Accounting reconciliation

Neither the script nor this RPC posts, deletes or directly replaces journal
entries. Previously posted commission journals may still contain the old
amount/currency until approved reconciliation completes. The source is marked
pending and versioned so the existing authorized source-posting workflow can
rebuild the expense's generated journal set atomically. Coordinate affected
currency reports and posting periods; do not treat pending-source mutation as
proof that historical journals are repaired. Preserve deliberate unpublished
state and do not publish it automatically. The local-currency sale journal
does not need relabeling merely because its USD wallet ledger was repaired.

## Local regression tests

```bash
npm test -- --runInBand \
  __tests__/api/stripe-sale-wallet-repair.test.ts \
  __tests__/scripts/repair-stripe-sale-wallet.test.ts
```

The SQL suite creates and destroys a socket-only disposable PostgreSQL cluster;
it never reads a database URL or connects to a remote project. It uses local
`/opt/homebrew/opt/postgresql@17/bin` binaries by default, overridable with
`STRIPE_REPAIR_TEST_PG_BIN`. PostgreSQL cases explicitly skip if unavailable.
It executes the original financial-effect function to seed the bug, then tests
preview/apply, stored rates, audit replay, concurrent repair, refunds, ledger
and expense ambiguity, insufficient balance and transaction rollback. Script
tests use offline provider/client doubles and a clean subprocess to verify the
real resolver loads through `ts-node`; no credential or network use is needed.