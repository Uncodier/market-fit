import type { OrderWithRelations } from "./types"

// The POS snapshot fields plus legacy JSON items, attribution and marketplace
// metadata used by orders UI. Never select public-link bearer tokens.
export const ORDER_BASE_SELECT = `
  id, site_id, sale_id, order_number, status, created_at, updated_at,
  currency, subtotal, tax_total, discount_total, total, notes, metadata, items,
  fulfillment_method, origin_location_id, price_list_id, promotion_id,
  buyer_user_id, owner_site_id, created_by_user_id, seller_user_id,
  requested_by_lead_id, shipping_address, scheduled_for
`
export const ORDER_ITEM_SELECT =
  "id, site_id, sale_order_id, status, name, quantity, unit_price, catalog_item_id, parent_sale_order_item_id, metadata"
export const ORDER_SALE_SELECT =
  "id, site_id, lead_id, status, source, amount, payment_method, amount_due, payments"
export const ORDER_LEAD_SELECT = "id, site_id, name, email"

export type OrderBase = Omit<OrderWithRelations, "sales" | "leads" | "sale_order_items">
export type OrderItem = NonNullable<OrderWithRelations["sale_order_items"]>[number] & {
  id: string; site_id: string; sale_order_id: string
}
export type OrderLead = NonNullable<OrderWithRelations["leads"]> & { site_id: string }
export type OrderSale = NonNullable<OrderWithRelations["sales"]> & {
  id: string; site_id: string; lead_id: string | null
}