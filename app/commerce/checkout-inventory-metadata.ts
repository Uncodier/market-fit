import type { CheckoutSupabaseClient } from "./checkout-types"

// Bound URL size and stay below the API's row limit. Never cache stock quantities.
const METADATA_BATCH_SIZE = 100

export async function readCheckoutTrackedInventoryIds(
  client: Pick<CheckoutSupabaseClient, "from">,
  siteId: string,
  catalogItemIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(catalogItemIds)]
  const trackedIds = new Set<string>()
  for (let offset = 0; offset < ids.length; offset += METADATA_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + METADATA_BATCH_SIZE)
    const { data, error } = await client
      .from("catalog_items")
      .select("id, track_inventory")
      .eq("site_id", siteId)
      .in("id", batch)
    const returnedIds = new Set<string>()
    if (!error) {
      for (const item of data || []) {
        returnedIds.add(item.id)
        if (item.track_inventory) trackedIds.add(item.id)
      }
    }
    // A custom API row cap can truncate a successful response. Resolve missing
    // IDs individually, also preserving legacy lookup behavior on batch errors.
    for (const id of batch) {
      if (!returnedIds.has(id)) {
        const { data: item } = await client
          .from("catalog_items")
          .select("track_inventory")
          .eq("site_id", siteId)
          .eq("id", id)
          .single()
        if (item?.track_inventory) trackedIds.add(id)
      }
    }
  }
  return trackedIds
}