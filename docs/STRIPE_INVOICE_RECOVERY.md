# Subscription invoice settlement and recovery

Subscription invoices use `settle_stripe_subscription_invoice` from
`20261002210954_atomic_stripe_subscription_invoices.sql`, followed by the shared
credit-bucket prerequisites in [Monthly credit reset](BILLING_CREDIT_RESET.md),
`20261007180000_annual_subscription_credit_periods.sql`, and
`20261007180001_subscription_checkout_leases.sql` (in the API workspace). The database owner must verify
and apply those forward migrations before enabling annual handlers. Creating the
migrations does not charge Stripe or create subscriptions.

If the `20261007180000`/`20261007180001` schema or functions were applied through
the database dashboard but migration history is missing their versions, reconcile
that history with the database owner first. Do not blindly replay already-applied
SQL. The coordinated API forward fix `20261008210000` for canceled annual credit
refill also requires owner review and prerequisite verification before rollout.
This guide does not authorize a remote migration or configuration change.

## Invariants

- Verify the signed webhook, then retrieve the current invoice, subscription,
  and customer from Stripe. A delayed failure must not undo a paid invoice.
- Normalize `starter` to `engine` and `startup` to `foundry`. A database trigger
  also normalizes writes from older integrations; unrelated plans are unchanged.
- Both paid invoice event types and the initial subscription checkout converge
  on the invoice ID, not the delivery event or checkout ID.
- The service-role-only RPC checks the billing customer/subscription binding,
  serializes invoice processing, and changes payment, credit balance, credit
  ledger, and settlement marker in one transaction. It preserves consumed
  plan consumption and recomputes a non-accumulating monthly plan quota rather
  than assigning a stale aggregate balance. Purchased and protected balances remain intact.
- Initial and renewal invoices grant 20/100/500 base credits for
  engine/foundry/enterprise plus 5 per add-on per monthly credit period, including
  annual subscriptions. Buying a year never grants twelve months of credits at once.
- A failed payment row can become completed. Repeated failures update the same
  row. Completed payments never become failed because of a delayed event.
- Historical completed payments without a settlement marker are ambiguous:
  older credit functions did not always write a ledger. They fail closed for
  operator review instead of automatically receiving a second allowance.
- Legacy additive renewal jobs must not reset Stripe-backed subscriptions from
  queued plan arguments. Daily renewal through the verified coverage-aware
  `renew_site_plan_credits` RPC is required for annual subscriptions; it permits
  only monthly windows within immutable paid annual coverage.

## Annual paid coverage and update verification

The annual forward migration adds `billing_interval`, immutable verified
`paid_subscription_period_start/end`, `paid_subscription_invoice_id`,
`paid_subscription_plan`, and `paid_subscription_addons_count`. Deploy the
database-owner migration before enabling annual checkout. Monthly credit windows
are anchored to paid-start anniversaries, clamped at month-end; verified annual
coverage permits covered monthly renewals without charging another invoice.

`settleStripeSubscriptionInvoice` retrieves the live invoice and resolves its
actual service lines through both monthly and annual server-configured prices.
The RPC receives `p_invoice.billing_interval` and `coverage_verified` along with
the actual invoice plan, addons, line period and paid timestamp. It never infers
historical paid entitlements from current subscription metadata or generic invoice
creation bounds. Invoice lines must be complete, identify one configured base
service, have the full configured gross price and full clamped interval, and have
addons with the same covered interval. Discounts may reduce actual paid amount to
zero; the verified gross service remains the entitlement proof.

### Historical Enterprise $499 monthly compatibility

The server-only [historical read catalog](../lib/subscription-history-pricing.server.ts)
adds explicitly allowlisted retired Enterprise monthly Prices to invoice proof
and retrieved subscription-state verification only. New checkout and hosted
update target selection still use the strict current $500/month catalog. No
Price IDs are embedded in source, and no provider Prices are created or changed
by this compatibility path.

Operators must configure both `STRIPE_ENTERPRISE_LEGACY_MONTHLY_PRICE_IDS`
(comma-separated exact retired IDs) and
`STRIPE_ENTERPRISE_LEGACY_MONTHLY_AMOUNT=49900` (USD cents). Neither variable is
public. An unknown ID is rejected, even if its amount is $499 or subscription
metadata says Enterprise. A known ID is accepted only after the actual provider
Price verifies as USD $499, licensed monthly/count-one recurring, per-unit,
without transformed quantities, and invoice service verifies full gross $499,
quantity one and the full monthly period. Archived Prices are acceptable for
historical proof; new checkout still requires an active current Price. Discounts
may reduce paid amount but cannot replace gross-service verification.

Rollout (operator approval required; this code change does not perform it):

