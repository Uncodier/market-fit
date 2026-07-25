import { CatalogItem } from "@/app/types";

export interface CatalogListParams {
  siteId: string;
  kind?: 'product' | 'service' | 'digital_asset' | 'all';
  digitalSubtype?: 'ticket' | 'course' | 'file' | 'pass' | 'license' | 'all';
  isMarketplaceListed?: boolean;
  q?: string;
  status?: 'active' | 'archived' | 'all';
  availabilityStatus?: 'available' | 'unavailable' | 'sold_out' | 'all';
  page?: number;
  pageSize?: number;
  isPosAvailable?: boolean;
  isRecurring?: boolean;
  isReservation?: boolean;
}

export interface CatalogListResponse {
  data: CatalogItem[];
  count: number;
  error?: string;
}

export interface CatalogAvailabilityResult {
  sellable: boolean;
  reason?: string;
  availableQty?: number;
  policy: 'allow' | 'warn' | 'block';
}
