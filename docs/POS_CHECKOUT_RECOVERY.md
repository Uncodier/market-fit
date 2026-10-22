# POS checkout recovery

## Operational behavior

Collected payments are never replayed blindly after a failure or timeout. The
queue's **Check payment status** action reads server evidence using the original
mutation and receipt IDs. It does not collect money, delete a queue entry, cancel
an order, issue a refund, or mark incomplete checkout as successful.

| Evidence | Local outcome | Other orders | Register closing |
| --- | --- | --- | --- |
| Completed checkout | Synced, restored result | Allowed | Allowed if all receipts settled |
| All exact receipts recorded, incomplete checkout | Failed, payment recorded/review required | Allowed | Blocked |
| Durable rejection before checkout writes | Failed, rejected for audit | Allowed after reviewing/reloading the order | Allowed |
| Missing/partial/mismatched evidence or processing | Failed, review required | Blocked | Blocked |

An unresolved recorded payment blocks further payment of that same order, even
if a new mutation ID is supplied. A rejected attempt remains visible and immutable
in the queue; a newly confirmed attempt uses new mutation and receipt IDs. The
workspace queue offers **Review order** in a read-only dialog backed by the
authenticated, site-scoped POS order read. Paid, cancelled, and incomplete orders
can be inspected without selecting the unpaid-only payment cart, collecting money,
or changing queue state. Refreshing the review reads the server again; it does not
prove checkout finalization. Top-bar consumers can show diagnostic IDs without
owning the order-review callback.

Do not clear IndexedDB or browser storage to recover a register. Do not collect
again merely because checkout returned an error. Existing refunds remain separate
financial actions; recovery does not invent a refund or reverse accounting.

## Server boundaries

`app/pos/actions/reconcile-checkout.ts` validates request shape, authenticates and
requires an authorized POS role and unrestricted location access before using a
server-only, read-only service client. Receipt verification checks the original
actor, site, shift, IDs, amounts, methods, tendered/change, and linked order. A
client-provided total or tenant ID never proves payment state.

The forward-only migration
`20261022140000_pos_checkout_attempt_recovery.sql` introduces server-owned durable
admission and guarded transitions. The same identity/payload cannot be reassigned;
one unresolved attempt per existing order is admitted. An expired/abandoned
attempt is not automatically considered unapplied. Post-write failures enter
review rather than restarting checkout.

For collected payments on existing orders, a service-only commit RPC applies
server-calculated sale/order patches, captures register receipts through the
existing trigger, and links the attempt in one transaction. It locks rows, checks
complete expected sale/order snapshots, reauthorizes the admitted actor, and
rolls all writes back if either update fails. New-order creation still uses the
existing persistence path, protected by durable admission; it is **not** made
fully transactional by this change.

Kitchen progress alone no longer invalidates the payment baseline. Cancellations,
prices, quantities, payment evidence, attribution and notes still do. Notes are
retained in the baseline to prevent lost instructions. Unpaid partial payment
does not regress a completed kitchen order to pending.

## Limitations and recovery of legacy incidents

Legacy attempts have no durable admission. Exact receipts can establish recorded
money; missing receipts cannot establish that an old request never ran. Legacy
receipts with no stable UUIDs require manual financial review. A recorded receipt
does not prove that reservations, promotions, stock, subscriptions or entitlements
all finalized. This change deliberately does **not** replay those effects or
automatically mark such an attempt completed. Repair demonstrated missing effects
through authorized workflows before closing the affected register.

Checkout's broader finalization is not a fully transactional/idempotent saga.
Concurrent non-checkout order-line writers remain a separate boundary; snapshot
validation and admission do not replace a global order-edit transaction protocol.
The browser queue check covers the current device, not every cashier's device.

## Rollout and validation

### Production rollout, 2026-10-22

The application deployment for commit `cb13babe` reached Ready on the workspace
production domain. The Management API applied the forward correction and recorded
version `20261022201051` (`complete_pos_checkout_recovery`). The local filename
matches that server-assigned version; the applied SQL is unchanged. The original
`20261022140000` migration is not recorded remotely because older admission objects
were already installed outside that history. Do not replay it against this target.

Post-application checks confirmed the eight-argument RPC is visible in PostgREST,
the obsolete six-argument overload is unavailable to API roles, and RLS/table/RPC
grants remain server-only. No historical order or receipt was changed. POS browser
tabs must reload to retire the old action bundle. The informational
[RLS-without-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
for the attempts table is intentional: browser roles have no grants and only the
authorized server workflow can access admission evidence. These checks are not a
live paid checkout test or proof that the affected device's queue has reconciled.

1. Review/apply the complete migration to the explicitly approved target using the
   established migration workflow. No backfill, historical receipt edits, or
   automatic legacy voids are included.
   For partially installed admission objects or the obsolete six-argument commit
   RPC, use `20261022201051_complete_pos_checkout_recovery.sql`. It validates the
   existing table, preserves attempts, installs the snapshot-aware commit, and
   revokes API execution of the obsolete overload without dropping it.
2. Deploy matching server and browser code, then reload POS tabs to retire old
   replay loops. Stop old in-flight checkout requests before targeted incident repair.
3. On the affected device, choose **Check payment status**, then **Review order**.
   Recorded-but-incomplete attempts still need manager review before closing.

Missing migration/RPCs fail closed. Do not deploy browser/server changes without
the migration. Local tests never use a remote database or live payment provider:

```bash
npm test -- --runInBand __tests__/pos __tests__/commerce/checkout-finalize.test.ts
npm run typecheck
```

`__tests__/pos/checkout-attempt-postgres.test.ts` executes admission, replay,
concurrency, authorization, atomic receipt persistence and rollback in a new
socket-only PostgreSQL cluster using the existing isolated test harness.