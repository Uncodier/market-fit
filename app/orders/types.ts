import { SaleOrderData, SaleOrder } from "@/app/types"
import type { OrderListItem } from "@/app/orders/order-list-description"

export interface OrderParams {
  siteId: string;
  status?: string;
  paymentStatus?: string;
  q?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  sort?: string;
}

export interface OrderWithRelations extends SaleOrderData {
  sales?: {
    status: string;
    source: string;
    amount: number;
    payment_method: string;
    amount_due: number;
    payments?: Array<{ id?: string; date: string; amount: number; method: string; notes?: string }>;
  };
  leads?: { id: string; name: string; email?: string; phone?: string };
  shipments?: { id: string; status: string; tracking_number?: string; carrier?: string }[];
  price_lists?: { name: string };
  promotions?: { name: string; code: string };
  sale_order_items?: Array<
    OrderListItem & {
      id?: string;
      catalog_item_id?: string | null;
      unit_price?: number | null;
      status?: string | null;
    }
  >;
  created_by?: { id: string; name?: string | null; email?: string | null } | null;
  seller?: { id: string; name?: string | null; email?: string | null } | null;
  requested_by?: { id: string; name?: string | null; email?: string | null } | null;
}
