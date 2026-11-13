# Transfer orders and internal requisitions

## Document and detail

`/inventory/transfers` lists transfer documents, not individual ledger rows.
`/inventory/movements/[id]` follows the Lead/Deal detail layout: sticky status and
tabs, line-level progress in the main panel, responsibility/location metadata in
the sidebar, and immutable activity. `/inventory/movements` is a separate inventory
ledger screen for bill receipts, immediate transfers, adjustments and effective
transfer dispatch/receipt/return/writeoff events. Both screens belong to Operations.

New requests group one to 100 different catalog products with requested quantities,
source/destination, notes and an optional receiving responsible person. **Save
Draft** and **Request Transfer** never change stock. Existing pending immediate
transfers retain their original replay path rather than being converted silently.
Product discovery uses debounced server search and paginated catalog reads,
including child variants. Selected lines remain in the draft when search changes;
pending identical retries do not depend on reloading the selected catalog window.

## Lifecycle

Navigation resolves exactly one inventory module: `/inventory` selects Inventory,
`/inventory/movements` selects Inventory Ledger, and `/inventory/transfers` plus
the historical `/inventory/movements/[id]` detail route select Inventory Transfers.
Sidebar selection, recent shortcuts and screen-access keys share this resolver.

The detail follows the Lead/Deal layout: the next authorized lifecycle action
is rendered in the shell topbar, secondary cancellation/reconciliation actions
live in the identity options menu, and line content is divided from the sticky
about sidebar. Return/writeoff breakdowns are available per product under
Differences; the line status is shown next to the item rather than off-screen.

- `draft` → `requested`: submit an internal requisition.
- `requested` → `approved`: a site owner/admin authorizes the transfer.
- `approved` → `in_transit`: dispatch actual quantities. The source is debited;
  the destination is not credited. All lines are accounted for, including zero
  dispatched for unfulfilled products, and at least one must be dispatched.
- `in_transit` → `partially_received`: receive positive incremental quantities.
  Only actual accepted receipts are credited to the destination.
- `received`: every dispatched unit is received, returned or explicitly written
  off. This terminal status does not imply every requested unit was supplied;
  line-level differences remain visible.
- `cancelled`: allowed only before dispatch. No stock effect.

Receiving is limited to the assigned receiving user or a site manager, with
current update permission and location access. Approval and reconciliation require
a manager. Assigning responsibility never grants access. In this slice quantities
are not reserved by requests or approval; dispatch rechecks available stock.

## Differences and custody

Each line tracks requested, dispatched, received, returned and written-off units.
Outstanding in-transit units are `dispatched - received - returned - written off`.
Requested-versus-dispatched and requested-versus-received differences remain
visible independently of the document's status. Partial receipts can be repeated.

There is no arbitrary status picker that bypasses inventory effects. A manager
must reconcile outstanding units with explicit quantities and a reason. Returns
credit the source; writeoffs never credit either location. A post-dispatch cancel
cannot erase stock in transit. The workflow does not permit over-receipt beyond
dispatch; unexplained surplus needs a separately authorized inventory adjustment.

The transfer document lifecycle applies to warehouse/location transfers. Bill
receipts have a separate partial-reception contract: received quantities per bill
line and a named receiving user. They credit only actual received units and retain
the purchase's remaining quantities. They do not create a warehouse-transfer order.

## Safety and rollout

Creation and each transition use an actor-bound idempotency key. Updates require
the current document revision; concurrent/stale transitions fail without partial
effects. Stock changes, quantities, overall state, revision and activity commit
together in PostgreSQL. Reads are user-scoped and RLS checks both locations.
Writes authenticate and recheck permissions after the site lock. Private helpers
and request records are not executable/readable by browser or anonymous roles.

Forward migrations:

- `20261113210000_inventory_transfer_orders.sql`: document, lines, events and RPCs.
- `20261113210100_inventory_transfer_legacy_projection.sql`: groups previous
  immediate transfer ledger entries into received documents and projects future
  legacy immediate transfers, retaining the original rows and quantities.
- `20261113210200_partial_bill_inventory_receipts.sql`: per-line purchase receipt
  budgets, receiver attribution, partial receipt RPC and legacy safety guards.
- `20261113210150_inventory_transfer_partial_dispatch.sql`: permits unfulfilled
  product lines at dispatch while requiring at least one positive dispatched line.
- `20261113210300_inventory_transfer_stock_events.sql`: effective custody/stock
  events linked to transfer documents, shown on the separate ledger screen.
- `20261113210400_inventory_receipt_write_boundary.sql`: private receipt-write
  capabilities, canonical bill location preservation and effective owner/admin
  roles for transfer management, including licensed co-owners.
- `20261113210500_accounting_preserve_received_bill_lines.sql`: unchanged-line
  bill header edits without deleting received lines or their receipt references.

Projection does not move stock again. It groups legacy batches by site, request,
route and receiving responsibility. Review backfill volume before applying the
migration to an approved target. No remote migrations or deployment are performed
as part of local implementation.

The assistant contract `inventory_transfer_order` uses `/api/inventory/transfers`
with a delegated user JWT or cookie session. External registration is a separate
step; legacy bulk transfer tools still perform immediate stock transfers.

## Verification

```bash
npm test -- --runInBand __tests__/inventory
```

Disposable PostgreSQL tests exercise transitions, permissions, quantity
conservation, partial receipt, reconciliation, rollback, replay and concurrency.
UI/route tests do not establish browser visual acceptance or remote rollout.