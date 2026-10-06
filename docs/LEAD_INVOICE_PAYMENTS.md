# Lead invoice balance payments

The individual lead's three-dot menu, in both the list and detail header, exposes
**Settle balance / Add payment**. Company-wide menus deliberately do not apply a
payment across different leads.

- **Full balance** settles every accessible open invoice in the selected currency.
- **Partial payment** settles invoices newest-first (`sale_date`, `created_at`,
  then ID, descending). The remainder is applied to the next invoice, even if it
  does not fully settle it.
- Only `pending` or `completed` sales with a positive `amount_due` are eligible.
  Cancelled and refunded invoices are excluded. Subscription invoices stored as
  sales participate when they belong to that lead.
- Currency balances are separate; the flow does not convert or combine currencies.
- The action records money already received. It does not initiate a Stripe charge,
  bank transfer, or other external money movement.

## Server and database boundaries

[`payment-actions.ts`](../app/leads/payment-actions.ts) validates inputs and requires
authenticated accounting update access. Marketing and demo users cannot record
payments. The RPCs enforce identity, site authorization, lead ownership and
assigned-only invoice visibility independently. Client-side allocation is a preview,
not the source of payment amounts or status transitions.

[`20261006220000_lead_invoice_payments.sql`](../supabase/migrations/20261006220000_lead_invoice_payments.sql)
adds the snapshot RPC, transactional payment RPC, and protected request ledger.
It depends on the existing site role helpers and accounting receipt lifecycle
triggers. The migration must be reviewed and installed in the intended target
before this action is available; no remote migration is applied by local tests.

The payment locks the lead and invoices, checks the loaded snapshot version,
recalculates the total/allocation, and appends one dated receipt per affected invoice.
All receipts, balance/status changes and the idempotency result commit together.
Any failure rolls back the whole allocation. Existing payment history, including
server-managed inferred legacy receipts, is retained by the accounting trigger.

Retries must reuse the request ID and original details. A replay returns the original
result without applying another receipt; changing the payload for the same request
is rejected. A stale snapshot is rejected instead of silently changing what the
user confirmed. Reload invoices and review the new allocation after a stale error.

When confirmation is interrupted, the dialog locks the details and dismissal until
the same request is retried. A browser-leave warning is installed. The request ID
is kept in the mounted dialog, not persisted across navigation or site changes;
do not leave or switch sites before resolving an uncertain payment. If the tab is
lost, reconcile the recorded invoice receipts before entering that payment again.

After commit, existing accounting and paid-order synchronization run for affected
sales. These secondary operations do not roll back receipt persistence; explicit
failures are reported as **payment recorded, review required**, never as unpaid.
Accounting sources remain pending when posting needs repair, following the existing
accounting lifecycle. No external-provider or browser mutation tests are run against
production as part of this feature's validation.

## Validation

```bash
npm test -- --runInBand __tests__/leads
```

The migration suite creates a disposable socket-only PostgreSQL cluster, independent
of configured database URLs. It uses `/opt/homebrew/opt/postgresql@17/bin` when present
and skips its live database cases when the local binaries are unavailable.