"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PriceList, PriceListItem } from "@/app/types";
import { PriceListParams, PriceListItemWithCatalog } from "./types";

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
    
    const { data, error } = await supabase
      .from("price_lists")
      .upsert({ ...list, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath(`/price-lists`);
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
 * Resolves the unit price for a catalog item given an optional price list.
 * 1. Uses explicit priceListId if provided
 * 2. Uses lead.default_price_list_id (not passed here, caller should pass it as priceListId)
 * 3. Fallback to site default price list
 * 4. Checks price_list_items for the list
 * 5. Fallback to catalog_item.target_sale_price
 */
export async function resolveUnitPrice(siteId: string, catalogItemId: string, priceListId?: string, forceServiceRole: boolean = false) {
  const supabase = forceServiceRole ? await createServiceClient(true) : await createClient();
  
  // Get item to check fallback
  const { data: item } = await supabase.from("catalog_items").select("*").eq("id", catalogItemId).single();
  if (!item) return { price: 0, error: "Item not found" };

  let resolvedListId = priceListId;

  if (!resolvedListId) {
    const { data: defaultList } = await supabase
      .from("price_lists")
      .select("id")
      .eq("site_id", siteId)
      .eq("is_default", true)
      .eq("is_active", true)
      .single();
    
    if (defaultList) {
      resolvedListId = defaultList.id;
    }
  }

  if (resolvedListId) {
    // Verify list is active
    const { data: listData } = await supabase.from("price_lists").select("is_active").eq("id", resolvedListId).single();
    
    if (listData?.is_active) {
      const { data: pli } = await supabase
        .from("price_list_items")
        .select("unit_price")
        .eq("price_list_id", resolvedListId)
        .eq("catalog_item_id", catalogItemId)
        .single();
        
      if (pli) {
        return { price: pli.unit_price, priceListId: resolvedListId };
      }
    }
  }

  // Fallback
  return { price: item.target_sale_price || 0, priceListId: resolvedListId };
}
