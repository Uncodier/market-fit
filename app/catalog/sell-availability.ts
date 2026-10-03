import { createClient, createServiceClient } from "@/lib/supabase/server"
import { variantSelectionBlockReason } from "@/app/catalog/product-details"
import type { CatalogAvailabilityResult } from "./types"

export type CatalogSellOptions = {
  skipVariantSelection?: boolean
}

/**
 * Checks if an item can be sold based on availability mode and inventory levels.
 */
export async function getCatalogAvailability(
  siteId: string,
  catalogItemId: string,
  quantity: number = 1,
  locationId?: string,
  forceServiceRole: boolean = false,
  options?: CatalogSellOptions,
): Promise<CatalogAvailabilityResult> {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { sellable: false, reason: "Quantity must be a positive finite number", policy: "block" }
  }
  const supabase = forceServiceRole ? await createServiceClient(true) : await createClient()

  const [itemRes, settingsRes] = await Promise.all([
    supabase.from("catalog_items").select("*").eq("id", catalogItemId).eq("site_id", siteId).single(),
    supabase.from("settings").select("commerce").eq("site_id", siteId).maybeSingle(),
  ])

  if (itemRes.error || !itemRes.data) return { sellable: false, reason: "Item not found", policy: "block" }
  if (settingsRes.error) {
    return { sellable: false, reason: "Unable to verify stock policy", policy: "block" }
  }

  const item = itemRes.data
  const commerceSettings = settingsRes.data?.commerce as { stock_shortage_policy?: unknown } | null
  const policy = commerceSettings?.stock_shortage_policy ?? "allow"
  if (policy !== "allow" && policy !== "warn" && policy !== "block") {
    return { sellable: false, reason: "Invalid stock shortage policy", policy: "block" }
  }

  if (!options?.skipVariantSelection) {
    let purchasableChildCount = 0
    if (!item.parent_id) {
      const { count: childCount, error: childError } = await supabase
        .from("catalog_items")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", catalogItemId)
        .eq("site_id", siteId)
        .eq("status", "active")
        .eq("is_purchasable", true)
      if (childError) {
        return { sellable: false, reason: "Unable to verify item variants", policy: "block" }
      }
      purchasableChildCount = childCount || 0
    }
    const variantReason = variantSelectionBlockReason(item, purchasableChildCount)
    if (variantReason) {
      return { sellable: false, reason: variantReason, policy: "block" }
    }
  }

  if (item.status !== "active") {
    return { sellable: false, reason: "Item is archived", policy }
  }

  if (item.availability_mode === "always") {
    return { sellable: true, policy }
  }

  if (item.availability_mode === "manual") {
    if (item.availability_status === "available") {
      return { sellable: true, policy }
    }
    return { sellable: false, reason: `Item is marked as ${item.availability_status}`, policy }
  }

  if (item.availability_mode === "inventory") {
    let query = supabase
      .from("inventory_levels")
      .select("quantity")
      .eq("catalog_item_id", catalogItemId)
      .eq("site_id", siteId)

    if (locationId) {
      query = query.eq("location_id", locationId)
    }

    const { data: levels, error: inventoryError } = await query
    if (inventoryError || !levels) {
      return { sellable: false, reason: "Unable to verify inventory", policy }
    }
    let availableQty = 0
    for (const level of levels) {
      const value: unknown = level.quantity
      if (
        (typeof value !== "number" && typeof value !== "string") ||
        (typeof value === "string" && !value.trim()) ||
        !Number.isFinite(Number(value))
      ) {
        return { sellable: false, reason: "Unable to verify inventory", policy }
      }
      availableQty += Number(value)
    }
    if (!Number.isFinite(availableQty)) {
      return { sellable: false, reason: "Unable to verify inventory", policy }
    }

    if (quantity <= availableQty) {
      return { sellable: true, availableQty, policy }
    }
    return {
      sellable: policy !== "block",
      reason: `Insufficient stock (requested ${quantity}, available ${availableQty})`,
      availableQty,
      policy,
    }
  }

  return { sellable: true, policy }
}

export async function assertCanSell(
  siteId: string,
  catalogItemId: string,
  quantity: number = 1,
  locationId?: string,
  forceServiceRole: boolean = false,
  options?: CatalogSellOptions,
) {
  const result = await getCatalogAvailability(
    siteId,
    catalogItemId,
    quantity,
    locationId,
    forceServiceRole,
    options,
  )
  if (!result.sellable) {
    throw new Error(result.reason || "Item cannot be sold")
  }
  return result
}
