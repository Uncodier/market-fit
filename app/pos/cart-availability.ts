import type { CatalogItem } from "@/app/types"
import type { PosCartItem } from "./cart-types"
import { cartLineKey, cartWithQtyDelta } from "./cart-line-utils"
import { isStorefrontAvailable } from "@/app/catalog/storefront-availability"
import { getPosItemAvailability, type PosInventorySnapshot } from "./inventory-availability"

export type PosItemAvailability = ReturnType<typeof getPosItemAvailability>
export type PosCartInventoryContext = {
  catalogItems: CatalogItem[]
  inventorySnapshot?: PosInventorySnapshot | null
  originLocationId?: string | null
}

export function posCartQuantities(cart: PosCartItem[]) {
  const quantities = new Map<string, number>()
  const add = (id: string, quantity: number) =>
    quantities.set(id, (quantities.get(id) || 0) + quantity)
  for (const line of cart) {
    if (!(line.cartQty > 0)) continue
    add(line.id, line.cartQty)
    for (const modifier of line.modifiers || []) {
      add(modifier.catalogItemId, modifier.cartQty * line.cartQty)
    }
  }
  return quantities
}

function availabilityForId(
  id: string, quantity: number, context: PosCartInventoryContext,
): PosItemAvailability {
  const item = context.catalogItems.find((candidate) => candidate.id === id)
  if (!item) return {
    sellable: false, status: "unknown", backorderQty: 0,
    reason: "Availability is unknown. Sync the catalog before adding this item.",
  }
  return getPosItemAvailability(item, context.inventorySnapshot, context.originLocationId, quantity)
}

/** All lines sharing a SKU, including extras, consume the same stock. */
export function posCartInventoryError(
  cart: PosCartItem[], context: PosCartInventoryContext, previousCart?: PosCartItem[],
): string | null {
  if (cart.some((line) => !Number.isFinite(line.cartQty) || line.cartQty < 0
    || line.modifiers?.some((modifier) => !Number.isFinite(modifier.cartQty) || modifier.cartQty <= 0))) {
    return "Quantity must be a finite positive number."
  }
  const previous = previousCart ? posCartQuantities(previousCart) : null
  for (const [id, quantity] of posCartQuantities(cart)) {
    // Always permit removing/reducing a line after a location or stock change.
    if (previous && quantity <= (previous.get(id) || 0)) continue
    const availability = availabilityForId(id, quantity, context)
    if (!availability.sellable) {
      const name = context.catalogItems.find((item) => item.id === id)?.name
        || cart.find((item) => item.id === id)?.name || "Item"
      return `${name}: ${availability.reason || "Sold out"}`
    }
  }
  return null
}

export function posCatalogItemAvailability(
  item: CatalogItem, cart: PosCartItem[], context: PosCartInventoryContext,
): PosItemAvailability {
  const currentItem = context.catalogItems.find((candidate) => candidate.id === item.id) || item
  const quantities = posCartQuantities(cart)
  const leaf = (candidate: CatalogItem) => getPosItemAvailability(
    candidate, context.inventorySnapshot, context.originLocationId,
    (quantities.get(candidate.id) || 0) + 1,
  )
  if (!isStorefrontAvailable(currentItem)) return leaf(currentItem)
  const children = context.catalogItems.filter((candidate) =>
    candidate.parent_id === currentItem.id && candidate.status === "active"
    && candidate.is_purchasable !== false,
  )
  if (!children.length) return leaf(currentItem)
  const choices = children.map(leaf)
  return choices.find((choice) => choice.status === "available")
    || choices.find((choice) => choice.status === "backorder")
    || choices.find((choice) => choice.status === "unknown")
    || choices[0]
}

/** Derived display fields are recalculated when stock, policy, or location changes. */
export function annotatePosCartInventory(cart: PosCartItem[], context: PosCartInventoryContext): PosCartItem[] {
  const allocated = new Map<string, number>()
  const allocate = (id: string, quantity: number) => {
    const before = allocated.get(id) || 0
    allocated.set(id, before + quantity)
    const availability = availabilityForId(id, before + quantity, context)
    const backorderQty = availability.status === "backorder"
      ? Math.min(quantity, availability.backorderQty) : 0
    return { availability, backorderQty }
  }
  return cart.map((line) => {
    const host = allocate(line.id, line.cartQty)
    const modifiers = (line.modifiers || []).map((modifier) => ({
      ...modifier,
      backorderQty: allocate(modifier.catalogItemId, modifier.cartQty * line.cartQty).backorderQty,
    }))
    const inventoryMessage = !host.availability.sellable
      ? host.availability.reason || "Sold out" : undefined
    return {
      ...line, modifiers, backorderQty: host.backorderQty, inventoryMessage,
      inventoryCanIncrease: !posCartInventoryError(
        cartWithQtyDelta(cart, cartLineKey(line), 1), context, cart,
      ),
    }
  })
}