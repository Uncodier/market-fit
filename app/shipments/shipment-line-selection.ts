export type ShipmentCandidate = {
  id: string
  shipment_id?: string | null
  status?: string | null
  metadata?: { completed_without_stock?: boolean } | null
}

/** Whole-line assignment includes fulfilled units: fulfillment is not shipment proof. */
export function isUnassignedShipmentLine(line: ShipmentCandidate): boolean {
  return !line.shipment_id && line.status !== 'cancelled' && line.status !== 'draft'
    && line.metadata?.completed_without_stock !== true
}