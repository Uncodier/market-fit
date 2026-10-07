# Monthly included credits and protected balances

The coordinated credit migration is stored in the sibling API repository:
`../API/supabase/migrations/20261003230000_credit_buckets_and_monthly_reset.sql`,
`20261003230001_stripe_plan_credit_reset.sql`, and
`20261003230002_classified_credit_operations.sql`, followed by
`20261005230000_exact_credit_accounting_precision.sql` and
`20261007003000_remove_signup_credit_bonus.sql`. Apply them in that order only
through the approved, explicitly authorized database-owner workflow. Do not apply
both copies of a shared migration or deploy only one of the three repositories.

See `../API/docs/BILLING_CREDIT_RESET.md` for audit/backfill and coordinated
API/market-fit/Temporal rollout details. No remote migration or deployment has
been performed by creating these files.

Verify the existing schema before applying prerequisites. Do not rerun base
migrations when their objects already exist merely because migration-history
entries are absent; the database owner must reconcile history through the approved
workflow. The new migration is forward-only.

Included plan credits reset rather than accumulate. Toolbox (`commission`, with
legacy `free`/`toolbox` aliases) includes one monthly credit; Engine includes 20,
Foundry 100, Enterprise 500 and paid addons five each.
New Toolbox/free projects receive one initial monthly plan credit, not a
separate signup bonus. Initialization is atomic and idempotent: repeated calls
must not refill spent credits within the same period. Existing purchased,
withdrawable and protected legacy balances must not be reduced by this change.
Canceled subscriptions fall back to Toolbox once, not once per repeated webhook.
Scheduled cancellations retain the paid period until the actual terminal state.

`credits_available` remains regular usable credits, now composed of plan,
purchased and protected legacy buckets. `account_balance` remains separate and
withdrawable. Bought and withdrawable funds are not monthly-reset targets.
`monthly_credits_used` records period usage; `credits_used` remains lifetime
usage. The included-consumption counter prevents plan-switch refill exploits.

Purchase settlement uses a database idempotency key before recording the payment;
if recording fails, retry reuses the grant key rather than crediting twice.
Subscription settlement supplies the live invoice line period and verified live
subscription status. Only a verified paid eligible new period resets the plan
bucket; same-period, stale, failed or terminal deliveries cannot refill it.

Browser contact saves omit paid plan, aggregate credits and auto-renew mutations.
The SQL guard independently rejects browser financial edits and cross-site saves.
Workflows and API signup all call the same atomic initializer; there is no
additive fallback when a welcome payment marker is absent.

## Required initialization and frontend freshness

Project creation awaits same-origin `POST /api/billing/initialize` before starting
optional external `/api/site/setup` work. The request accepts only `site_id`
(UUID); `requireSiteAccess({ requireManager: true })` and `userCanOnSite(update)`
authorize the operation before the server-only service client calls
`initialize_site_billing({ p_site_id })`. It neither depends on Temporal/API
availability nor reads or writes balances directly as a fallback.

A missing RPC returns an explicit safe `503` availability error. RPC failures,
unsuccessful results and unrecognized outcomes are not reported as success.
If billing fails after the site insert, completion still retains the created
project and shows a persistent warning not to recreate it. Retry only billing
setup from completion or Billing. The Billing page offers an explicit retry to
owners/admins with update capability when no billing is loaded; viewing the page
does not automatically grant credits. Server checks remain authoritative.

After initialization or an idempotent retry, `refreshSiteBilling` reads the latest
billing row under the user's RLS session and updates both the site list and active
site, preserving settings and not switching another active project. This targeted
refresh is not suppressed by onboarding's full-site refresh prevention. Credit
refresh uses the same path. A successful initializer with a failed refresh shows a
distinct balance-refresh warning rather than pretending credits are visible.

The targeted billing read has an eight-second deadline and aborts its HTTP
request. Callers additionally bound the refresh wait to nine seconds, so an
unresponsive read cannot keep creation in its saving state forever. Deadline
failures retain the saved project and permit optional setup to continue; a late
read cannot paint a balance after that read's deadline.

Site detail/settings hydration merges against the current state and preserves
billing because those requests do not read financial data. Full-site loads
capture a billing revision when they start: they retain a targeted credit read
that completed during the load, while later full loads can still refresh spent
balances normally. No persistent financial cache or guessed balance is used.

**Rollout prerequisite:** apply and verify the forward API-owned migration above
before enabling this frontend. The previously deployed initializer may still grant
30; checking its response after execution cannot prevent that legacy mutation.
Do not deploy the new endpoint against that old function. No migration or live
credit write was performed as frontend validation.

Focused application regression command:

```sh
npm test -- --runInBand __tests__/api/stripe-subscription-billing.test.ts __tests__/api/stripe-invoice-credit-period.test.ts __tests__/api/credit-purchase-settlement.test.ts __tests__/api/partner-license-credit-safety.test.ts __tests__/services/billing-contact-save.test.ts
npm test -- --runInBand __tests__/api/billing-initialize.test.ts __tests__/app/services/billing-initialization-client.test.ts __tests__/context/site-refresh-billing.test.ts __tests__/context/site-billing-hydration.test.ts __tests__/components/billing-initialization.test.tsx __tests__/components/create-site-billing.test.tsx __tests__/app/services/site-setup-client.test.ts
```

These tests are offline and use synthetic accounts. The API suite executes actual
SQL in memory and in a disposable socket-only PostgreSQL cluster, including
concurrency, authorization, monthly boundaries and protected-balance preservation.