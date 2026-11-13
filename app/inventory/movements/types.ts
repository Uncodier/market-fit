export type InventoryMovement = {
  id: string
  created_at: string
  catalog_item_id: string
  item_name: string
  from_location_id: string | null
  to_location_id: string
  from_location_name: string | null
  to_location_name: string
  quantity: number
  kind: "transfer" | "receipt" | "adjustment" | "dispatch" | "receive" | "return" | "writeoff"
  notes: string | null
  purchase_id: string | null
  receiving_user_id?: string | null
  receiving_user_name?: string | null
  transfer_order_id?: string | null
}