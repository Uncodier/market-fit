import "server-only"

export type OrderLineInventoryClient = {
  rpc: (name: "reconcile_order_line_inventory", args: {
    p_site_id: string
    p_order_id: string
    p_line_id: string
    p_location_id: string | null
    p_target_quantity: number
    p_mode: "debit" | "restock"
  }) => PromiseLike<{ data: unknown; error: unknown }>
}

export type OrderLineInventoryResult = {
  reviewRequired: boolean
  debitedQuantity: number
  restockedQuantity: number
  appliedQuantity: number
  skipped: boolean
}

/** Caller authorizes the parent operation and owns payment/fulfillment policy.
 * Targets are cumulative per mode, never deltas. Replays cannot debit twice or
 * refund more than this line actually debited. Legacy review is NOT success:
 * checkout must surface a warning; shipment/refund must stop for reconciliation.
 */
export async function reconcileOrderLineInventory(
  client: OrderLineInventoryClient,
  params: {
    siteId: string
    orderId: string
    lineId: string
    locationId: string | null
    targetQuantity: number
    mode?: "debit" | "restock"
  },
): Promise<OrderLineInventoryResult> {
  if (!Number.isFinite(params.targetQuantity) || params.targetQuantity < 0
    || params.targetQuantity > 1_000_000_000) {
    throw new Error("Invalid order line inventory quantity")
  }
  const { data, error } = await client.rpc("reconcile_order_line_inventory", {
    p_site_id: params.siteId,
    p_order_id: params.orderId,
    p_line_id: params.lineId,
    p_location_id: params.locationId,
    p_target_quantity: params.targetQuantity,
    p_mode: params.mode ?? "debit",
  })
  if (error) throw new Error("Failed to reconcile order line inventory")
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid order line inventory response")
  }
  const result = data as Record<string, unknown>
  for (const key of ["debited_quantity", "restocked_quantity", "applied_quantity"]) {
    if (typeof result[key] !== "number" || !Number.isFinite(result[key]) || result[key] < 0) {
      throw new Error("Invalid order line inventory response")
    }
  }
  if (typeof result.review_required !== "boolean" || typeof result.skipped !== "boolean"
    || (result.restocked_quantity as number) > (result.debited_quantity as number)) {
    throw new Error("Invalid order line inventory response")
  }
  return {
    reviewRequired: result.review_required,
    debitedQuantity: result.debited_quantity as number,
    restockedQuantity: result.restocked_quantity as number,
    appliedQuantity: result.applied_quantity as number,
    skipped: result.skipped,
  }
}