# POS inventory availability

The POS evaluates inventory-mode catalog items against the selected origin
location. With no selected location, catalog availability uses the sum across
locations; the existing checkout gate still requires an origin. Missing stock
rows mean zero, not permission to use another location's inventory.

## Stock shortage policy

The existing **Inventory → Commerce Policies → Stock Shortage Policy** setting
(`settings.commerce.stock_shortage_policy`) controls shortages:

- `block`: show **Sold Out**. Additions or quantity increases beyond available
  stock open the shortage-resolution dialog, including numpad edits.
- `allow` / `warn`: show **Backorder**. New shortages also require the cashier to
  choose a resolution; existing backorders retain their shortage markers.
- Missing policy preserves the existing `allow` default. Invalid policy or
  failed inventory reads do not produce an apparently valid empty snapshot.

Manual unavailable items remain blocked regardless of policy. `always` and
manual available items retain their explicit availability behavior;
`track_inventory` alone does not override their configured availability mode.

Variants use their own SKU inventory, and a parent is selectable when an eligible
variant can be added. Repeated SKU lines and modifier quantities share the same
stock allowance. Modifiers consume their quantity multiplied by host quantity.
Changing location or synchronizing new stock recalculates cart warnings and
blocks checkout if the cart no longer satisfies the policy. Reducing/removing
an invalid line remains possible.

### Resolving a new shortage

For physical inventory items with known stock, the cashier can:

- **Add as completed**: explicitly acknowledge that the newly added units and
  their extras were already fulfilled. Only the new cart delta becomes completed;
  the existing line is unchanged. Payment is still required. Server-authorized
  checkout persists completed line/unit status and `metadata.completed_without_stock`;
  these units are excluded from subsequent stock deduction, shipment and restock.
- **Create purchase requisition**: save a real procurement draft for review and
  submission. The catalog determines valuation, not the POS sale price.
- **Request transfer from another location**: offered only for authorized snapshot
  locations with stock, requesting up to the available quantity when only part of
  the shortage can be supplied. The existing transfer workflow
  requires approval, dispatch and receipt; the request itself moves no stock.

Requests require online access and their existing server permissions. Neither
request changes the cart or claims inventory has arrived. The dialog links to the
created document. Cancelling leaves the cart unchanged. Unknown stock, manual
unavailability, reservations, digital/account products and dynamic quotes do not
gain an inventory override. Subsequent increases require a new decision.

Purchase requisitions use the existing procurement permissions and whole-unit
quantity contract (fractional shortages round up). Their legacy creation RPC is
not idempotent: uncertain writes block another attempt in the dialog and link to
the requisition list for review. Transfers retain their actor-bound idempotency
key for retries. Reopening a cancelled dialog starts a new request; review any
unconfirmed purchase first.

### Collecting completed orders

Persisted completed quantities are not counted as new inventory demand when
collecting an existing POS order. The server independently reads fulfillment
under the user's site/order access, matches persisted host/modifier identities,
and caps the availability credit at actual completed units. New lines and excess
quantities still undergo normal availability checks. Client completion quantities
are only display hints, never server authorization or proof of a stock debit.

POS stock accounting uses `order_line_inventory_receipts`. Fulfillment status
does not determine whether to debit stock: the atomic RPC processes the full
persisted line quantity against its prior processed high-water mark. Payment
after operational completion therefore performs the first debit; repeated
collection or shipment processing cannot debit those quantities again.

The receipt separately tracks processed demand, actual units removed and actual
units refunded. Floor-zero shortages remain collectible; a replay after stock
replenishment cannot charge the shortage again, and refunds cannot invent units
that were never removed. Refund requests fence future new debits, including when
the original actual debit was zero. Cancellation retries resume receipt-based
refunds even if the order status was already saved as cancelled.

Shipments receive all eligible unassigned lines, including partially completed
fulfillment, not a quantity reduced by fulfillment status. Already assigned lines,
cancelled lines and explicit no-stock completions are excluded. Conditional
assignment cannot silently move a line from another shipment. Shipment debit and
refund use the same per-line receipt budget as checkout.

### Migration and historical reconciliation

Deploy `supabase/migrations/20261114000000_order_line_inventory_receipts.sql`
before the updated application, after target-schema verification and explicit
approval. New ordinary POS lines receive a known-zero receipt in their insert
transaction. Other commerce and self-service retain their existing inventory
owners. Stop old application writers during rollout: they do not update receipts.

