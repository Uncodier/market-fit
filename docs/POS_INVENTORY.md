# POS inventory availability

The POS evaluates inventory-mode catalog items against the selected origin
location. With no selected location, catalog availability uses the sum across
locations; the existing checkout gate still requires an origin. Missing stock
rows mean zero, not permission to use another location's inventory.

## Stock shortage policy

The existing **Inventory → Commerce Policies → Stock Shortage Policy** setting
(`settings.commerce.stock_shortage_policy`) controls shortages:

- `block`: show **Sold Out** and reject additions or quantity increases beyond
  available stock, including numpad edits.
- `allow` / `warn`: show **Backorder**, permit the shortage, and notify the cashier.
  Only the quantity above available stock is marked as backordered.
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