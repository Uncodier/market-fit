# Accounting integrity and rollout

## Write boundaries

- Accounting Server Actions verify the authenticated user and the role for the
  requested site. Marketing is read-only; collaborators may create/update;
  owners/admins may delete. Demo accounting is read-only.
- Manual journals and opening balances use an authorized, transactional RPC.
  Updating requires the loaded source hash; stale forms cannot overwrite newer
  data. Existing manual/opening currencies cannot be silently relabeled.
- Generated journals are not writable client payloads. A server-only source
  loader reads the authorized sale, transaction, or purchase, generates its
  complete journal set, and calls a service-only atomic replacement RPC.
  The source revision is checked while locked. Failure preserves the old set.
- Editing purchase lines and their header also uses a single version-checked RPC.
  It calculates the total from quantity/cost and preserves the locked amount paid.
  Item changes and payment changes must be saved separately.
- Deleting a sale, purchase, or expense uses `accounting_delete_source`; the source
  and its journals commit or roll back together. Sales with refund receipts are
  retained for audit. Paid/previously posted purchases cannot return to draft.
- Authenticated direct writes to journal headers/lines are revoked by the new
  migrations. Server callers must also use the RPCs, not separate deletes and
  inserts. Important amounts, accounts, dimensions, and balance rules are checked
  in PostgreSQL as well as the application.
- Company records are a global registry in the current schema, not site-owned
  rows. Generated company attribution comes from the authorized source document;
  the other journal dimensions must belong to the source site.

## Posting model

- A sale recognizes receivables and revenue/tax on its original accounting date.
  Receipts settle receivables on their own recorded dates. Purchases similarly
  recognize accounts payable, then settle it on payment dates.
- Recorded excess receipts/payments are retained in Customer advances (`2300`)
  or Supplier advances (`1300`); they do not disappear after discounts.
- Legacy sources with no payment history can use the balance-derived paid amount
  at the original date. This is a compatibility fallback, not reconstructed cash
  history. A nonempty payment history with missing dates or inconsistent amounts
  requires review instead of invented dates or dropped cash.
  A purchase reduction that would create an overpayment from an undocumented
  legacy receipt is rejected until the receipt history is repaired.
- On a later payment update, a database trigger preserves that existing inferred
  balance as a server-managed `legacy_inferred` item dated at the original source
  date. It is explicitly labeled `legacy_balance`, not represented as a verified
  bank receipt. This preserves earlier ledger behavior while new receipts retain
  their actual dates; inconsistent or undated recorded receipts still need review.
- Order-linked promotion discount transactions are analytical costs only. Net
  sales already reflect those discounts, so these rows do not create another
  expense or cash outflow. Standalone promotion spending remains an expense.

- Successful Stripe refunds are recorded by refund ID and original refund date,
  including partial refunds. Replays do not duplicate refunds. A refund does not
  delete the original sale or its receipts. A dispute is not proof of a cash
  refund and must not be represented as one.
- Cancelled sales with dated refund evidence can post the original recognition,
  receipts, and refund. Cancelled sources without that evidence require an
  explicit correcting entry/review rather than erasing past postings.
- Explicitly unpublished sources are not silently republished by automatic sync.
  Period sync also considers updated sources and dated payments/refunds, so an
  older invoice's new receipt can be found in the receipt period.
- Source invalidation is limited to accounting-relevant fields. Sending an email,
  rotating a document token, or updating fulfillment-only metadata does not mark
  the journal pending. Existing pending journals are retried on subsequent edits.

## Subscription invoice payments

The subscriptions list shows linked unpaid invoice counts and balances, with
separate totals per currency. Cancelled/refunded invoices and zero balances are
excluded; cancelling a subscription does not erase existing receivables.
`Register payment` records one partial or full manual receipt, not a Stripe charge.
It is disabled without update permission or an outstanding invoice.

`app/subscriptions/register-payment.ts` verifies identity, site role, and the
subscription/invoice relationship with the user-scoped client. It computes the
balance from persisted data and saves receipt, balance, and status in one
conditional update. Stale requests cannot overwrite another payment. Identical
request IDs can be retried without duplicating receipts; interrupted confirmations
lock form details until retried. Retries also repeat existing accounting/linked-order
recovery. Secondary errors are warnings, not failed payments. The flow uses the
existing sales/subscription foreign key and adds no migration.

## Chart and opening balances

Chart initialization is an explicit action, not a side effect of viewing reports.
Custom accounts support asset, liability, equity, income, and expense types.
Codes/keys must be unique within the site. System and referenced classifications
are protected. Inactive accounts are unavailable for new manual lines.

Opening balances must finish loading before editing or saving. Equity (`3000`)
is an explicit read-only balancing figure. Empty/all-zero submissions are rejected
rather than interpreted as deletion. The existing currency and version are kept.

## Reports

See [Finance report contract](../app/finance/README.md). Reports select one
currency, never implicitly convert, and use complete UTC calendar-day ranges.
Production aggregates come from one `STABLE SECURITY INVOKER` database function
and one MVCC statement snapshot, not offset pages. The scalar JSON response is
not limited by the API row cap. Unknown historical currencies and malformed
journals block affected reports with a reconciliation message. Errors hide totals
instead of showing an apparently balanced zero report. CSV exports include the
selected currency. Demo-only reads continue to use the demo adapter.

## Remaining accounting policy boundary

Purchases capitalize product inventory, but automatic sales do not guess a
valuation method or use today's catalog cost to reconstruct historic inventory
costs. Until an approved periodic inventory adjustment or immutable unit-cost
valuation workflow is supplied, post inventory/COGS adjustments explicitly.
Physical stock decrements are not evidence of a corresponding cost journal.
This change does not claim perpetual inventory valuation or period-close support.

## Safe rollout

1. Review the forward-only `2026092922*` accounting migrations and test them in an
   isolated PostgreSQL/Supabase environment. Application changes depend on them;
   do not deploy the application alone.
2. Inspect duplicate account keys, invalid/empty/unbalanced journals, NULL or
   inconsistent currencies, missing payment dates, and unclassified accounts.
   The migrations do not rewrite the historical ledger. Duplicate keys block
   the unique index and require an explicit operator-approved correction.
3. Apply the migrations only with explicit approval for the target database.
   The security migration revokes old direct-write paths; coordinate the web
   release and every other accounting writer in the same maintenance window.
4. Reconcile historical totals and approve selected source re-synchronization.
   Rebuilding legacy source journals can change how cash is allocated across
   dates, and order-linked discounts remove prior duplicate cash expenses.
5. Historical Stripe partial refunds need a separately approved backfill from
   successful Stripe refund records. New webhook handling cannot recover events
   that have already been acknowledged and will not be delivered again.
   Subscribe the Stripe endpoint to `refund.created`, `refund.updated`, and
   `refund.failed` alongside `charge.refunded`. The deprecated
   `charge.refund.updated` event is accepted for compatibility. Status events
   re-fetch the current charge/refund state so delayed or reordered notifications
   cannot silently omit a refund that later succeeds.
6. Verify owner/admin/collaborator/marketing and cross-site denial, failed-save
   rollback, concurrent edits, multi-currency reports, and webhook retries.

No remote migration, historic backfill, deployment, or production build is part
of the local implementation/validation workflow.