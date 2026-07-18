import { PriceList, PriceListItem, CatalogItem } from "@/app/types";

export interface PriceListParams {
  siteId: string;
  page?: number;
  pageSize?: number;
}

export interface PriceListItemWithCatalog extends PriceListItem {
  catalog_item: CatalogItem;
}