Historical lines without receipts are not backfilled from completed/payment
status or shipment flags. Their first use creates a durable review record and
moves no inventory. POS collection succeeds with `inventoryReviewRequired`; the
confirmation and persisted sync queue warn the cashier not to collect again.
Shipping and restocking stop for reconciliation rather than claiming success.
An operator must verify actual movement history before resolving a review record.
No remote migration or historical reconciliation is performed by local tests.

The service-role-only `resolve_order_line_inventory_review` RPC accepts
`p_site_id`, `p_order_id`, `p_line_id`, `p_location_id`, `p_processed_quantity`,
`p_actual_debited_quantity`, `p_actual_restocked_quantity` and `p_reason`. Use it
only in an approved operator session after verifying the target and evidence.
The reason must identify the operator and evidence (20–2000 characters).
Quantities must satisfy `0 <= restocked <= debited <= processed <= 1e9`.
This attestation moves no stock; it records the known historical budget, reason,
timestamp and available actor identity. It only resolves a review receipt and
cannot overwrite an already known budget. Browser roles cannot execute it.
After attestation, retry the inventory operation, not the payment collection.

For an operationally completed old order with verified **no previous stock
movement**, all three historical quantities are zero. For a verified prior
debit, record both processed demand and actual removed units; they can differ
when stock was floored at zero. Never set these values from order status alone.

## Synchronization and server validation

Online semantic suggestions are separate from immediate local name/SKU matching.
They cannot insert search response data into the cart: only matching, synchronized
same-site snapshot items pass through existing availability checks. Missing or
changed snapshot items require the normal catalog sync first. Offline search and
checkout are unchanged. See [Shared catalog search](CATALOG_SEARCH.md).

### Instant cart and option interactions

Product clicks use the loaded site-scoped snapshot, including hidden variants
and modifier groups. Simple products update the local cart immediately; the click
does not query the server or IndexedDB to discover choices. An empty modifier map
is authoritative. Legacy parents without variant metadata are detected from their
cached child SKUs. Stock checks still run synchronously before a cart edit.

Option dialogs render cached variants and extras on their first frame, rather
than briefly showing a loading skeleton. Taxes are also loaded into memory with
the catalog so product, extra, quantity, and tax totals update together. Catalog
synchronization refreshes those in-memory values. Server pricing, inventory, and
payment validation remain authoritative when the order is synchronized.

Heavy dialog code is warmed during idle time without mounting closed dialogs.
Opening before a chunk is ready shows a cancellable dialog skeleton instead of
an unresponsive click. Read-only reservation availability is prefetched only for
the selected reservable item, using the existing slot cache and in-flight request
deduplication; it is not a reservation or permission to skip server validation.

The authorized POS snapshot includes site-scoped inventory and policy in IndexedDB.
The visible POS loop checks every 30 seconds and performs a full background
refresh once the last successful snapshot is five minutes old, even if the catalog
revision is unchanged. Lightweight revision checks do not reset that deadline.
Missing/invalid snapshot timestamps also require a full pull. These recovery
reads bypass the Redis snapshot cache, retain the observed revision locally, and
still load products, services, prices, variants, modifiers, taxes and inventory
through the existing authorized readers. A returned or thrown revision failure
does not prevent the full snapshot fallback.
The revision optimization uses the authenticated, same-origin, no-store
`GET /api/pos/catalog-revision` reader rather than the browser's Server Action
queue. Its complete client wait, including JSON parsing, is capped at eight
seconds. Timeout aborts that read and proceeds with the authorized snapshot
fallback; late revision responses cannot update local data. Read deduplication
is per site. Aborting the HTTP wait is not proof that server-side work stopped.
If recovery could not observe a revision, the next successful revision check also
bypasses the snapshot cache before persisting that revision, preventing stale
cached data from replacing the freshly recovered snapshot.

Reconnection triggers a full sync; focus/visibility return checks freshness.
The reconnect refresh remains pending across permission suspension and workspace
unmount, and is consumed only by a successful full download after verified access
returns. A failed download or another disconnect does not clear that intent.
Catalog requests have per-site admission slots so an old site's outstanding
request cannot suppress the selected site's pull. Failed downloads do not replace
the last successful local snapshot or advance its freshness; the next eligible
background tick retries. This is nonblocking synchronization while the POS is
open and visible, not a service worker or permission to read data after access
expires. Existing online permission leases and server checkout checks still apply.

