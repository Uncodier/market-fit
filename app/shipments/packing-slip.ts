import type { PackingSlipPayload } from "@/lib/printer/core/types"
import type { ShipmentWithRelations } from "./types"

export function shipmentPackingSlip(shipment: ShipmentWithRelations, siteName?: string): PackingSlipPayload {
  const address: unknown = shipment.shipping_address
  const fields = address && typeof address === "object" ? address as Record<string, unknown> : {}
  const shippingAddress = typeof address === "string" ? address :
    [fields.street || fields.address || fields.line1, fields.line2, fields.city,
      fields.region || fields.state, fields.postal_code || fields.zip, fields.country]
      .filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(", ")
  return {
    shipmentId: shipment.id,
    orderNumber: shipment.sale_orders?.order_number,
    trackingNumber: shipment.tracking_number,
    carrier: shipment.carrier,
    customerName: shipment.leads?.name,
    shippingAddress: shippingAddress || undefined,
    createdAt: shipment.created_at,
    notes: shipment.notes,
    siteName,
    lines: (shipment.sale_orders?.sale_order_items || [])
      .filter((line) => line.shipment_id === shipment.id && !["cancelled", "draft"].includes(line.status || "")
        && Number.isFinite(line.quantity) && line.quantity > 0)
      .map(({ name, quantity }) => ({ name, quantity })),
  }
}

/** Persist before dispatch. Missing locks/storage fail closed; claims are never replayed. */
export async function claimShipmentPackingSlip(siteId: string, userId: string, shipmentId: string): Promise<boolean> {
  if (!siteId || !userId || !shipmentId || typeof navigator === "undefined" || !navigator.locks) return false
  const key = `shipment-packing-slip:v1:${siteId}:${userId}:${shipmentId}`
  try {
    return await navigator.locks.request(key, () => {
      if (localStorage.getItem(key)) return false
      localStorage.setItem(key, "claimed")
      return localStorage.getItem(key) === "claimed"
    })
  } catch {
    return false
  }
}