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

### Paid add-ons on Free

`20261009080000_free_plan_paid_addons.sql` is a forward correction in this
workspace. It requires the coordinated API bucket, annual coverage, checkout
lease, canceled-window preservation, one-credit-per-add-on, and paid-window
preservation migrations named above. It fails closed when the relevant functions
are absent or still have the older allowance/chronology contracts. The database
owner must review those prerequisites and apply the correction before enabling
Free add-on checkout; this document does not authorize remote SQL execution.

- Free remains `commission`. Stripe has **only** the existing configured account
  add-on Price: $10/month or $108/year per extra. No zero-dollar base Price,
  Product, or environment variable is needed. Checkout has one quantity-bearing
  line item, not an empty or synthetic base item.
- The checkout request is unchanged except that `plan: "commission"` is accepted.
  First purchase requires `addonsCount >= 1`. Metadata uses `plan=commission`,
  `price_id=""`, and the verified `addon_price_id`, plus existing site, type,
  interval and count fields. These fields route/audit checkout; they never prove
  an entitlement. Paid add-on-only service is inferred from verified Stripe
  item and immutable invoice prices, quantities and full service periods.
- The server pricing helper returns an optional `base`/`basePrice`, a verified
  `addonPrice`, and explicit `lineItems`. Callers must not assume a paid base
  exists. Missing/inactive/wrong-currency/wrong-amount/wrong-interval add-on prices
  fail closed; no monthly or zero-dollar fallback is allowed.
- First checkout returns `{url, sessionId}`. Increases retain `prorated_addon`
  with paid/pending-payment status. Positive reductions retain
  `scheduled_addon_reduction` with `effectiveAt` at the current renewal boundary.
  An explicit subscription card is retained and verified in schedule phases.
- Reducing Free extras to zero schedules `cancel_at_period_end=true`, never an
  empty renewal phase. Existing paid extras remain until authoritative Stripe
  cancellation. An equal zero retry recovers without another write. Changes
  during an incompatible schedule/pending update/cancellation fail closed;
  canceling or replacing somebody else's schedule is not automated. Disconnect
  excess connections before requesting a reduction. Plan or interval changes
  for an add-on-only subscription require billing support, as do paid-base to
  Free conversions; checkout must never silently remove a paid base.
- Monthly allowance is the existing one Free credit **plus one per paid extra**.
  The first paid extras preserve already-consumed Free monthly credits, subsequent
  changes preserve consumption, and annual purchases grant only monthly windows
  within immutable paid annual coverage. Purchased/protected balances and account
  balance remain untouched. Terminal handling removes extras/coverage and keeps
  the existing canceled-window/retired-subscription identity fences.
- Free invoice coverage, including duplicate recovery, must match the fresh
  server-verified `commission`/quantity/interval service tuple. Failed invoices,
  partial-period lines, stale invoices, retired subscriptions and metadata alone
  cannot grant extras. Full-period discounted new-service prorations are accepted
  consistently by invoice settlement and paid-increase recovery.

Offline regressions are `stripe-free-addons.test.ts`, checkout/promotion route
tests, and `stripe-free-addons-sql.test.ts`. The latter executes the actual
TypeScript invoice producer and current coordinated migrations in disposable
PGlite using the same local API checkout gate described below, with no configured
database URL or remote service. It covers consumed/protected credits, monthly and
annual renewal, failure-to-paid settlement, immutable recovery, terminal and
replacement chronology, permissions and transactional failure rollback.

### Shared settlement invariants

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
  engine/foundry/enterprise plus 1 per add-on per monthly credit period, including
  annual subscriptions, after the API-owned forward one-credit-per-add-on migration.
  Apply its forward correction `20261009070000_preserve_paid_addon_credit_windows.sql`
  before resuming invoice processing. Existing paid windows retain previously
  granted add-on excess through paid updates; each new add-on grants one, and the
  next window uses only the new quota. Buying a year never grants twelve months
  of credits at once.
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

### Late payment after a terminal payment failure

The forward `20261126210000_opt_in_late_payment_workspace_license.sql` correction
adds a separate database-operator opt-in for an existing verified paid-month invoice.
With explicit incident approval, insert only that invoice ID into
`public.late_payment_workspace_licenses` after verifying the existing grant and its
current binding. This restores the effective workspace tier for member admission
and database-managed resource licensing until the existing paid-through deadline.
It reconciles automatically suspended members and connections using the existing
rules; it does not modify the recurring plan, add-ons, payments, or credits.
Other late payments retain the seat-only behavior below. Reversals and approval
removal reconcile the persisted state; authoritative entitlement reads fall back at
wall-clock expiry or rebinding. Expiration itself does not rewrite stored settings;
verify the runtime entitlement and reconcile presentation mirrors at expiry as needed.
`20261126211000_project_temporary_workspace_license.sql` exposes only the active
tier and expiration on the existing user-scoped billing read. Deploy this projection
before the updated UI and social connection checks. The UI distinguishes temporary
access from recurring billing, and uses temporary limits for connections and add-ons.
It does not represent the tier's credit allowance as a wallet credit or authorize a
new credit grant. Verify membership, connections and billing after rollout.