Catalog status is part of the existing top-bar sync widget, not a separate strip.
The badge shows revision checks, download or local saving with elapsed time, then
retains the last successful duration. Clicking it opens catalog details with the
completion timestamp, duration, and whether the read bypassed the snapshot cache.
It includes catalog refresh and the existing queued-operations entry point.
Catalog failures show retry information separately from order/outbox failures.
Historical local snapshots show their stored timestamp, not an invented duration.
Timing is session-local, measured with a monotonic clock, and cleared with permission
state; widget subscriptions and displayed details are isolated by site.
Permission invalidation immediately notifies widget subscribers with a sanitized
unverified state: no previous completion timestamp, duration or queue counts, and
catalog refresh is disabled until online access is verified again. Outstanding
snapshot/queue operations retain their actual admission slots until they settle;
invalidated operations cannot publish a late success.

Stock is read outside the catalog Redis cache. The existing catalog revision now
includes stock quantities, locations and commerce settings, including writes that
do not advance inventory timestamps. A checkout sync attempt triggers a forced
catalog refresh. Old local snapshots without inventory display **Stock unknown**
and block inventory-mode additions until synchronization succeeds.

Offline availability uses the last successful snapshot; it is not a stock
reservation. Checkout re-reads backend stock and policy using the resolved origin
and validates combined SKU demand before persisting records. A server rejection
remains visible in the existing POS sync issues workflow.

## Existing order line changes

Removing a product from an existing POS cart is persisted when the updated order
is sent or checked out and the outbox synchronizes successfully. Draft lines are
deleted; already sent lines remain as cancelled history. Their units follow the
existing database lifecycle. Failed line removal is reported as a sync failure,
not a successful update.

Checkout invalidates the shared `order-data` list cache after persisting its lines
and revalidates Orders, the order detail, and Order Lines. The detail also reloads
on realtime changes and tab focus/reconnection. An empty relational item list is
authoritative; it must not fall back to stale serialized products. Orders product
summaries exclude cancelled lines, while detail status controls and product
search retain the cancellation history.

## Backorder scope

### Explicit completion without stock

The shortage dialog's **Add as completed** choice is different from a backorder.
The POS payload retains `completedWithoutStock: true` on the new host line;
modifiers inherit it. The server authenticates POS access and still validates
same-site active catalog items, variant selection and policy. This choice does
not permit manual-unavailable, reservation, recurring, digital or dynamic-price
items. Public and other checkout sources cannot request it.

Authorized lines persist with `status = 'completed'`,
`metadata.completed_without_stock = true`, and `backorder_quantity = 0`.
Existing order-line unit triggers propagate the completed status. Completion is
fulfillment, not payment: unpaid totals remain collectible. The serialized order
items preserve the marker. The inventory receipt migration above is required.

Explicit lines and inherited modifiers consume no inventory during checkout or
shipment, and cancellation does not add fictitious stock for them. Ordinary
lines retain normal stock validation and atomic floor-zero inventory deltas.
Paying an existing completed line credits only server-verified persisted
fulfillment quantities, not client status claims. This does not introduce a
stock reservation or change the existing shipment concurrency limitations.

The server persists its calculated `metadata.backorder_quantity` in
`sale_order_items` and the serialized `sale_orders.items` representation. Client
stock or backorder claims are not trusted. The POS displays shortage quantities
and recalculates them when editing a restored order.

This is a shortage marker, **not a new fulfillment lifecycle**. Existing order,
payment, shipment and inventory-decrement behavior remains unchanged. Automatic
replenishment/fulfillment, stock reservation across offline carts, and atomic
protection against concurrent checkouts are not introduced by this change.

## Demo POS data

The three built-in demo sites load POS catalog snapshots through the existing
demo client. Its `current_user_site_role` RPC resolves the seeded user's role
only within the selected demo; other demo sites, real site IDs, unknown demos,
and archived sites do not grant access. Real POS authorization is unchanged.
POS modifier reads authorize the requested site before using a service client
for real accounts; demos reuse the authorized in-memory client and never query
real Supabase for modifiers.

HabitUall includes four POS items and two locations; SaaS includes the onboarding
service and one location. Both use explicit always-available items. Ecommerce
includes six top-level products, two variants, and seven stock rows totaling
152 units across two locations. Each demo has an active POS price list.

The snapshot regression test uses the real demo query client and catalog,
inventory, pricing, and tax actions, replacing only the Supabase client factory
and Redis transport. Demo data is not evidence of a real authenticated sale.

## Verification

```bash
npm test -- --runInBand __tests__/pos __tests__/catalog __tests__/commerce
npm run typecheck
```

These are local regression checks, not evidence of a live authenticated POS sale.