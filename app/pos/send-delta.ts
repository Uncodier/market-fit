import type { PosCartItem } from "@/app/pos/components/CartPanel"
import { cartLineKey } from "@/app/pos/cart-line-utils"

export type SentLineQuantities = Record<string, number>

export function sentLineQuantitiesFromSaleOrderItems(
  saleOrderItems: any[],
): SentLineQuantities {
  const quantities: SentLineQuantities = {}

  for (const item of saleOrderItems || []) {
    if (
      item.parent_sale_order_item_id ||
      !item.status ||
      item.status === "draft" ||
      item.status === "cancelled"
    ) {
      continue
    }

    const key = item.metadata?.client_line_key || item.id
    if (!key) continue
    quantities[key] = Math.max(0, Number(item.quantity) || 0)
  }

  return quantities
}

export function pendingSendDeltaCount(
  cart: PosCartItem[],
  sentLineQuantities: SentLineQuantities,
): number {
  const currentKeys = new Set<string>()
  let count = 0

  for (const item of cart) {
    const key = cartLineKey(item)
    currentKeys.add(key)
    const sentQuantity = sentLineQuantities[key] || 0
    count += Math.abs(Math.max(0, item.cartQty) - sentQuantity)
  }

  for (const [key, sentQuantity] of Object.entries(sentLineQuantities)) {
    if (!currentKeys.has(key)) count += Math.max(0, sentQuantity)
  }

  return count
}
