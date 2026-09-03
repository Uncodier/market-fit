import { CatalogItem } from "@/app/types"

export type StorefrontShopFields = {
  availableQty?: number
  soldQty?: number
  nextSlotAvailable?: number
  nextSlotCapacity?: number
  buyers?: { id: string; name: string | null; avatar_url: string | null }[]
  buyerCount?: number
}

export type InventoryDisplayRule =
  | { type: "none" }
  | { type: "spots_left"; count: number; isUrgent: boolean }
  | { type: "only_left"; count: number; isUrgent: boolean }

/** Red when leftover is at most 20% of capacity, with a floor of 5 seats/units. */
export function isLowStockUrgent(remaining: number, capacity?: number): boolean {
  if (remaining <= 0) return false
  if (!capacity || capacity <= 0) return remaining <= 5
  return remaining <= Math.max(5, capacity * 0.2)
}

export function getInventoryDisplayRule(
  item: CatalogItem,
  shop: StorefrontShopFields = {},
  showSeller = false
): InventoryDisplayRule {
  const showInv = item.metadata?.show_available_inventory

  if (
    showInv &&
    item.is_reservation &&
    shop.nextSlotAvailable !== undefined &&
    shop.nextSlotAvailable > 0
  ) {
    return {
      type: "spots_left",
      count: shop.nextSlotAvailable,
      isUrgent: isLowStockUrgent(shop.nextSlotAvailable, shop.nextSlotCapacity),
    }
  }

  if (showInv && shop.availableQty !== undefined && shop.availableQty > 0) {
    const capacity =
      shop.soldQty !== undefined
        ? shop.availableQty + shop.soldQty
        : undefined
    return {
      type: "only_left",
      count: shop.availableQty,
      isUrgent: isLowStockUrgent(shop.availableQty, capacity),
    }
  }

  if (
    !showInv &&
    !showSeller &&
    shop.availableQty !== undefined &&
    shop.availableQty <= 5 &&
    shop.availableQty > 0
  ) {
    return { type: "only_left", count: shop.availableQty, isUrgent: true }
  }

  return { type: "none" }
}