1. Inventory all existing $499/month Enterprise Price IDs across subscriptions
   and recoverable invoices, including active and past-due subscriptions using
   IDs other than the currently configured one. Verify intended Enterprise
   product, correct Stripe account/mode, amount, recurrence, and tenant binding.
   Store the verified list only in deployment configuration, never in Git.
2. Set the explicit read-only allowlist and exact `49900` amount together, while
   setting `STRIPE_ENTERPRISE_PRICE_ID` to the independently verified active
   $500/month new-purchase Price. Avoid other catalog collisions. During a
   staged rollout, an allowlisted legacy ID still in the checkout variable is
   recognized only for read proof; checkout fails closed until $500 is configured.
3. Run the offline suites below and deploy the handlers after verifying the
   existing database prerequisites and reconciling dashboard-applied migration
   history. Review the coordinated API canceled-annual-credit forward fix above;
   do not replay older SQL to repair history. No migration is added for historical pricing.
4. Only then replay specifically authorized paid invoice deliveries using the
   existing invoice-keyed recovery process. Do not create a replacement
   subscription, recharge invoices, remove settlement markers, or migrate old
   subscriptions to $500 merely to make verification pass. Keep legacy IDs
   allowlisted while their lifecycle events or old invoices may need verification.

### Zero-dollar subscription checkout

Only a retrieved subscription-mode session with metadata type `subscription`,
`payment_status=no_payment_required`, and `amount_total=0` may enter the initial
invoice settlement path without a paid Checkout Session. That path still
retrieves the authoritative invoice and requires its status to be `paid` with a
verified paid timestamp, customer/subscription binding, configured gross service
and full coverage. `no_payment_required` alone is never evidence of payment.
`invoice.paid`, `invoice.payment_succeeded`, and checkout deliveries converge on
the same invoice-keyed transaction, including fully discounted service with no
PaymentIntent. Open/unpaid/missing or unverifiable invoices cannot grant credits.
Sale, order, and credit-purchase sessions retain their existing `paid` checks;
the zero-dollar exception does not apply to them.

