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

The authorized POS snapshot includes site-scoped inventory and policy in IndexedDB.
Stock is read outside the catalog Redis cache. The existing catalog revision now
includes stock quantities, locations and commerce settings, including writes that
do not advance inventory timestamps. A checkout sync attempt triggers a forced
catalog refresh. Old local snapshots without inventory display **Stock unknown**
and block inventory-mode additions until synchronization succeeds.

Offline availability uses the last successful snapshot; it is not a stock
reservation. Checkout re-reads backend stock and policy using the resolved origin
and validates combined SKU demand before persisting records. A server rejection
remains visible in the existing POS sync issues workflow.

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