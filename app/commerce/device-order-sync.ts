import type { DeviceOrder, DeviceOrderItem } from "@/app/commerce/device-order-storage"

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
    catalog_item?:
      | { name?: string | null; image_url?: string | null }
      | Array<{ name?: string | null; image_url?: string | null }>
      | null
  }> | null
}

function catalogFromLine(
  catalog:
    | { name?: string | null; image_url?: string | null }
    | Array<{ name?: string | null; image_url?: string | null }>
    | null
    | undefined
) {
  return Array.isArray(catalog) ? catalog[0] : catalog
}

export function mapDeviceOrderSnapshot(row: DeviceOrderSnapshotRow): DeviceOrder {
  const items: DeviceOrderItem[] = (row.sale_order_items || []).map((line) => {
    const catalog = catalogFromLine(line.catalog_item)
    return {
      name: line.name || catalog?.name || "Item",
      imageUrl: catalog?.image_url ?? null,
      unitPrice: typeof line.unit_price === "number" ? line.unit_price : null,
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
