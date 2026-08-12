export type DeviceOrderItem = {
  name: string
  imageUrl?: string | null
  unitPrice?: number | null
}

export type DeviceOrder = {
  orderId: string
  publicAccessToken: string
  orderNumber?: string | null
  status?: string | null
  total?: number | null
  currency?: string | null
  createdAt?: string | null
  /** Snapshot of cart lines for shop “Your orders” thumbnails */
  items?: DeviceOrderItem[]
}

const MAX_ORDERS = 5
const MAX_ITEMS = 4

export function getDeviceOrdersKey(siteId: string): string {
  return `market-device-orders-${siteId}`
}

function slimItems(items?: DeviceOrderItem[] | null): DeviceOrderItem[] {
  if (!Array.isArray(items)) return []
  return items
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .slice(0, MAX_ITEMS)
    .map((i) => ({
      name: i.name,
      imageUrl: i.imageUrl ?? null,
      unitPrice: typeof i.unitPrice === "number" ? i.unitPrice : null,
    }))
}

export function getDeviceOrders(siteId: string): DeviceOrder[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(getDeviceOrdersKey(siteId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (o): o is DeviceOrder =>
        !!o &&
        typeof o.orderId === "string" &&
        typeof o.publicAccessToken === "string"
    )
  } catch (e) {
    console.error("Error reading device orders", e)
    return []
  }
}

export function rememberDeviceOrder(siteId: string, order: DeviceOrder): void {
  if (typeof window === "undefined") return
  if (!order.orderId || !order.publicAccessToken) return

  try {
    const existing = getDeviceOrders(siteId).filter((o) => o.orderId !== order.orderId)
    const next = [
      {
        orderId: order.orderId,
        publicAccessToken: order.publicAccessToken,
        orderNumber: order.orderNumber ?? null,
        status: order.status ?? null,
        total: order.total ?? null,
        currency: order.currency ?? null,
        createdAt: order.createdAt ?? new Date().toISOString(),
        items: slimItems(order.items),
      },
      ...existing,
    ].slice(0, MAX_ORDERS)

    localStorage.setItem(getDeviceOrdersKey(siteId), JSON.stringify(next))
    window.dispatchEvent(new Event("storage"))
  } catch (e) {
    console.error("Error saving device order", e)
  }
}

export function setDeviceOrders(siteId: string, orders: DeviceOrder[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      getDeviceOrdersKey(siteId),
      JSON.stringify(orders.slice(0, MAX_ORDERS))
    )
    window.dispatchEvent(new Event("storage"))
  } catch (e) {
    console.error("Error writing device orders", e)
  }
}

/** Prefer the most expensive line for a single hero thumb; keep others for mosaic. */
export function sortDeviceOrderItemsForDisplay(items: DeviceOrderItem[]): DeviceOrderItem[] {
  return [...items].sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0))
}
