import type { CheckoutFulfillmentMethod } from "./delivery-options"

function isFulfillment(value: unknown): value is CheckoutFulfillmentMethod {
  return value === "pickup" || value === "ship" || value === "dine_in" || value === "none"
}

/** A buyer preference only; checkout still validates each item's allowed methods. */
export function readShopFulfillmentPreference(siteId?: string | null): CheckoutFulfillmentMethod | null {
  if (!siteId || typeof window === "undefined") return null
  try {
    const value = localStorage.getItem(`market-shop-fulfillment:${siteId}`)
    return isFulfillment(value) ? value : null
  } catch {
    return null
  }
}

export function writeShopFulfillmentPreference(
  siteId: string | null | undefined,
  value: CheckoutFulfillmentMethod,
): void {
  if (!siteId || typeof window === "undefined" || !isFulfillment(value)) return
  try {
    localStorage.setItem(`market-shop-fulfillment:${siteId}`, value)
  } catch {
    // Storage may be unavailable; keep the current in-memory selection usable.
  }
}