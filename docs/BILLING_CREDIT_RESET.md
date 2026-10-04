# Monthly included credits and protected balances

The coordinated credit migration is stored in the sibling API repository:
`../API/supabase/migrations/20261003230000_credit_buckets_and_monthly_reset.sql`,
`20261003230001_stripe_plan_credit_reset.sql`, and
`20261003230002_classified_credit_operations.sql`. Apply them in that order only
through the approved, explicitly authorized database-owner workflow. Do not apply
both copies of a shared migration or deploy only one of the three repositories.

See `../API/docs/BILLING_CREDIT_RESET.md` for audit/backfill and coordinated
API/market-fit/Temporal rollout details. No remote migration or deployment has
been performed by creating these files.

Included plan credits reset rather than accumulate. Toolbox (`commission`, with
legacy `free`/`toolbox` aliases) includes one monthly credit; Engine includes 20,
Foundry 100, Enterprise 500 and paid addons five each.
One-time signup30 is idempotent and expires at the first UTC month boundary.
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

Focused application regression command:

```sh
npm test -- --runInBand __tests__/api/stripe-subscription-billing.test.ts __tests__/api/stripe-invoice-credit-period.test.ts __tests__/api/credit-purchase-settlement.test.ts __tests__/api/partner-license-credit-safety.test.ts __tests__/services/billing-contact-save.test.ts
```

These tests are offline and use synthetic accounts. The API suite executes actual
SQL in memory and in a disposable socket-only PostgreSQL cluster, including
concurrency, authorization, monthly boundaries and protected-balance preservation.