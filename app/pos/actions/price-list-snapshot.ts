import type { requirePosSiteAccess } from "./site-access";
import type { LocalPriceListItem } from "../local/types";

type PosClient = Extract<Awaited<ReturnType<typeof requirePosSiteAccess>>, { supabase: unknown }>["supabase"];

/** Bound both the URL's ID set and each response; never issue one read per product. */
export async function readPosPriceListItems(supabase: PosClient, siteId: string, listIds: string[]) {
  const items: LocalPriceListItem[] = [];
  for (let start = 0; start < listIds.length; start += 100) {
    const batch = listIds.slice(start, start + 100);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("price_list_items")
        .select("id, price_list_id, catalog_item_id, unit_price")
        .eq("site_id", siteId).in("price_list_id", batch)
        .order("id", { ascending: true }).range(offset, offset + 999);
      if (error || !Array.isArray(data)) throw new Error("Failed to load POS price list items");
      items.push(...data);
      if (data.length < 1000) break;
    }
  }
  return items;
}