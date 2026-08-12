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
  channel: PriceListChannel
): Promise<{
  priceByItemId: Map<string, number>;
  currencyBySiteId: Map<string, string>;
  listIdBySiteId: Map<string, string>;
}> {
  const uniqueSiteIds = Array.from(new Set(siteIds.filter(Boolean)));
  const priceByItemId = new Map<string, number>();
  const currencyBySiteId = new Map<string, string>();
  const listIdBySiteId = new Map<string, string>();

  if (uniqueSiteIds.length === 0) {
    return { priceByItemId, currencyBySiteId, listIdBySiteId };
  }

  const { data: lists } = await supabase
    .from("price_lists")
    .select("id, site_id, currency, channels")
    .in("site_id", uniqueSiteIds)
    .eq("is_default", true)
    .eq("is_active", true);

  const usable = ((lists || []) as PriceListRow[]).filter((list) =>
    isPriceListAllowedForChannel(list.channels, channel)
  );

  for (const list of usable) {
    listIdBySiteId.set(list.site_id, list.id);
    if (list.currency) currencyBySiteId.set(list.site_id, list.currency);
  }

  const listIds = usable.map((l) => l.id);
  if (listIds.length === 0) {
    return { priceByItemId, currencyBySiteId, listIdBySiteId };
  }

  const { data: prices } = await supabase
    .from("price_list_items")
    .select("catalog_item_id, unit_price")
    .in("price_list_id", listIds);

  for (const row of prices || []) {
    if (row.unit_price == null || Number(row.unit_price) === 0) continue;
    priceByItemId.set(row.catalog_item_id, Number(row.unit_price));
  }

  return { priceByItemId, currencyBySiteId, listIdBySiteId };
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
    channel
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
