import type { CheckoutSupabaseClient } from "./checkout-types"

type InventoryOrderLine = {
  id?: string
  catalog_item_id?: string | null
  quantity?: number
  status?: string | null
  sent_at?: string | null
  metadata?: { client_line_key?: string } | null
}

/** Compare persisted line snapshots, including modifiers, rather than cart parents. */
export function selfServiceReleasedInventoryUnits(
  existingItems: InventoryOrderLine[],
  nextItems: InventoryOrderLine[],
): Map<string, number> {
  const units = new Map<string, number>()
  for (const next of nextItems) {
    if (!next.catalog_item_id || next.status === "draft" || next.status === "cancelled" || !next.sent_at) continue
    const previous = existingItems.find((item) => next.id && item.id === next.id)
      || existingItems.find((item) => next.metadata?.client_line_key && item.metadata?.client_line_key === next.metadata.client_line_key)
    const previouslyReleased = previous && (previous.sent_at || (previous.status && previous.status !== "draft"))
    const quantity = Math.max(0, Number(next.quantity) - (previouslyReleased ? Number(previous.quantity) : 0))
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    units.set(next.catalog_item_id, (units.get(next.catalog_item_id) || 0) + quantity)
  }
  return units
}

export async function applySelfServiceInventoryRelease(params: {
  client: CheckoutSupabaseClient
  siteId: string
  locationId: string
  existingItems: InventoryOrderLine[]
  nextItems: InventoryOrderLine[]
}) {
  const units = selfServiceReleasedInventoryUnits(params.existingItems, params.nextItems)
  if (units.size === 0) return
  const { data: settings, error: settingsError } = await params.client.from("settings")
    .select("commerce").eq("site_id", params.siteId).single()
  if (settingsError) throw new Error("Unable to verify self-service inventory policy")
  if (settings?.commerce?.decrement_stock_on === "never") return

  // This prevents ordinary sequential saves from repeating a released snapshot.
  // Atomic retry/concurrency guarantees require a database inventory-effect RPC;
  // the Stripe RPC cannot be used without its verified session/claim ownership.
  for (const [catalogItemId, quantity] of units) {
    const { data: item, error: itemError } = await params.client.from("catalog_items")
      .select("track_inventory").eq("id", catalogItemId).eq("site_id", params.siteId).single()
    if (itemError) throw new Error("Unable to verify self-service inventory item")
    if (!item?.track_inventory) continue
    const { data: level, error: levelError } = await params.client.from("inventory_levels")
      .select("id, quantity").eq("catalog_item_id", catalogItemId)
      .eq("location_id", params.locationId).eq("site_id", params.siteId).maybeSingle()
    if (levelError) throw new Error("Unable to read self-service inventory level")
    const { error } = level
      ? await params.client.from("inventory_levels")
        .update({ quantity: Math.max(0, Number(level.quantity) - quantity) })
        .eq("id", level.id).eq("site_id", params.siteId)
      : await params.client.from("inventory_levels").insert({
        site_id: params.siteId, location_id: params.locationId,
        catalog_item_id: catalogItemId, quantity: 0,
      })
    if (error) throw new Error("Unable to apply self-service inventory release")
  }
}