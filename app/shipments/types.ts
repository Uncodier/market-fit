import { Shipment } from "@/app/types"

export interface ShipmentParams {
  siteId: string;
  status?: string;
  leadId?: string;
  q?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

export interface ShipmentWithRelations extends Shipment {
  leads?: { name: string; email?: string; phone?: string };
  sale_orders?: {
    order_number: string;
    total: number;
    status?: string;
    sale_order_items?: Array<{
      id: string;
      catalog_item_id?: string;
      name: string;
      quantity: number;
      status?: string;
      shipment_id?: string | null;
    }>;
  };
  locations?: { name: string };
  assignee_profile?: { name: string } | null;
}
