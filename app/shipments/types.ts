import { Shipment } from "@/app/types"

export interface ShipmentParams {
  siteId: string;
  status?: string;
  leadId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ShipmentWithRelations extends Shipment {
  leads?: { name: string; email?: string; phone?: string };
  sale_orders?: { order_number: string; total: number };
  locations?: { name: string }; // origin_location
}
