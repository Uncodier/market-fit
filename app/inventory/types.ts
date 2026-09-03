import { Location, InventoryLevel, CatalogItem } from "@/app/types"

export interface InventoryLevelWithCatalog extends InventoryLevel {
  catalog_item: CatalogItem;
}

export interface InventoryParams {
  siteId: string;
  locationId?: string;
  catalogItemId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}
