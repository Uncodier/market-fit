import { SaleOrderData, SaleOrder } from "@/app/types"

export interface OrderParams {
  siteId: string;
  status?: string;
  q?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

export interface OrderWithRelations extends SaleOrderData {
  sales?: { status: string; source: string; amount: number; payment_method: string; amount_due: number };
  leads?: { id: string; name: string; email?: string; phone?: string };
  shipments?: { id: string; status: string; tracking_number?: string; carrier?: string }[];
  price_lists?: { name: string };
  promotions?: { name: string; code: string };
  sale_order_items?: any[];
}
