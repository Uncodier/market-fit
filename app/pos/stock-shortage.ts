import { v4 as uuidv4 } from "uuid"
import type { CatalogItem } from "@/app/types"
import { needsBuyerAccount } from "@/app/catalog/product-details"
import { isDynamicPricedItem } from "@/app/catalog/dynamic-pricing"
import { cartLineKey } from "./cart-line-utils"
import { posCartQuantities, type PosCartInventoryContext } from "./cart-availability"
import { getPosItemAvailability, type PosItemAvailability } from "./inventory-availability"
import type { PosCartItem } from "./cart-types"

export function canResolvePosShortage(item: CatalogItem, availability?: PosItemAvailability) {
  return item.status !== "archived" && item.availability_mode !== "manual"
    && !item.is_reservation && !needsBuyerAccount(item) && !isDynamicPricedItem(item)
    && !!availability && availability.availableQty !== undefined
    && (availability.status === "sold_out" || availability.status === "backorder")
}

export function findPosStockShortage(next: PosCartItem[], previous: PosCartItem[], context: PosCartInventoryContext) {
  const before = posCartQuantities(previous)
  for (const [id, quantity] of posCartQuantities(next)) {
    if (quantity <= (before.get(id) || 0)) continue
    const item = context.catalogItems.find((candidate) => candidate.id === id)
    if (!item) continue
    const changedHosts = next.filter((line) => line.cartQty > (previous.find((beforeLine) =>
      cartLineKey(beforeLine) === cartLineKey(line))?.cartQty || 0))
    if (changedHosts.some((line) => line.is_reservation || needsBuyerAccount(line) || isDynamicPricedItem(line))) continue
    const availability = getPosItemAvailability(item, context.inventorySnapshot, context.originLocationId, quantity)
    if (canResolvePosShortage(item, availability)) {
      return { item, quantity: quantity - (availability.availableQty || 0) }
    }
  }
  return null
}

/** Only the newly requested units are completed; historical lines remain unchanged. */
export function completePosStockAddition(next: PosCartItem[], previous: PosCartItem[]) {
  return next.flatMap((line): PosCartItem[] => {
    const before = previous.find((candidate) => cartLineKey(candidate) === cartLineKey(line))
    const delta = line.cartQty - (before?.cartQty || 0)
    if (delta <= 0) return [line]
    const completed: PosCartItem = {
      ...line, cartQty: delta, completedWithoutStock: true,
      saleOrderItemId: undefined, inventoryCompletedQty: undefined, lineKey: uuidv4(),
      modifiers: line.modifiers?.map((modifier) => ({ ...modifier,
        saleOrderItemId: undefined, inventoryCompletedQty: undefined,
      })),
    }
    return before ? [before, completed] : [completed]
  })
}