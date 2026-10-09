# Automatic credit top-up

Opt-in prepaid billing: an owner/admin with update permission chooses a minimum,
target and monthly USD cap, and explicitly consents to automatic purchases.
The principal Billing card is proposed by default; it does not need to be entered
again. Stripe Setup Checkout is only for adding or choosing another card. Default is **off**. The service records
the authenticated actor, time, settings revision, price and settings snapshot
atomically with every saved configuration. A card shown elsewhere in Billing is
not consent for automatic purchases.

## Purchase and recovery contract

- Below the minimum, buy `ceil(target - available)` **whole** credits at **USD $1
  each** (no bulk discount). Rounding may leave less than one credit above the
  target. The target is calculated at admission, not continuously guaranteed
  during concurrent usage. Included credits are renewed/expired before admission.
- A UTC calendar-month cap includes all pending reservations and successful
  attempts settled this month. Lowering the cap cannot undo previously authorized
  payments. Bought credits do not expire monthly; no overdraft is introduced.
- Database admission reserves one attempt per site. Immediately before Stripe,
  single-use dispatch rechecks enabled consent, settings revision, customer/card,
  eligibility, fresh ownership and the cap. Disabling or changing settings before
  dispatch prevents that charge. Once dispatched, the payment may still complete
  even if top-up is subsequently disabled; the UI says this explicitly.
- **Dispatch is never repeated.** A timeout or interrupted process without a saved
  PaymentIntent ID is quarantined for webhook/operator reconciliation, even
  within Stripe's idempotency-key retention window. There is no automatic create
  retry that can become a second charge after Stripe forgets a key.
- A saved intent is retrieved, never automatically confirmed again. Provider
  errors carrying an intent ID are retrieved and independently verified. Only
  live success with matching site/attempt/customer/card/amount/currency and full
  `amount_received` atomically creates the payment, purchased credits and final
  attempt. Duplicate settlement does not grant twice.
- `requires_action`, `requires_payment_method`, `processing` and ambiguous results
  remain pending and are shown in Billing as requiring attention. Only verified
  cancellation releases a dispatched reservation and pauses future top-ups.
  Recovery currently requires billing support; the card does not perform 3DS
  recovery or automatically cancel/refund pending payments.
- Replacing a card disables automatic top-up. Only the latest persisted setup
  token can attach its card; old or replayed Checkout deliveries cannot overwrite
  a newer card or disable an already re-enabled configuration. Successful setup
  still requires explicit re-enablement. Setup or save timeouts require reloading
  persisted settings, not assuming the operation failed without effects. The footer
  shows reload/retry only after load failures or unconfirmed saves/card setup; it
  is not a permanent action during normal editing or after a confirmed save.

## Rollout (not executed by this change)

1. Verify the shared API-owned classified-credit, precision and annual-period
   prerequisites. Never replay installed migrations merely because history is
   missing. Stop old automatic top-up workers during the coordinated rollout.
2. After database-owner approval, apply in order in the shared database:
   - `supabase/migrations/20261009030000_auto_top_up.sql`
   - `supabase/migrations/20261009050000_auto_top_up_dispatch_safety.sql`
   - `supabase/migrations/20261009060000_auto_top_up_setup_binding.sql`
   - `supabase/migrations/20261009070000_auto_top_up_billing_card_default.sql`
   Skip any already installed migration. The forward fixes conservatively mark
   previous pending attempts as already dispatched and disable existing top-up
   settings until a verified existing Billing card or fresh setup and explicit consent. They do not
   rewrite or revoke purchased balances.
3. Deploy Billing, worker and webhook together. Configure server-side Stripe and
   Supabase credentials plus `CRON_SECRET`. Ensure the webhook receives
   `checkout.session.completed`, `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `payment_intent.canceled`.
4. `vercel.json` requests a five-minute cron on supported Vercel plans. Configure
   the secret and verify actual deliveries before opting in customers. Other
   hosting needs an equivalent authorized job. The worker has a 300-second
   function budget, bounded batch size, 10-second Stripe request timeouts, and
   stops admitting new sites after 180 seconds. DB/network outages can still
   require reconciliation; cron overlap cannot authorize a second dispatch.
5. Test in Stripe test mode before enabling real purchases. Inspect private
   attempt/consent tables, credit/payment ledgers, paused/pending Billing states,
   and cron outcomes. Alert operators on unresolved dispatches; email/push alerts
   are not implemented. A refund or dispute also needs operator reconciliation
   of consumed credits; automated credit revocation is not implemented.

Do not delete pending rows, reset dispatch markers, or create a new PaymentIntent
to replace an unknown one. Locate the original using Stripe metadata `attempt_id`;
settle verified success or reconcile/cancel the original explicitly. Already
paid purchases must be credited even if the user has since disabled top-ups.

## Offline verification

From the market-fit repository:

```sh
PATH=/opt/homebrew/bin:$PATH node node_modules/jest/bin/jest.js \
  --config jest.stripe-offline.config.cjs --runInBand --testPathPattern=auto-top-up
PATH=/opt/homebrew/bin:$PATH node node_modules/jest/bin/jest.js \
  --config jest.topup-ui.config.cjs --runInBand
```

The SQL runner uses the sibling API's existing PGlite dependency and credit
fixtures (`BILLING_TEST_API_WORKSPACE` can specify its absolute path). It applies
actual migrations in a disposable in-process PostgreSQL engine, with synthetic
identities and no credentials or network. It covers sequential idempotency and
transactional invariants; it does not alone prove independent-session locking.
For independent connections with locally installed PostgreSQL 15+ tools:

```sh
PATH=/opt/homebrew/bin:$PATH node __tests__/api/auto-top-up-native-runner.mjs
```

This second runner starts a disposable socket-only PostgreSQL cluster, verifies
that a disable holding the billing lock prevents a waiting dispatch, races four
independent dispatch connections, and checks disabled post-dispatch recovery.
It uses a sanitized environment and removes the cluster afterward. `PG_BIN` can
select an absolute PostgreSQL bin directory. No external database is contacted.

UI tests use offline jsdom without Next config or deployment environment files.
No live Stripe payment, remote migration, deployment or browser session was used
as evidence of successful production operation.

## Default card selection

Billing's payment-method display and the top-up proposal use the same server
resolver: the customer's invoice default, otherwise the current configured
subscription's card, otherwise a single unambiguous attached card. Detached,
expired, cross-customer or non-card methods are not selected. Multiple cards with
no defined default require an explicit choice, never arbitrary selection.

The proposal returns only brand, last four digits, expiration and a hash of the
card identity. Enabling top-up re-verifies the card and the displayed hash, then
registers the card and actor consent atomically. A concurrent Setup Checkout or
changed customer cancels that save. Read-only proposal never activates charges.
Once consented, the selected card is pinned: changing Billing's default does not
silently change the top-up card without renewed consent. A separately chosen
top-up card is retained rather than replaced by the default.
