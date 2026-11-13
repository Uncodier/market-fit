export type TransferStatus = "draft" | "requested" | "approved" | "in_transit" | "partially_received" | "received" | "cancelled"
export type TransferOrder = {
  id: string; site_id: string; status: TransferStatus
  from_location_id: string; to_location_id: string
  from_location_name: string; to_location_name: string
  requested_by: string; receiving_user_id: string | null; receiving_user_name: string | null
  notes: string | null; revision: number; created_at: string; updated_at: string
}
export type TransferLine = {
  id: string; order_id: string; site_id: string; catalog_item_id: string; item_name: string
  requested_quantity: number; dispatched_quantity: number; received_quantity: number
  returned_quantity: number; written_off_quantity: number; discrepancy_notes: string | null
}
export type TransferEvent = { id: string; action: string; actor_id: string; created_at: string; payload: unknown }
export type TransferOrderDetail = TransferOrder & { lines: TransferLine[]; events: TransferEvent[] }