Stripe's [proration semantics](https://docs.stripe.com/billing/subscriptions/prorations)
are important: the classification depends on the operation, not only duration.
A full-period debit can be `proration: true`. Proration lines have
`discountable: false`; their `amount` already reflects subscription discounts,
and those embedded discounts are not listed in `discount_amounts`. Adding that
array back or requiring `amount === configured_price * quantity` rejects genuine
20% and 100% discounted updates. Regular service lines expose gross `amount`
with separately listed discounts; newer versions also expose the explicit
pre-discount [line subtotal](https://docs.stripe.com/api/invoice-line-item/object).
The producer validates the retrieved recurring Price's currency, gross unit
amount, interval and quantity, then independently verifies the **entire** service
interval and matching addons. It never reconstructs a historical discount from
the current coupon. Negative credits and `proration_details.credited_items` are
not new service, including zero-dollar credits. Zero-dollar new debits remain
eligible; partial-duration debits remain ineligible even with a 100% discount.

A full verified `subscription_update` service charge may establish coverage, even
if Stripe labels it a proration, but partial positive prorations, absent service
lines, and unverified periods fail closed pending authorized billing recovery.
Old negative proration credits do not prove new service. Paid update settlement
preserves consumed plan credits while aligning the window to newly paid service;
repeated switches must not refill consumed allowance. A historical update whose configured tier,
interval or addons differ from the current subscription still retains its immutable
verified service proof, but cannot overwrite newer service. The producer supplies
`p_invoice.current_service: { plan, addons_count, billing_interval }` independently
from the freshly retrieved configured Stripe subscription. For both first application
and duplicate recovery of a stored `subscription_update`, SQL requires that tuple
to exactly match the **stored** immutable coverage and requires fresh verified
invoice proof. Missing/mismatched current service returns
`credit_outcome: current_service_mismatch` without grants, tier/coverage overwrite
or recovery-marker changes. It never rewrites stored proof from retry fields.
Changing a retry's billing reason cannot bypass the stored-reason gate. A later
matching active retry can recover the original immutable coverage once. Immutable
paid timestamps also support database stale-update protection.

`sync_stripe_subscription_state` is service-role only. It accepts `p_site_id`,
`p_customer_id`, `p_subscription_id`, `p_expected_subscription_id`, `p_status`,
and optional `p_current_period_end`, `p_start_date`, `p_end_date`, `p_auto_renew`.
Invoice-origin synchronization also supplies optional `p_invoice_id` (default
null). Under the same billing lock, a matching invoice whose immutable coverage
is already applied skips **all** status/metadata writes and returns `synced` with
`invoice_sync_skipped: true`. This closes the race where another delivery applies
coverage after a JavaScript read but before a delayed duplicate's sync. The
producer always passes the invoice ID, including initial checkout; do not add a
separate lifecycle sync ahead of checkout settlement. Genuine lifecycle events
omit this parameter. An identity mismatch still returns `obsolete_subscription`.
The expected ID comes from the billing row read **before** retrieving the
authoritative Stripe status. The RPC locks billing, validates the customer, and
returns `{ outcome: 'synced' | 'obsolete_subscription', subscription_id }`.
Obsolete events are successful no-ops, not retryable errors. A terminal event for
an old ID cannot rebind it or erase a replacement's annual coverage; replacement
requires an unbound or terminal prior subscription and never revives retired IDs.
Do not write subscription identity/status through `upsert_billing` or direct
updates. The producer uses fresh Stripe status, never stale notification fields.

Nonterminal `customer.subscription.*` events synchronize identity, cancellation,
status and period-end only. They cannot grant a new plan/addons/interval before
payment. Actual terminal cancellation removes paid addons and falls back to
commission atomically in SQL; no separate unfenced addons update is permitted.
Terminal synchronization does not require a still-configured historical Price.
Invoice settlement does **not** write status. Synchronize verified status before
first settlement/recovery; obsolete invoices return `obsolete_subscription` with
zero credits and never reach financial settlement.

A paid invoice while paused or otherwise inactive may be financially settled
without applying entitlement. A later verified paid duplicate can recover its
**stored immutable** coverage once, provided both locked billing and fresh Stripe
status are active. `duplicate` may therefore include `coverage_recovered: true`
and positive `credits_granted`; the application must not add credits itself.
An active `customer.subscription.updated` event retrieves the authoritative
`latest_invoice` and replays it only if paid, so recovery does not depend on an
invoice webhook being redelivered. A failed/unpaid latest invoice is not payment
proof. Site reactivation without a subscription event still requires an explicitly
authorized verified paid-invoice replay; monthly renewal cannot invent coverage.

## Authorized incident recovery

1. Verify the target project and obtain approval for the migration, deployment,
   and specific invoice recovery. Never accept invoice state or amounts from a
   browser request.
2. Run the handler and disposable PostgreSQL tests. Apply only verified prerequisites
   and the coordinated forward migrations;
   this repository is not a complete bootstrap history, so do not blindly push
   all historical migrations.
3. Deploy the new handlers and the annual coverage-aware monthly renewal RPC before
   replaying financial side effects.
4. Retrieve the invoice and customer using the production Stripe SDK. Confirm
   paid status, site, customer, subscription, amount, currency, billing reason,
   and the already-existing payment row. Review historical credits and renewals.
5. Invoke `settleStripeSubscriptionInvoice` with `requirePaid: true` and the expected
   customer/subscription. These are the same server-side helpers used by the
   webhook, including invoice-aware status synchronization before first settlement
   or coverage recovery. Do not separately synchronize a completed invoice's
   status snapshot. Supply the original event ID only as audit context; do not forge a
   provider event or erase the webhook delivery history.
6. Verify one completed payment, one settlement, one credit ledger entry, the
   canonical active plan and unchanged consumed credits. Repeating settlement
   after coverage is applied must return `duplicate` with zero additional credits.

Do not create a replacement subscription or retry charging a paid invoice.
Do not reset the entire credit balance or indiscriminately reprocess historical
completed invoices. Keep customer identifiers and credentials out of committed
scripts, fixtures and documentation.

## Validation

Run all isolated Stripe producer and webhook regressions without dotenv or remote
credentials:

```sh
node node_modules/jest/bin/jest.js --config jest.stripe-offline.config.cjs --runInBand
```

Discounted service fixtures mirror Stripe's documented gross regular lines and
embedded-discount proration lines, including zero-dollar old credits/new debits.
Ordering regressions cover delayed deletion/failure, subscription replacement
during retrieval, latest paid-invoice active recovery, and obsolete no-ops.
The permanent `stripe-subscription-recovery-integration.test.ts` runs the actual
TypeScript producer against the canonical API migrations in disposable PGlite.
It verifies tier, interval and addons mismatch blocks recovery without mutating
payment, stored proof or credits, followed by matching once-only recovery.
It defaults to a sibling `../API` checkout, or `BILLING_TEST_API_WORKSPACE` selects
another local API checkout; if that checkout/PGlite is absent, the suite skips and
must be rerun in a coordinated checkout before rollout. No database URL is used.

`npm test -- --runInBand __tests__/api/stripe-invoice-settlement-sql.test.ts`
starts a disposable socket-only PostgreSQL cluster. It never uses a configured
database URL. PostgreSQL binaries default to
`/opt/homebrew/opt/postgresql@17/bin`; use `BILLING_TEST_PG_BIN` to select another
local installation. If binaries are absent, the live SQL suite is skipped and
must be run in a suitable environment before rollout.

On a failed deployment, retain the additive schema and diagnose before promotion.
Do not roll back to the old handler and then replay invoices: it lacks the new
financial idempotency marker. Prefer a forward fix. A settled invoice must never
be recovered by deleting its marker.