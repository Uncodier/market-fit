# Inventory movements

## Workspace screen

`/inventory/movements` is the Inventory Ledger in Operations, with sticky filters,
search, sorting and pagination. It is distinct from `/inventory/transfers`, the
transfer order/requisition document list with **New Transfer**. Transfer details
remain at `/inventory/movements/[id]`. See [Transfer orders](INVENTORY_TRANSFER_ORDERS.md)
for status, requested/dispatched/received differences and responsibility rules.

The list shows the latest 1,000 authorized movement rows. Each row is a product
movement, not an entire document or batch. Immediate transfers, bill receipts,
signed adjustments and transfer lifecycle stock/custody events are distinguished
by type. Dispatch debits origin; receipt credits destination; return credits origin;
writeoff resolves in-transit custody without a second location debit. Names are captured
at creation. Existing stock and legacy transfers are not backfilled into history.

For a local visual preview, visit `/inventory/movements?demo=1`. The fixture
contains four sample locations and eight sample transfers. The page has no demo
banner; its preview URL and disabled submit action still identify the read-only
context. It never reads or writes live inventory. Selected demo workspaces
also use this read-only preview. Do not interpret these rows as operational data.

## Durable operations

[`20261113170000_inventory_movements.sql`](../supabase/migrations/20261113170000_inventory_movements.sql)
adds the immutable, RLS-protected movement history and atomic
`apply_inventory_operations` RPC. Only authenticated user sessions may execute it.
The caller needs update permission and access to every involved location; reads
need select permission and access to both endpoints. Privileged credentials are
not a supported tool transport.

The RPC serializes batches within a site and locks products and bill parents.
Stock changes, history and receipt flags commit together. A failing operation
rolls back the whole batch. Adjustment quantities are deltas, not absolute stock
levels, and cannot produce negative inventory. Receipt quantities come from
persisted product bill lines; service lines are excluded, and cancelled bills or
invalid product quantities are rejected. Receiving an already received bill at
the same destination does not add stock again.

A request UUID is bound to its actor and exact operations. Retain it and the
unchanged payload after an uncertain result. Confirmed identical replays return
`alreadyApplied: true`; conflicting reuse is rejected. Bill UI receipt additionally
uses the locked received flag to protect separate attempts with different IDs.

The movement dialog saves its input and request UUID to `sessionStorage` before
submitting, scoped by authenticated actor and site. An uncertain response locks
editing and retains that pending request across close/reopen and page reload.
Retry is explicit and uses the exact saved input; mounting never replays writes.
A rejection after an uncertain attempt cannot prove the earlier attempt failed,
so it does not release the draft. Storage failure prevents submission. This is
tab-scoped protection: closing the browser tab clears session storage, and separate
tabs are not coordinated. Resolve uncertain operations before retiring that tab.

[`20261113190000_inventory_writer_coordination.sql`](../supabase/migrations/20261113190000_inventory_writer_coordination.sql)
adds a post-lock authorization boundary and an atomic delta RPC shared by checkout,
post-payment, shipment decrements and cancellation restocks. These writers mutate
the locked current quantity rather than overwriting stock with an earlier read.
The delta RPC preserves each existing caller's floor-at-zero policy and raises
errors instead of falling back to sequential writes. Existing authorized server
commerce paths may use their server-only service client; assistant batch tools
still require the delegated user's authenticated client.

The legacy absolute inventory level setter and transfer RPC remain unchanged.
History records the new batch RPC and bill receipt action, not every older writer.
Atomic deltas do not add parent-order/shipment idempotency: those existing lifecycle
boundaries remain responsible for admitting each commerce effect once.

## Bill action and assistant tools

Bills offer **Receive stock** with a destination picker, receiving user and actual
quantities received now per product line. Purchased, received and remaining units
are separate. The server validates incremental quantities against persisted budgets;
prices and product identities are not client-controlled mutation fields.
The receipt destination is stored separately from the bill's immutable operational
location. Completed bills retain an explicit recovery entry point when the current
actor has an unconfirmed saved receipt; opening it never automatically retries.
Received bill lines remain immutable, while unchanged-line header edits preserve
their IDs, quantities and receipt references.
See [Inventory assistant API](INVENTORY_ASSISTANT_API.md) for bulk and bill tool
schemas, delegated user authentication and the external registration boundary.

## Rollout and verification

[`20261113200000_inventory_receiving_responsibility.sql`](../supabase/migrations/20261113200000_inventory_receiving_responsibility.sql)
adds server-validated receiving responsibility and the historical display name.
All migrations are forward-only and must be applied to a confirmed target through
the approved migration workflow before live operations can work. No application
code falls back to sequential writes if the RPC is unavailable. Existing bill
deletion or catalog/location deletion may be constrained by movement history;
retain history rather than deleting movement references.

No remote migration, deployment or real stock seeding is part of this change.
Review corrections additionally require
`20261113210400_inventory_receipt_write_boundary.sql` and
`20261113210500_accounting_preserve_received_bill_lines.sql`. The former protects
receipt flags and budgets with private transaction capabilities, preserves bill
scope for partial/legacy receipts, and uses canonical transfer manager roles.
The latter preserves frozen bill lines during unchanged-line accounting edits.
Both fail closed on unexpected prior RPC definitions and leave historical
location authorization wrappers intact. Apply all migrations in timestamp order.
Local PostgreSQL tests use a disposable socket-only database, not environment
database URLs. Unit/route tests use mocked boundaries, not mock production APIs.

```bash
npm test -- --runInBand __tests__/inventory __tests__/purchases/actions-security.test.ts __tests__/purchases/actions-compilation.test.ts
```