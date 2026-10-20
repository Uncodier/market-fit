import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isPriceListAllowedForChannel,
  type PriceListChannel,
} from "./price-list-channels";

type PriceListRow = {
  id: string;
  site_id: string;
  currency?: string | null;
  channels?: string[] | null;
};

/**
 * For each site, pick the default active price list that allows `channel`.
 * Returns catalog_item_id → unit_price (skips zero / null rows).
 */
export async function loadChannelPriceMap(
  supabase: SupabaseClient,
  siteIds: string[],
  channel: PriceListChannel,
  itemIds: string[],
  siteIdByItemId?: ReadonlyMap<string, string>,
): Promise<{
  priceByItemId: Map<string, number>;
  currencyBySiteId: Map<string, string>;
  listIdBySiteId: Map<string, string>;
}> {
  const uniqueSiteIds = Array.from(new Set(siteIds.filter(Boolean)));
  const priceByItemId = new Map<string, number>();
  const currencyBySiteId = new Map<string, string>();
  const listIdBySiteId = new Map<string, string>();

  const uniqueItemIds = Array.from(new Set(itemIds.filter(Boolean)));
  if (uniqueSiteIds.length === 0 || uniqueItemIds.length === 0) {
    return { priceByItemId, currencyBySiteId, listIdBySiteId };
  }

  if (uniqueSiteIds.length > 1 && !siteIdByItemId) {
    throw new Error("Item ownership is required to load channel prices");
  }
  const lists: PriceListRow[] = [];
  for (const siteChunk of chunks(uniqueSiteIds)) {
    for (let from = 0; ; from += ROW_PAGE_SIZE) {
      const result = await supabase.from("price_lists")
        .select("id, site_id, currency, channels").in("site_id", siteChunk)
        .eq("is_default", true).eq("is_active", true).order("id")
        .range(from, from + ROW_PAGE_SIZE - 1);
      if (result.error) throw new Error("Unable to load channel price lists");
      lists.push(...(result.data || []));
      if ((result.data || []).length < ROW_PAGE_SIZE) break;
    }
  }

  const usable = ((lists || []) as PriceListRow[]).filter((list) =>
    isPriceListAllowedForChannel(list.channels, channel)
  );

  for (const list of usable) {
    listIdBySiteId.set(list.site_id, list.id);
    if (list.currency) currencyBySiteId.set(list.site_id, list.currency);
  }

  const listIds = Array.from(listIdBySiteId.values());
  if (listIds.length === 0) {
    return { priceByItemId, currencyBySiteId, listIdBySiteId };
  }

  const siteByListId = new Map(Array.from(listIdBySiteId, ([site, list]) => [list, site]));
  for (const listChunk of chunks(listIds)) {
    for (const itemChunk of chunks(uniqueItemIds)) {
      for (let from = 0; ; from += ROW_PAGE_SIZE) {
        const result = await supabase.from("price_list_items")
          .select("price_list_id, catalog_item_id, unit_price")
          .in("price_list_id", listChunk).in("catalog_item_id", itemChunk)
          .order("price_list_id").order("catalog_item_id")
          .range(from, from + ROW_PAGE_SIZE - 1);
        if (result.error) throw new Error("Unable to load channel prices");
        for (const row of result.data || []) {
          const ownerSite = siteIdByItemId?.get(row.catalog_item_id) ||
            (uniqueSiteIds.length === 1 ? uniqueSiteIds[0] : undefined);
          if (!ownerSite || !itemChunk.includes(row.catalog_item_id) || siteByListId.get(row.price_list_id) !== ownerSite) continue;
          const price = Number(row.unit_price);
          if (row.unit_price == null || !Number.isFinite(price) || price <= 0) continue;
          priceByItemId.set(row.catalog_item_id, price);
        }
        if ((result.data || []).length < ROW_PAGE_SIZE) break;
      }
    }
  }

  return { priceByItemId, currencyBySiteId, listIdBySiteId };
}

const ROW_PAGE_SIZE = 500;
function chunks(ids: string[]): string[][] {
  const result: string[][] = [];
  for (let start = 0; start < ids.length; start += 200) result.push(ids.slice(start, start + 200));
  return result;
}

/** Overlay default channel price-list unit prices onto catalog rows. */
export async function applyChannelPricesToItems<
  T extends {
    id: string;
    site_id: string;
    target_sale_price?: number | null;
    currency?: string | null;
  },
>(
  supabase: SupabaseClient,
  items: T[],
  channel: PriceListChannel
): Promise<T[]> {
  if (!items.length) return items;

  const { priceByItemId, currencyBySiteId } = await loadChannelPriceMap(
    supabase,
    items.map((item) => item.site_id),
    channel,
    items.map((item) => item.id),
    new Map(items.map((item) => [item.id, item.site_id])),
  );

  return items.map((item) => {
    const mappedPrice = priceByItemId.get(item.id);
    return {
      ...item,
      currency: item.currency || currencyBySiteId.get(item.site_id) || "USD",
      target_sale_price:
        mappedPrice != null ? mappedPrice : item.target_sale_price,
    };
  });
}
