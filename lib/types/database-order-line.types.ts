export interface SaleOrderItemUnitsTable {
  Row: {
    id: string
    site_id: string
    sale_order_item_id: string
    unit_index: number
    quantity: number
    status: string
    assigned_to: string | null
    shipment_id: string | null
    started_at: string
    in_progress_at: string | null
    ready_at: string | null
    completed_at: string | null
    delivered_at: string | null
    created_at: string
    updated_at: string
  }
  Insert: any
  Update: any
}
