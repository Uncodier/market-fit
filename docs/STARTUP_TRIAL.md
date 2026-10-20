# Startup trial

## Product contract

Startup is the canonical `foundry` plan, called **Foundry** elsewhere in the UI.
The trial lasts exactly 360 hours (15 days), including across daylight-saving
changes. It starts only after an explicit **Start 15-day Startup trial** click
in Billing by a licensed project owner/admin with update permission.

- No card, Stripe Checkout, automatic billing or Stripe trial subscription.
- One trial per primary project owner, applied to one project (`site_id`).
- First release is available only on active Toolbox projects with no paid
  extras, live Stripe subscription or current paid coverage. Existing paid
  customers are not automatically downgraded to receive a trial.
- A new offer additionally requires no positive completed platform subscription
  or credit purchase in the selected project or projects currently owned by its
  primary owner. Archived projects and refunded payments still count; failed
  attempts, zero-price grants and unrelated commerce sales do not. Positive
  immutable subscription settlement receipts also establish previous payment.
- Foundry permissions: ten seats including the owner and pending invitations,
  six social accounts, and three agent channels.
- Fifty one-time trial credits, not Foundry's normal 100 monthly credits.
  They are a separate expiring bucket; they do not renew or become purchased
  credits. Ordinary deductions consume trial credits before other buckets.
- Existing Toolbox monthly allowance, bought/protected balances and withdrawable
  funds remain separate. Normal Toolbox renewals do not refill the trial bucket.
- At expiry, only the trial's unused credits and permissions expire. Historical
  records remain; excess members/connections are reversibly suspended.
- An explicitly purchased plan replaces the trial after authoritative payment
  verification. No trial grant is represented as a paid invoice or payment.

## Application boundary

`GET /api/billing/startup-trial?site_id=<uuid>` reads authorized status; it never
starts a trial. `POST /api/billing/startup-trial` accepts exactly `{site_id}`.
Neither duration, credit quantity, actor nor price is client-controlled.
The route verifies identity, tenant membership, manager role and update permission
before accessing service-only SQL. SQL activation also verifies the actor and
serializes the primary-owner claim across projects.

Responses expose only state (`eligible`, `active`, `expired`, `converted`,
`unavailable`), start/end, remaining trial credits and server time. Activation
adds `started` or `already_started`. Eligibility conflicts are safe HTTP 409;
missing prerequisites, malformed database responses and service failures produce
an availability error, never guessed entitlements or a direct balance fallback.

The Billing card uses server time for its countdown, explicit activation only,
bounded requests, a double-click guard, site-specific lifecycle state and an
expiry status/billing refresh. An ambiguous activation is not automatically
replayed. A confirmed activation with failed hydration asks to reload billing,
not restart the trial.
An active status recovered after a lost activation response also refreshes shared
billing, so the balance and connection allowances cannot remain at Toolbox.
Billing hides the trial card while the initial status is loading and when the
confirmed status is `unavailable`. Eligible, active and expired trials remain
visible; unconfirmed operations and refresh failures retain recovery controls.

The sidebar provides an **Activate trial** shortcut next to the credit widget.
It checks eligibility asynchronously after initial rendering and stays hidden
while loading or on an error. It requires a scoped manager with update permission,
loaded free billing and the explicit server `offer_eligible: true` decision.
Older deployments without this field cannot advertise an offer. The shortcut
does not start a trial: it targets `/billing?siteId=<uuid>&tab=billing_info#startup-trial`
where the explicit Start button owns the activation clock. It is independent of
the credit widget's low-balance visibility rule.

The stored `billing.plan` remains the base subscription plan. Presentation
connection allowances use `effectiveBillingPlan`, while paid subscription
purchase logic continues to use the base plan. This prevents a trial being
mistaken for a paid Foundry subscription. Missing trial columns allow legacy
billing reads but cannot grant trial access.

## Database and execution boundaries

Forward migrations in this repository:

1. `20261019220000_startup_trial_schema.sql`
2. `20261019220001_startup_trial_credit_writers.sql`
3. `20261019220002_startup_trial_model_reservations.sql`
4. `20261019220003_startup_trial_licensing.sql`
5. `20261019220004_startup_trial_resource_projection.sql`
6. `20261019233000_preserve_trial_renewal_rpc_contract.sql`
7. `20261019233001_license_legacy_voice_statuses.sql`
8. `20261020003000_startup_trial_payment_history.sql`

These extend the shared API-owned classified credit, annual-coverage and
actual-cost reservation prerequisites; they are **not** a standalone database
bootstrap. Apply the complete sequence only through the approved database-owner
workflow after checking the current target's functions, constraints and grants.
Never replay an already-installed base migration merely to repair history.
Pause billing, credit and licensing writers while applying the full batch:
the first schema change and its subsequent writer replacements are one
coordinated rollout, not independently deployable features.

