# Subscription invoice settlement and recovery

Subscription invoices use `settle_stripe_subscription_invoice` from
`20261002210954_atomic_stripe_subscription_invoices.sql`. Deploy this migration
before deploying the invoice handlers. It does not charge Stripe or create a
subscription.

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
  credits and adds to the current balance rather than assigning a stale balance.
- Initial and renewal invoices grant 20/100/500 base credits for
  engine/foundry/enterprise plus 5 per add-on. Prorations do not grant another
  monthly allowance.
- A failed payment row can become completed. Repeated failures update the same
  row. Completed payments never become failed because of a delayed event.
- Historical completed payments without a settlement marker are ambiguous:
  older credit functions did not always write a ledger. They fail closed for
  operator review instead of automatically receiving a second allowance.
- Legacy monthly renewal jobs must skip Stripe-backed subscriptions at selection
  and execution. Their queued arguments alone are not a reliable ownership check.

## Authorized incident recovery

1. Verify the target project and obtain approval for the migration, deployment,
   and specific invoice recovery. Never accept invoice state or amounts from a
   browser request.
2. Run the handler and disposable PostgreSQL tests. Apply only this migration;
   this repository is not a complete bootstrap history, so do not blindly push
   all historical migrations.
3. Deploy the new handlers and the monthly renewal ownership guard before
   replaying financial side effects.
4. Retrieve the invoice and customer using the production Stripe SDK. Confirm
   paid status, site, customer, subscription, amount, currency, billing reason,
   and the already-existing payment row. Review historical credits and renewals.
5. Invoke `syncStripeSubscription`, followed by
   `settleStripeSubscriptionInvoice` with `requirePaid: true` and the expected
   customer/subscription. These are the same server-side helpers used by the
   webhook. Supply the original event ID only as audit context; do not forge a
   provider event or erase the webhook delivery history.
6. Verify one completed payment, one settlement, one credit ledger entry, the
   canonical active plan and unchanged consumed credits. Repeating settlement
   must return `duplicate` with zero additional credits.

Do not create a replacement subscription or retry charging a paid invoice.
Do not reset the entire credit balance or indiscriminately reprocess historical
completed invoices. Keep customer identifiers and credentials out of committed
scripts, fixtures and documentation.

## Validation

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