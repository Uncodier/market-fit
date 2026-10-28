import type { SaleOrderData } from "@/app/types";
import type { PosSaleRow } from "@/app/pos/list-open-orders";

export type PosOrderSeller = { id: string; name: string };

/** Session fields only: no public tokens, duplicate JSON items or full attribution. */
export const POS_ORDER_SNAPSHOT_SELECT = `
  id, site_id, sale_id, order_number, status, created_at, updated_at,
  currency, subtotal, tax_total, discount_total, total, notes,
  fulfillment_method, origin_location_id, price_list_id, promotion_id,
  buyer_user_id, seller_user_id, shipping_address, scheduled_for,
  promotions (name, code, image_url),
  sale_order_items (
    id, catalog_item_id, unit_price, metadata, quantity, status, name,
    parent_sale_order_item_id
  )
`;

export const POS_SALE_SNAPSHOT_SELECT =
  "id, status, source, amount, payment_method, amount_due, payments, leads (id, name, email)";

export const POS_ORDER_READ_SELECT =
  `${POS_ORDER_SNAPSHOT_SELECT}, sales (${POS_SALE_SNAPSHOT_SELECT})`;

export type PosOrderSnapshot = Pick<
  SaleOrderData,
  | "id" | "site_id" | "sale_id" | "order_number" | "status"
  | "created_at" | "updated_at" | "currency" | "subtotal" | "tax_total"
  | "discount_total" | "total" | "notes" | "fulfillment_method"
  | "price_list_id" | "promotion_id" | "buyer_user_id" | "seller_user_id"
  | "shipping_address" | "scheduled_for"
> & {
  origin_location_id: string | null;
  seller?: PosOrderSeller;
  promotions?: { name: string; code: string | null; image_url: string | null } | null;
  sale_order_items: Array<{
    id: string;
    catalog_item_id: string | null;
    unit_price: number;
    metadata: Record<string, unknown> | null;
    quantity: number;
    status: string | null;
    name: string;
    parent_sale_order_item_id: string | null;
  }>;
  sales: PosSaleRow | null;
  leads: PosSaleRow["leads"];
};

type NestedSale = Omit<PosSaleRow, "leads"> & {
  leads?: PosSaleRow["leads"] | NonNullable<PosSaleRow["leads"]>[];
};

/** Normalize embedded to-one relations without an additional lead lookup. */
export function normalizePosOrderLead<T extends {
  sales?: NestedSale | NestedSale[] | null;
}>(order: T) {
  const sale = Array.isArray(order.sales) ? order.sales[0] : order.sales;
  const leads = Array.isArray(sale?.leads) ? sale.leads[0] : sale?.leads;
  return {
    ...order,
    sales: sale ? { ...sale, leads: leads || null } : null,
    leads: leads || null,
  };
}