`20261125200000_stripe_late_renewal_access.sql` adds an access-only exception
for the latest monthly renewal paid after Stripe terminated the same bound
subscription for `payment_failed`. This is not subscription reactivation. The
server verifies the live cancellation, invoice service and successful full
payment, including the charge and absence of a refund or dispute. A completed
payment by itself is not entitlement evidence.

After the existing financial settlement, the service-only
`record_stripe_late_renewal_access` binds the proof to that immutable settlement
and to the current site, billing record, customer, terminal subscription and
cancellation time. It does not change billing, credits, add-ons or renewal
state. The extra member seats expire at the original invoice period boundary,
not one month after the late payment. Rebinding to a replacement subscription
does not transfer an individually approved extension either. Migration
`20261125213000_individual_late_payment_access_month.sql` allows a database
operator to explicitly opt in a single verified invoice: the seat and checkout
boundary use the later of the original service end and one UTC calendar month
from payment. All other invoices keep their original end. This does not edit
Stripe, change credit allowances, or override a charge reversal.

After `20261125220000_automatic_late_payment_access_month.sql` is installed,
new verified late-renewal grants enroll in this rule automatically, in the same
transaction as the proof. Both `invoice.paid` and `invoice.payment_succeeded`
use the same settlement path. The deadline is anchored to Stripe's verified
`paid_at`, never webhook arrival or retry time. Existing grants (including
individual extensions), ordinary active subscriptions and rejected payments
are unchanged. This does not broaden the original late-renewal eligibility
window or change the invoice's service period. Rebinding
does not carry the old entitlement forward. `revoke_stripe_late_renewal_access`
records a permanent charge reversal even if the grant has not arrived yet;
replaying a paid delivery cannot restore it.

The extra seats are checked at read time by the shared site role and bearer
access checks, including the user-scoped selector, site RLS and service list.
The extra seats are available only to currently active, identified members
whose membership row was created by the time Stripe ended the subscription.
This is a row-age check, not a historical snapshot of membership statuses.
Seat order, manual disablement and archival still apply. If a member already
has a seat through the ordinary plan or a higher trial, the overlay does not
take it away. It does not change the effective product plan, invite admission,
stored member suspension flags, settings team/channel mirrors, or resource
quotas. A feature with its own plan or membership gate may still be unavailable.
Selector caches can briefly retain presentation metadata, but do not grant
access; use a fresh selector read to verify recovery. The billing UI can still
show the subscription as canceled: access does not imply an active renewal,
a new allowance, or a change to protected or purchased balances.

Before any approved rollout, verify the existing member predicate and access
readers against the migration preflight, and verify
the coordinated annual/credit-bucket, paid add-on, and startup-trial licensing
prerequisites. Apply the SQL before enabling producers or readers of the new
RPCs. Review existing hosted Checkout sessions for affected subscriptions;
old sessions are not protected by the new boundary check and may need approved
expiry before historical replay. Enable and verify delivery of `credit_note.created`,
`charge.refunded`, successful refund events and `charge.dispute.created` before
replaying paid events.

There is no backfill. For a separately authorized recovery, obtain the invoice
ID from Stripe's current subscription and independently confirm the site's
stored customer and subscription IDs. Call the canonical server helper
`settleStripeSubscriptionInvoice` with that `invoiceId`,
`requirePaid: true`, `expectedCustomerId`, and `expectedSubscriptionId`. Do not
construct the evidence JSON by hand. Inspect `late_renewal_access` in the result:
`granted` or `duplicate` confirms the access proof; a missing value, `rejected`,
or `reversed` does not confirm access. Verify via a fresh selector read and RLS
as the affected member; do not manually clear suspension or settlement markers.

The disposable PostgreSQL test
`__tests__/security/stripe-late-renewal-access.test.ts` covers selector/RLS,
equivalent retries, reversal races, financial state preservation and expiry.
An active `customer.subscription.updated` event retrieves the authoritative
`latest_invoice` and replays it only if paid, so recovery does not depend on an
invoice webhook being redelivered. A failed/unpaid latest invoice is not payment
proof. Site reactivation without a subscription event still requires an explicitly
authorized verified paid-invoice replay; monthly renewal cannot invent coverage.

## Authorized incident recovery

### Emergency grace on a past-due monthly subscription

