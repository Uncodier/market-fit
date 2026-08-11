import type { LocalPriceList, LocalPriceListItem } from "./types";

export type ResolveUnitPriceLocalInput = {
  catalogItemId: string;
  targetSalePrice?: number | null;
  priceListId?: string | null;
  priceLists: LocalPriceList[];
  priceListItems: LocalPriceListItem[];
};

/**
 * Pure local equivalent of resolveUnitPrice (server action).
 * Uses cached price lists / items + catalog fallback.
 */
export function resolveUnitPriceLocal(input: ResolveUnitPriceLocalInput): {
  price: number;
  priceListId?: string;
} {
  const {
    catalogItemId,
    targetSalePrice,
    priceListId,
    priceLists,
    priceListItems,
  } = input;

  let resolvedListId = priceListId || undefined;

  if (!resolvedListId) {
    const defaultList = priceLists.find((pl) => pl.is_default && pl.is_active);
    if (defaultList) resolvedListId = defaultList.id;
  }

  if (resolvedListId) {
    const list = priceLists.find((pl) => pl.id === resolvedListId);
    if (list?.is_active) {
      const pli = priceListItems.find(
        (row) =>
          row.price_list_id === resolvedListId &&
          row.catalog_item_id === catalogItemId,
      );
      if (pli) {
        return { price: Number(pli.unit_price) || 0, priceListId: resolvedListId };
      }
    }
  }

  return {
    price: Number(targetSalePrice) || 0,
    priceListId: resolvedListId,
  };
}
