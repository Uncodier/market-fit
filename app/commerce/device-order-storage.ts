export type DeviceOrderItem = {
  name: string
  imageUrl?: string | null
  unitPrice?: number | null
}

export type GuestShippingAddress = {
  line1: string
  line2: string
  city: string
  state: string
  zip: string
  country: string
}

export type GuestCheckoutPrefill = {
  customerName: string
  customerEmail: string
  shippingAddress?: GuestShippingAddress
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
  /** Guest identity for the next anonymous checkout on this device */
  customerName?: string | null
  customerEmail?: string | null
  shippingAddress?: GuestShippingAddress | null
}

const MAX_ORDERS = 5
const MAX_ITEMS = 4
const DEVICE_ORDERS_PREFIX = "market-device-orders-"

export function getDeviceOrdersKey(siteId: string): string {
  return `${DEVICE_ORDERS_PREFIX}${siteId}`
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

export function slimShippingAddress(
  addr?: GuestShippingAddress | null
): GuestShippingAddress | undefined {
  if (!addr || typeof addr !== "object") return undefined
  const line1 = String(addr.line1 || "").trim()
  if (!line1) return undefined
  return {
    line1,
    line2: String(addr.line2 || ""),
    city: String(addr.city || ""),
    state: String(addr.state || ""),
    zip: String(addr.zip || ""),
    country: String(addr.country || ""),
  }
}

function slimGuest(order: DeviceOrder): GuestCheckoutPrefill {
  const customerName =
    typeof order.customerName === "string" ? order.customerName.trim() : ""
  const customerEmail =
    typeof order.customerEmail === "string" ? order.customerEmail.trim() : ""
  return {
    customerName,
    customerEmail,
    shippingAddress: slimShippingAddress(order.shippingAddress),
  }
}

function toStoredDeviceOrder(order: DeviceOrder, fallbackCreatedAt?: string | null) {
  const guest = slimGuest(order)
  return {
    orderId: order.orderId,
    publicAccessToken: order.publicAccessToken,
    orderNumber: order.orderNumber ?? null,
    status: order.status ?? null,
    total: order.total ?? null,
    currency: order.currency ?? null,
    createdAt: order.createdAt ?? fallbackCreatedAt ?? null,
    items: slimItems(order.items),
    ...(guest.customerName ? { customerName: guest.customerName } : {}),
    ...(guest.customerEmail ? { customerEmail: guest.customerEmail } : {}),
    ...(guest.shippingAddress ? { shippingAddress: guest.shippingAddress } : {}),
  }
}

function prefillFromOrder(order: DeviceOrder): GuestCheckoutPrefill | null {
  const guest = slimGuest(order)
  if (!guest.customerName && !guest.customerEmail && !guest.shippingAddress) {
    return null
  }
  return guest
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
      toStoredDeviceOrder(order, new Date().toISOString()),
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
    const next = orders.slice(0, MAX_ORDERS).map((order) => toStoredDeviceOrder(order))
    localStorage.setItem(getDeviceOrdersKey(siteId), JSON.stringify(next))
    window.dispatchEvent(new Event("storage"))
  } catch (e) {
    console.error("Error writing device orders", e)
  }
}

function latestPrefill(orders: DeviceOrder[]): GuestCheckoutPrefill | null {
  for (const order of orders) {
    const prefill = prefillFromOrder(order)
    if (prefill) return prefill
  }
  return null
}

/** Guest name/email/address from the latest anonymous device-order cache. */
export function getGuestCheckoutPrefill(siteId?: string | null): GuestCheckoutPrefill | null {
  if (typeof window === "undefined") return null

  if (siteId) {
    const fromSite = latestPrefill(getDeviceOrders(siteId))
    if (fromSite) return fromSite
  }

  try {
    let best: { createdAt: string; prefill: GuestCheckoutPrefill } | null = null
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(DEVICE_ORDERS_PREFIX)) continue
      const cachedSiteId = key.slice(DEVICE_ORDERS_PREFIX.length)
      if (!cachedSiteId || cachedSiteId === siteId) continue
      for (const order of getDeviceOrders(cachedSiteId)) {
        const prefill = prefillFromOrder(order)
        if (!prefill) continue
        const createdAt = order.createdAt || ""
        if (!best || createdAt > best.createdAt) best = { createdAt, prefill }
      }
    }
    return best?.prefill || null
  } catch {
    return null
  }
}

/** Prefer the most expensive line for a single hero thumb; keep others for mosaic. */
export function sortDeviceOrderItemsForDisplay(items: DeviceOrderItem[]): DeviceOrderItem[] {
  return [...items].sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0))
}
