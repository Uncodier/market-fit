import "server-only"

export type InventoryDeltaClient = {
  rpc: (
    name: "apply_location_inventory_delta",
    args: {
      p_site_id: string
      p_catalog_item_id: string
      p_location_id: string
      p_delta: number
      p_floor_zero: boolean
    },
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

/** The caller owns authorization and parent lifecycle; this RPC only applies a delta.
 * Never retry an ambiguous result here: the parent operation is not idempotent.
 */
export async function applyLocationInventoryDelta(
  client: InventoryDeltaClient,
  params: {
    siteId: string
    catalogItemId: string
    locationId: string
    delta: number
    floorZero: boolean
  },
): Promise<number> {
  if (!Number.isFinite(params.delta)) {
    throw new Error("Inventory delta must be finite")
  }
  const { data, error } = await client.rpc("apply_location_inventory_delta", {
    p_site_id: params.siteId,
    p_catalog_item_id: params.catalogItemId,
    p_location_id: params.locationId,
    p_delta: params.delta,
    p_floor_zero: params.floorZero,
  })
  if (error) throw new Error("Failed to apply inventory delta")
  if (!data || typeof data !== "object" || Array.isArray(data)
    || !("quantity" in data) || typeof data.quantity !== "number"
    || !Number.isFinite(data.quantity)) {
    throw new Error("Invalid inventory delta response")
  }
  return data.quantity
}