The forward corrections retain Temporal's existing `reset` / `not_due` /
`stale_period` result and `credits_granted` field, including on projects without
a trial. They also count legacy Voice `active` / `synced` connections against
the same licensed quotas as `connected`, preserving their status while eligible
and suspending them at expiry. Other connection types still require `connected`.
The payment-history migration replaces the shared status decision, so both
the delayed sidebar check and activation inside its existing SQL locks enforce
the same history rule. It does not revoke an already active trial if credits are
purchased afterwards. Apply it after the seven trial prerequisites, before
advertising the shortcut; no remote migration is applied by this implementation.

The claim is service-private and retained when a site/account is deleted so
deletion does not reset the same owner's eligibility. Billing projects the
trial's protected timestamps, conversion marker and remaining credits.
`credits_available` includes the fourth `trial_credits_available` bucket.
Model admission receipts classify held trial funds separately; refunds must
respect the trial's original expiry and conversion instead of turning unused
trial holds into bought or protected money.

Database member admission and RLS resolve current license eligibility at request
time, independently of stale `license_suspended` mirrors. Connection write
guards resolve current quotas. The sibling API's bearer-user site authorization
uses `site_user_has_effective_access` without a cached positive membership result.
Tenant-scoped machine credentials retain their existing identity contract.
**Service-role provider execution bypasses RLS**:
outgoing channel/social consumers must use the time-aware
`get_site_licensed_resources` projection immediately before dispatch. Raw stored
settings flags are not a license authorization boundary. Coordinate the sibling
API execution consumer rollout with these migrations; a periodic reconciliation
job alone is not sufficient to authorize execution.

Provider deliveries already accepted before expiry are not revoked. In particular,
an Outstand scheduled post accepted during the trial remains provider-managed;
there is no later execution callback to reauthorize or cancel it automatically.
Expiry blocks new local dispatch requests, not previously accepted provider jobs.

## Validation and rollout

Run focused Jest suites for the route, shared helper, Billing UI/service,
hydration and credit widget, and the disposable PostgreSQL migration suites.
Use `npm run typecheck` and targeted ESLint, not a production build.

The live SQL regression suite requires the sibling API checkout and local
PostgreSQL binaries. Without those prerequisites its live cases are explicitly
skipped; source-contract checks still run. No test uses a configured database URL.
The renewal repair regression additionally invokes the sibling Workflows
consumer against real local SQL responses when that checkout is available.

Before rollout, verify denied anonymous/cross-project access, per-owner concurrent
claiming, exact expiry, nonrenewal, purchased/protected fund conservation,
reservation refunds and paid conversion. Review skipped local database cases;
mocked HTTP/UI tests alone do not establish SQL concurrency or RLS behavior.

### Legacy paid subscriptions and member access

Before enabling dynamic licensing, audit active Stripe-backed paid projects whose
`paid_subscription_invoice_id` or paid service period is missing. A stored
Foundry plan and `subscription_status = active` alone do not establish verified
paid coverage. Without a current verified paid period or active trial,
`effective_site_plan` returns Toolbox (`commission`). Its only seat is reserved
for the primary owner, so an active admin can lose both RLS visibility and write
capabilities even while `license_suspended = false`. The raw flag is a mirror,
not the dynamic access decision. This can also suspend effective connection use.

The site-creation policy correction does not change this decision: its direct
owner check fixes `INSERT ... RETURNING`, while non-owner visibility still uses
the shared license-aware role lookup.

Recovery requires explicit operator authorization and authoritative Stripe
verification of the site's current customer, subscription, paid invoice, service
lines and covered period. Use the existing invoice-keyed settlement/recovery flow
described in [Subscription invoice recovery](STRIPE_INVOICE_RECOVERY.md); inspect
any historical settlement and consumed credits before replaying. A completed
payment without verified coverage is not enough to invent entitlement dates.
An expired invoice cannot establish current coverage, and ambiguous historical
credits require operator reconciliation rather than a second grant.

Do not disable RLS, bypass seat limits, clear settlement markers, change ownership,
or substitute `active` status for payment verification. After approved recovery,
verify effective plan and allowed/denied member access, then reload the workspace
to refresh its permission snapshot. The disposable PostgreSQL regression in
`__tests__/security/startup-trial-migration.test.ts` reproduces the stale-flag admin
denial and verifies access restoration, protected balances and duplicate safety
after a newly verified settlement; it does not verify a customer's live Stripe
invoice or reconcile ambiguous historical payments.

Local implementation does not apply remote migrations, configure Stripe, deploy
applications or start trials for existing customers. After an explicitly approved
rollout, verify grants/RLS and run Supabase security/performance advisors.