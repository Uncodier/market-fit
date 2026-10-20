import { CatalogItem } from "@/app/types";
import type { CatalogResultKind } from "@/lib/catalog-search/types";

export type CatalogSort = 'display_order' | 'newest' | 'oldest' | 'updated_at';

export interface CatalogListParams {
  siteId: string;
  kind?: 'product' | 'service' | 'digital_asset' | 'variant' | 'all';
  digitalSubtype?: 'ticket' | 'course' | 'file' | 'pass' | 'license' | 'all';
  isMarketplaceListed?: boolean;
  q?: string;
  search_id?: string;
  status?: 'active' | 'archived' | 'all';
  availabilityStatus?: 'available' | 'unavailable' | 'sold_out' | 'all';
  page?: number;
  pageSize?: number;
  /** Omitted by existing pickers/POS to retain catalog display order. */
  sortBy?: CatalogSort;
  isPosAvailable?: boolean;
  isRecurring?: boolean;
  isReservation?: boolean;
}

export interface CatalogListResponse {
  data: CatalogItem[];
  count: number;
  count_kind?: 'candidate_window';
  candidate_window_truncated?: boolean;
  has_more?: boolean;
  mode?: 'hybrid' | 'text';
  result_kind?: CatalogResultKind;
  degraded?: boolean;
  search_id?: string;
  error?: string;
  error_status?: number;
}

export interface CatalogAvailabilityResult {
  sellable: boolean;
  reason?: string;
  availableQty?: number;
  policy: 'allow' | 'warn' | 'block';
}
