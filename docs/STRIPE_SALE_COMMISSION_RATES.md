# Stripe sale total payment fees

## Schedule

The forward migration
`supabase/migrations/20261015000000_stripe_sale_payment_fee_rates.sql`
and the application's display helper `lib/sale-payment-fees.ts` define this schedule:

| Stored plan | Total fee |
| --- | ---: |
| enterprise | 4.5% |
| foundry | 5.5% |
| engine | 6% |
| commission / free, absent or unknown plan | 7% |

The migration takes effect when applied, not automatically at the filename's
date. It applies when a sale's financial effects are first posted. Pending/unposted
settlements use the site's plan at posting time; already-posted sales retain
their recorded rate even if the site changes plans or a webhook is replayed.
Only exact canonical paid plan names receive a paid-plan rate. Legacy aliases,
uppercase and whitespace variants default to 7%; inspect/correct the trusted
billing plan through the approved workflow rather than assuming a paid rate.

The backend is the application repository's Stripe webhook and Supabase RPC,
not the separate orchestration `API` repository. There is no Stripe Product or
Price to provision for these percentages. Platform subscription amounts and
credit purchase amounts are unchanged.

## Financial contract

`apply_stripe_sale_financial_effects(uuid, text, numeric, text)` loads the trusted
site's billing plan inside PostgreSQL. The browser does not choose the fee:

```text
total payment fee = round(gross USD settlement × plan rate, 2)
seller wallet credit = gross USD settlement − total payment fee
```

Standard Stripe processing is borne by the platform out of the total payment
fee; it is **not deducted from the seller a second time**. `payments` retains
separate gross sale and commission entries for reconciliation. New entries
record `commission_basis = processing_included`.
The Payments screen uses the recorded rate, not today's plan rate, to label
processing-included entries. Historical entries keep their original label.

Currency verification, row/advisory locks, atomic wallet/ledger/expense writes,
and service-role-only execution remain in place. Retries do not credit or charge
again. Historical currency repairs keep their original recorded fee rate.

These are base percentages, **not a guarantee of profitability**. This change
does not configure international surcharges, currency-conversion surcharges,
minimum fees, fixed components, payout fees, or refund-policy changes. Stripe
processing costs and other product fees may exceed the total fee, especially
for small or international payments. Stripe does not return original processing
fees on refunds. Review actual production pricing and seller terms before rollout.

## Rollout

1. Obtain approval and confirm the exact target Supabase project. Do not use an
   environment-derived target without checking it.
2. Confirm the settlement tables and ledger objects required by the existing
   financial-effects function are present. Review the prerequisites in
   `20260917210300_stripe_settlement_effect_execution.sql` and the USD guard in
   `20261014220000_stripe_sale_wallet_usd_guard.sql`; the migration directory is
   not a complete database bootstrap.
3. Review and apply the **complete new migration** using the team's approved
   database-owner workflow. It is transactional and does not backfill balances
   or reprice historical sales. It replaces the function without changing its
   callable signature. Do not replay old migrations after the correction.
4. Run `scripts/verify-stripe-sale-payment-fees.sql` against the confirmed
   target using the same approved read-only SQL workflow. It checks function
   definition and privileges without posting a sale. It is not an end-to-end
   payment test.
5. Deploy the application UI and commercial-site pricing together with the
   database change. Source-code updates alone do not change a remote database.
6. In an explicitly approved disposable/test environment, verify a new $100 USD
   paid sale credits $95.50 / $94.50 / $94 / $93 respectively, and that replaying
   the webhook adds no wallet or ledger entries. Reconcile provider processing
   costs separately. Notify existing sellers and obtain any required acceptance
   before changing commercial terms.

For rollback, prepare an approved forward corrective migration. Do not delete
migration history, alter recorded commissions, or run currency-repair scripts
to change this schedule.

## Local verification

From the application repository:

```bash
node node_modules/jest/bin/jest.js --config jest.stripe-offline.config.cjs --runInBand --runTestsByPath __tests__/api/stripe-sale-payment-fees.test.ts
node node_modules/jest/bin/jest.js --config jest.pricing-offline.config.cjs --runInBand
```

The commission migration test uses disposable socket-only PostgreSQL, never an
application database URL or configured credentials. It uses local PostgreSQL 17
binaries and explicitly skips live cases when those binaries are unavailable.
See `STRIPE_WALLET_TEST_PG_BIN` in the test for an alternate binary directory.