# Late-paid invoice: plan credit recovery audit

**No credit grant was made.** The operator SQL is a read-only audit, not a migration, API endpoint, or recovery command. The operator needs authorized read access to the internal Stripe proof, settlement, reservation, and billing tables; browser and ordinary service roles cannot run the audit. Do not grant new privileges to run it.

## Reconciliation

Deduct only verified plan-bucket usage from the invoice allowance. A prior-period
expiry, a zero-net reset and a zero settlement of an already classified hold are
not additional usage. Do not also deduct amounts paid from a cash balance, or
turn expired plan credits into purchased, trial, or other non-expiring funds.
Use the **invoice service end** for the credit deadline, not a later access-only
extension or the ordinary Free calendar reset. Keep customer-specific balances,
identifiers and event times in the private incident record, not this repository.

## Read-only SQL

Use `scripts/audit-late-invoice-plan-credits.sql` with `psql -X`, passing `site_id` and `invoice_id` via `-v` from independently verified incident records. Never select a tenant by display name. Use a separately approved read-only connection; the script also enforces a repeatable-read, read-only transaction and rolls back. It checks the canonical invoice settlement against the Stripe proof, tenant/subscription binding, reversal and retirement records, current credit window, classified ledger, and the image reservation's final state. A missing proof, reversal, expired service, or unreconciled ledger is a stop condition. The output contains billing amounts and internal IDs; keep it in the restricted incident record. `reconciled_no_safe_existing_writer` reports a theoretical amount, **not** authorization to apply it. The script also reports the relevant installed PostgreSQL function body fingerprints and the billing credit trigger's enable state for comparison with the reviewed definitions.

## Why not run a one-off update

1. `guard_billing_credit_buckets()` pins a terminal subscription's plan allowance to 1, including operator updates. Changing the available amount alone leaves a 1-credit ceiling for reservation reversals; the current refund functions cap what they restore using the stored allowance. Do not disable the trigger or alter subscription state to bypass it.
2. `reset_site_plan_credit_period()` refuses the same or an older start. Moving the start to force a reset clears usage counters, and changing period boundaries can invalidate existing reservations' same-period checks. `settle_stripe_subscription_invoice()` intentionally credits zero for the canceled subscription and does not turn replay into a credit grant.
3. The ordinary credit renewal/expiry path does not check late-invoice reversal tombstones. `revoke_stripe_late_renewal_access()` inserts a tombstone, not a plan credit ledger change. An operator grant in the current plan balance therefore has no atomic, attribution-safe reversal path. A stale or concurrent renewal, replacement subscription, usage, or reservation settlement also can't be handled by an invoice audit row alone.

A grant would require a separately reviewed forward-only change, not a repair script: bind recovery exactly once to the invoice and charge; serialize with the billing row and reversal path; make the recovered plan amount unusable at invoice service end or after reversal across every spend and reservation path; and verify that later expiry, replacement, and reservation settlement neither refill the amount nor debit protected funds. Preserve paid settlement and coverage facts, all usage counters, the subscription identity/status, and the ordinary free-plan renewal schedule. No grace-team files are needed for this audit.

## Local verification

```sh
npm test -- --runInBand __tests__/security/late-invoice-plan-credit-audit.test.ts
```

The suite uses a socket-only disposable PostgreSQL instance, coordinated checked-in billing migrations from the sibling API workspace, and synthetic records. It does not connect to Stripe or the incident database.