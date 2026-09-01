import type { DeviceOrder, DeviceOrderItem } from "@/app/commerce/device-order-storage"

type SnapshotCatalog = {
  name?: string | null
  image_url?: string | null
  kind?: string | null
  digital_subtype?: string | null
}

export type DeviceOrderSnapshotRow = {
  id: string
  public_access_token: string
  order_number?: string | null
  status?: string | null
  total?: number | null
  currency?: string | null
  created_at?: string | null
  sale_order_items?: Array<{
    name?: string | null
    unit_price?: number | null
    catalog_item_id?: string | null
    catalog_item?: SnapshotCatalog | SnapshotCatalog[] | null
  }> | null
}

export type PurchaseEntitlementRow = {
  id: string
  source_id: string
  catalog_item_id?: string | null
}

function catalogFromLine(
  catalog: SnapshotCatalog | SnapshotCatalog[] | null | undefined
) {
  return Array.isArray(catalog) ? catalog[0] : catalog
}

export function mapDeviceOrderSnapshot(row: DeviceOrderSnapshotRow): DeviceOrder {
  const items: DeviceOrderItem[] = (row.sale_order_items || []).map((line) => {
    const catalog = catalogFromLine(line.catalog_item)
    const catalogItemId = line.catalog_item_id || null
    const kind = catalog?.kind || null
    const digital_subtype = catalog?.digital_subtype || null
    return {
      name: line.name || catalog?.name || "Item",
      imageUrl: catalog?.image_url ?? null,
      unitPrice: typeof line.unit_price === "number" ? line.unit_price : null,
      ...(catalogItemId ? { catalogItemId } : {}),
      ...(kind ? { kind } : {}),
      ...(digital_subtype ? { digital_subtype } : {}),
    }
  })

  return {
    orderId: row.id,
    publicAccessToken: row.public_access_token,
    orderNumber: row.order_number ?? null,
    status: row.status ?? null,
    total: row.total ?? null,
    currency: row.currency ?? null,
    createdAt: row.created_at ?? null,
    items,
  }
}

export function attachPurchaseEntitlements(
  orders: DeviceOrder[],
  entitlements: PurchaseEntitlementRow[]
): DeviceOrder[] {
  if (!entitlements.length) return orders

  const byOrder = new Map<string, PurchaseEntitlementRow[]>()
  for (const entitlement of entitlements) {
    if (!entitlement.source_id || !entitlement.id) continue
    const list = byOrder.get(entitlement.source_id) || []
    list.push(entitlement)
    byOrder.set(entitlement.source_id, list)
  }

  return orders.map((order) => {
    const matches = byOrder.get(order.orderId)
    if (!matches?.length || !order.items?.length) return order

    const used = new Set<string>()
    const items = order.items.map((item) => {
      const match =
        matches.find(
          (entitlement) =>
            !used.has(entitlement.id) &&
            entitlement.catalog_item_id &&
            entitlement.catalog_item_id === item.catalogItemId
        ) ||
        (matches.length === 1 && !used.has(matches[0].id) ? matches[0] : undefined)
      if (!match) return item
      used.add(match.id)
      return { ...item, entitlementId: match.id }
    })

    return { ...order, items }
  })
}

export function mergeDeviceOrderSnapshot(
  cached: DeviceOrder,
  snapshot: DeviceOrder
): DeviceOrder {
  return {
    ...cached,
    status: snapshot.status ?? cached.status,
    total: snapshot.total ?? cached.total,
    orderNumber: snapshot.orderNumber ?? cached.orderNumber,
    currency: snapshot.currency ?? cached.currency,
    createdAt: snapshot.createdAt ?? cached.createdAt,
    items: snapshot.items?.length ? snapshot.items : cached.items,
  }
}

function deviceOrderChanged(before: DeviceOrder, after: DeviceOrder): boolean {
  return (
    before.status !== after.status ||
    before.total !== after.total ||
    before.orderNumber !== after.orderNumber ||
    before.currency !== after.currency ||
    JSON.stringify(before.items || []) !== JSON.stringify(after.items || [])
  )
}

export function applyDeviceOrderSnapshots(
  cached: DeviceOrder[],
  snapshots: DeviceOrder[]
): { orders: DeviceOrder[]; changed: boolean } {
  const byToken = new Map(snapshots.map((s) => [s.publicAccessToken, s]))
  let changed = false
  const orders = cached.map((order) => {
    const snapshot = byToken.get(order.publicAccessToken)
    if (!snapshot) return order
    const next = mergeDeviceOrderSnapshot(order, snapshot)
    if (!deviceOrderChanged(order, next)) return order
    changed = true
    return next
  })
  return { orders, changed }
}
