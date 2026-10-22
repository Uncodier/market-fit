import type { CatalogItem } from "@/app/types"
import { slimCartItem } from "@/app/commerce/cart-storage"
import type { CartModifier } from "@/app/commerce/cart-modifiers"

export type SelfServiceCartItem = CatalogItem & {
  cartQty: number
  cartPrice: number
  modifiers?: CartModifier[]
  lineKey?: string
}

export function selfServiceCartKey(locationId: string) {
  return `shop-self-service-cart:${locationId}`
}

export function readSelfServiceCart(locationId: string): SelfServiceCartItem[] {
  if (typeof window === "undefined") return []
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(selfServiceCartKey(locationId)) || "[]")
    return Array.isArray(value) ? value.filter((line) => line && typeof line.id === "string" && line.cartQty > 0) : []
  } catch {
    return []
  }
}

export function writeSelfServiceCart(locationId: string, cart: SelfServiceCartItem[]) {
  if (typeof window === "undefined") return
  try {
    if (cart.length) sessionStorage.setItem(selfServiceCartKey(locationId), JSON.stringify(cart.map(slimCartItem)))
    else sessionStorage.removeItem(selfServiceCartKey(locationId))
    window.dispatchEvent(new Event("self-service-cart"))
  } catch {
    // A kiosk still works in memory when browser storage is unavailable.
  }
}