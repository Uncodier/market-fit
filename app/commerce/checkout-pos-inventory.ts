import "server-only"
import { reconcileOrderLineInventory } from "./order-line-inventory"
import type { CheckoutSupabaseClient } from "./checkout-types"
import { isUnassignedShipmentLine } from "@/app/shipments/shipment-line-selection"

type PersistedInventoryLine = {
  id: string
  quantity: number | string
  status?: string
  shipment_id?: string | null
  metadata?: { completed_without_stock?: boolean } | null
}

/** Fulfillment status is deliberately absent from inventory accounting decisions. */
export async function settlePosCheckoutInventory(params: {
  client: CheckoutSupabaseClient
  siteId: string
  orderId: string
  locationId: string
  lines: PersistedInventoryLine[]
}): Promise<boolean> {
  let reviewRequired = false
  for (const line of params.lines) {
    if (line.metadata?.completed_without_stock === true || line.status === "cancelled") continue
    // Assigned shipments own their inventory receipt; checkout never changes custody.
    if (line.shipment_id) continue
    const result = await reconcileOrderLineInventory(params.client, {
      siteId: params.siteId, orderId: params.orderId, lineId: line.id,
      locationId: params.locationId, targetQuantity: Number(line.quantity),
    })
    reviewRequired ||= result.reviewRequired
  }
  return reviewRequired
}

/** A partially fulfilled, unshipped line still needs its entire shipment budget. */
export function posCheckoutShipmentItems(lines: PersistedInventoryLine[]) {
  return lines.filter(isUnassignedShipmentLine).map((line) => line.id)
}