import type { OrderBase } from "../orders/order-read-dto"

export const UNIT_BASE_SELECT = `
  id, sale_order_item_id, unit_index, quantity, status, assigned_to, shipment_id,
  started_at, in_progress_at, ready_at, completed_at, delivered_at, created_at
`
export const LINE_ITEM_SELECT = `
  id, site_id, sale_order_id, catalog_item_id, name, description, quantity,
  unit_price, metadata, parent_sale_order_item_id
`
export const LINE_ORDER_SELECT = `
  id, site_id, sale_id, order_number, status, fulfillment_method, scheduled_for,
  origin_location_id, created_at, updated_at
`
export const LINE_SHIPMENT_SELECT =
  "id, status, created_at, updated_at, shipped_at, delivered_at, estimated_delivery_at"

export type UnitBase = {
  id: string; sale_order_item_id: string; unit_index: number; quantity: number;
  status: string; assigned_to: string | null; shipment_id: string | null;
  started_at: string | null; in_progress_at: string | null; ready_at: string | null;
  completed_at: string | null; delivered_at: string | null; created_at: string;
}
export type LineItem = {
  id: string; site_id: string; sale_order_id: string; catalog_item_id: string | null;
  name: string; description: string | null; quantity: number; unit_price: number;
  metadata: Record<string, unknown> | null; parent_sale_order_item_id: string | null;
}
export type LineOrder = Pick<OrderBase,
  "id" | "site_id" | "sale_id" | "order_number" | "status" | "fulfillment_method" |
  "scheduled_for" | "origin_location_id" | "created_at" | "updated_at">