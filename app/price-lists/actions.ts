"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PriceList, PriceListItem } from "@/app/types";
import { PriceListParams, PriceListItemWithCatalog } from "./types";
import {
  isPriceListAllowedForChannel,
  normalizePriceListChannels,
  type PriceListChannel,
} from "./price-list-channels";

export async function listPriceLists({ siteId, page = 1, pageSize = 50 }: PriceListParams) {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from("price_lists")
      .select("*", { count: "exact" })
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw new Error(error.message);

    return { data: data as PriceList[], count: count || 0 };
  } catch (error: any) {
    return { data: [], count: 0, error: error.message };
  }
}

export async function getPriceList(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message };
  return { data: data as PriceList };
}

export async function upsertPriceList(list: Partial<PriceList>) {
  try {
    const supabase = await createClient();
    
    // Unset previous default if setting to default
    if (list.is_default && list.site_id) {
      await supabase
        .from("price_lists")
        .update({ is_default: false })
        .eq("site_id", list.site_id)
        .eq("is_default", true);
    }

    const payload: Partial<PriceList> & { updated_at: string } = {
      ...list,
      updated_at: new Date().toISOString(),
    };
    if (list.channels !== undefined) {
      payload.channels = normalizePriceListChannels(list.channels);
    }
    
    const { data, error } = await supabase
      .from("price_lists")
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath(`/price-lists`);
    if (data?.id) revalidatePath(`/price-lists/${data.id}`);
    return { data: data as PriceList };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function listPriceListItems(priceListId: string, siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_list_items")
      .select(`
        *,
        catalog_items(*)
      `)
      .eq("price_list_id", priceListId)
      .eq("site_id", siteId);

    if (error) throw new Error(error.message);
    
    // Format the nested object
    const items = data.map((d: any) => ({
      ...d,
      catalog_item: Array.isArray(d.catalog_items) ? d.catalog_items[0] : d.catalog_items
    }));

    return { data: items as PriceListItemWithCatalog[] };
  } catch (error: any) {
    return { error: error.message, data: [] };
  }
}

export async function setPriceListItem(siteId: string, priceListId: string, catalogItemId: string, unitPrice: number) {
  try {
    const supabase = await createClient();
    
    // Check if it exists
    const { data: existing } = await supabase
      .from("price_list_items")
      .select("id")
      .eq("price_list_id", priceListId)
      .eq("catalog_item_id", catalogItemId)
      .single();

    let res;
    if (existing) {
      res = await supabase
        .from("price_list_items")
        .update({ unit_price: unitPrice, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      res = await supabase
        .from("price_list_items")
        .insert({
          site_id: siteId,
          price_list_id: priceListId,
          catalog_item_id: catalogItemId,
          unit_price: unitPrice
        })
        .select()
        .single();
    }

    if (res.error) throw new Error(res.error.message);

    revalidatePath(`/price-lists/${priceListId}`);
    return { data: res.data as PriceListItem };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function removePriceListItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("price_list_items").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Resolves unit price using a price list when the list allows the channel.
 * 1. Uses explicit priceListId if provided (and channel-allowed)
 * 2. Fallback to site default price list that allows the channel
 * 3. Checks price_list_items (zero treated as missing)
 * 4. Fallback to catalog_item.target_sale_price
 *
 * Pass `channel` for shop / marketplace / pos. Omit for sales/quote (no channel gate).
 */
export async function resolveUnitPrice(
  siteId: string,
  catalogItemId: string,
  priceListId?: string,
  forceServiceRole: boolean = false,
  channel?: PriceListChannel | null
) {
  const supabase = forceServiceRole ? await createServiceClient(true) : await createClient();
  
  // Get item to check fallback
  const { data: item } = await supabase.from("catalog_items").select("*").eq("id", catalogItemId).single();
  if (!item) return { price: 0, error: "Item not found" };

  let resolvedListId = priceListId;

  if (!resolvedListId) {
    const { data: defaultList } = await supabase
      .from("price_lists")
      .select("id, channels")
      .eq("site_id", siteId)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();
    
    if (
      defaultList &&
      isPriceListAllowedForChannel(defaultList.channels, channel ?? undefined)
    ) {
      resolvedListId = defaultList.id;
    }
  }

  if (resolvedListId) {
    const { data: listData } = await supabase
      .from("price_lists")
      .select("is_active, channels")
      .eq("id", resolvedListId)
      .single();
    
    if (
      listData?.is_active &&
      isPriceListAllowedForChannel(listData.channels, channel ?? undefined)
    ) {
      const { data: pli } = await supabase
        .from("price_list_items")
        .select("unit_price")
        .eq("price_list_id", resolvedListId)
        .eq("catalog_item_id", catalogItemId)
        .single();
        
      // Treat zero as missing so stale PLI rows do not override catalog price.
      if (pli && pli.unit_price != null && Number(pli.unit_price) !== 0) {
        return { price: Number(pli.unit_price), priceListId: resolvedListId };
      }
    }
  }

  // Fallback
  return { price: item.target_sale_price || 0, priceListId: resolvedListId };
}