Install `20261126211000_project_temporary_workspace_license.sql` after the opt-in
license prerequisite, then `20261126220000_emergency_workspace_license.sql`, before
deploying the Billing changes. Do not reapply a previously installed migration.
The Billing action calls `POST /api/billing/emergency-grace` with the selected
site ID and the current primary owner's session. The database derives the prior
paid tier and the current unpaid monthly cycle; the browser cannot supply a tier,
owner, duration, or quota. The grant lasts at most 120 hours from the request,
never beyond the current cycle, is usable once per cycle, and is limited to three
grants per site in a rolling twelve-month window. Repeat requests do not extend it.
It does not settle a bill, restart renewal, grant credits or buy add-ons. Ordinary
payment, binding changes, cancellation and expiry supersede eligibility. A terminal
paid invoice is a separate incident; see the [credit audit](LATE_INVOICE_PLAN_CREDIT_AUDIT.md).

For release acceptance, use a Stripe test subscription with prior monthly coverage,
advance it to an unpaid renewal, request grace, then pay the invoice from Stripe's
hosted page without returning to the app. Verify one paid settlement, one allowance,
the same subscription ID and no new Checkout session. Redeliver the invoice event
and verify that the grant and balances do not change. Local regression tests do not
verify the Stripe account's retry settings, email delivery, or a hosted browser run.

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

### Legacy settled renewal with no stored coverage

A pre-coverage invoice marker can already have granted its allowance while
`verified_credit_coverage` is null and `credit_coverage_applied` is false. The
normal settlement helper deliberately returns `duplicate` for that state; a
webhook replay alone cannot recover its missing paid entitlement. Never remove
the marker or attach an unapplied proof that could grant the allowance again.

`scripts/repair-legacy-subscription-coverage.cjs` exports an operator-only
`runRepair({ supabase, evidence, apply })` module, with read-only preview by
default. It does not load credentials or infer payment proof. Use it only after
explicit target authorization and fresh live Stripe verification through the
canonical subscription/price/invoice service-line helpers, including current
tenant binding, paid status, full service interval and refund/dispute checks.
It supports only a monthly renewal whose already-credited window exactly matches
the verified paid window, with one matching historical grant, payment and marker.
Annual windows, ambiguous grants and differing service require separate review.

The module fills only missing paid coverage and source/anchor fields; it never
writes balances, consumption, plan, price or subscription identity. Its atomic
billing update uses compare-and-set filters, including PostgreSQL numeric text
values so JavaScript rounding cannot lose precision. The existing database
guards, RLS and license triggers remain enabled. It then attaches immutable proof
and `credit_coverage_applied = true` together on the existing invoice marker,
retaining its original granted-credit count. It does not invoke a credit grant.

These are two PostgREST requests, not one cross-table transaction. If interrupted
after billing succeeds, re-fetch Stripe and inspect both records before resuming;
the module recognizes the matching completed coverage and only finalizes the
marker. Null stored proof keeps intervening normal invoice retries as no-ops.
After recovery, verify effective plan/member access and replay the canonical
helper once: `duplicate` with zero credits must leave billing, payments, marker
and credit ledger unchanged. Reload existing browser tabs to refresh permissions.

The disposable PostgreSQL tests in
`__tests__/scripts/repair-legacy-subscription-coverage.test.ts` cover preview,
RLS restoration, exact balances, interruption recovery, idempotency and rejection
of stale or inconsistent evidence. They never contact a remote database or Stripe.

## Validation

Run all isolated Stripe producer and webhook regressions without dotenv or remote
credentials:

```sh
node node_modules/jest/bin/jest.js --config jest.stripe-offline.config.cjs --runInBand
```

### Hosted overdue invoice, without an app return

```sh
npm test -- --config jest.stripe-offline.config.cjs --runInBand --runTestsByPath __tests__/api/stripe-hosted-invoice-recovery.test.ts
```

This regression sends locally signed Stripe events directly to the canonical
webhook route. Disposable, socket-only PostgreSQL executes the actual delivery
claims, invoice settlement, credit accounting, and late-renewal access SQL.
Either paid invoice event must work first, even when its payload still says
`open`: the handler retrieves the paid invoice and settles the existing failed
payment row. No Checkout Session, browser return, or UI callback participates.
If Stripe reports the original subscription active, the monthly plan credits
are granted once. If Stripe canceled it for payment failure, it stays canceled
with renewal off and no new credits; an eligible member regains access through
the existing late-renewal seat grant. Replaying the same event ID or delivering
the other paid event under a new ID does not duplicate payment, credits, or
access, and Stripe calls are restricted to reads of fixture objects.

The test requires the sibling `../API` migration checkout and local PostgreSQL
17 binaries (`LICENSE_TEST_PG_BIN` overrides `/opt/homebrew/opt/postgresql@17/bin`).
It skips if either prerequisite is missing; a skipped run is not evidence.
Stripe responses come from in-process fixtures. This verifies the application
contract, not the live hosted page, payment processing, Stripe's real delivery
or subscription status transitions, or the deployed endpoint/database schema.
It sends no network requests and performs no external writes.

### Other settlement regressions

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