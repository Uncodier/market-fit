"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PromotionParams, PromotionWithCampaign } from "./types";
import { Promotion } from "@/app/types";
import {
  resolvePromotionDiscount,
  type PromotionCartLine,
} from "./resolve-promotion";
import {
  normalizePromotionChannels,
  normalizePromotionLocationIds,
} from "./promotion-channels";
import { shopCacheTag } from "@/app/shop/[siteSlug]/shop-catalog-shared";

export async function listPromotions({ siteId, campaignId, status, q, page = 1, pageSize = 50 }: PromotionParams) {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from("promotions")
      .select(`
        *,
        campaigns(title)
      `, { count: "exact" })
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });

    if (campaignId) query = query.eq("campaign_id", campaignId);
    if (status && status !== 'all') query = query.eq("status", status);
    if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw new Error(error.message);

    return { data: data as any[] as PromotionWithCampaign[], count: count || 0 };
  } catch (error: any) {
    return { data: [], count: 0, error: error.message };
  }
}

export async function getPromotion(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select(`
      *,
      campaigns(title)
    `)
    .eq("id", id)
    .single();

  if (error) return { error: error.message };
  return { data: data as any as PromotionWithCampaign };
}

export async function upsertPromotion(promotion: Partial<Promotion> & Record<string, unknown>) {
  try {
    const supabase = await createClient();
    const channels = promotion.channels
      ? normalizePromotionChannels(promotion.channels)
      : undefined;
    const location_ids =
      channels && !channels.includes("pos")
        ? []
        : promotion.location_ids
          ? normalizePromotionLocationIds(promotion.location_ids)
          : promotion.location_ids;

    // Never persist joined relations (e.g. campaigns) or other non-column fields
    const {
      campaigns: _campaigns,
      catalog_item_ids: _catalogItemIds,
      category_ids: _categoryIds,
      required_items: _requiredItems,
      required_categories: _requiredCategories,
      ...rest
    } = promotion as Partial<Promotion> & {
      campaigns?: unknown
      catalog_item_ids?: unknown
      category_ids?: unknown
      required_items?: unknown
      required_categories?: unknown
    }

    const row = {
      ...rest,
      ...(channels ? { channels } : {}),
      ...(location_ids !== undefined ? { location_ids } : {}),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("promotions")
      .upsert(row)
      .select()
      .single();

    if (error) throw new Error(error.message);
    
    revalidatePath(`/promotions`);
    revalidatePath(`/marketplace`);
    if (promotion.id) revalidatePath(`/promotions/${promotion.id}`);
    if (promotion.campaign_id) revalidatePath(`/campaigns/${promotion.campaign_id}`);
    if (promotion.site_id) revalidateTag(shopCacheTag(promotion.site_id), "max");
    
    return { data: data as Promotion };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function listPromotionItems(promotionId: string, siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("promotion_catalog_items")
      .select(`
        id, catalog_item_id,
        catalog_items(name, sku, target_sale_price)
      `)
      .eq("promotion_id", promotionId)
      .eq("site_id", siteId);

    if (error) throw new Error(error.message);
    
    return { 
      data: data.map((d: any) => ({
        id: d.id,
        catalog_item_id: d.catalog_item_id,
        catalog_item: Array.isArray(d.catalog_items) ? d.catalog_items[0] : d.catalog_items
      }))
    };
  } catch (error: any) {
    return { error: error.message, data: [] };
  }
}

export async function listPromotionCategories(promotionId: string, siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("promotion_catalog_categories")
      .select(`
        id, catalog_category_id,
        catalog_categories(name)
      `)
      .eq("promotion_id", promotionId)
      .eq("site_id", siteId);

    if (error) throw new Error(error.message);
    
    return { 
      data: data.map((d: any) => ({
        id: d.id,
        catalog_category_id: d.catalog_category_id,
        catalog_category: Array.isArray(d.catalog_categories) ? d.catalog_categories[0] : d.catalog_categories
      }))
    };
  } catch (error: any) {
    return { error: error.message, data: [] };
  }
}

export async function listPromotionRequiredItems(promotionId: string, siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("promotion_required_items")
      .select(`
        id, catalog_item_id, min_quantity,
        catalog_items(name, sku, target_sale_price)
      `)
      .eq("promotion_id", promotionId)
      .eq("site_id", siteId);

    if (error) throw new Error(error.message);
    
    return { 
      data: data.map((d: any) => ({
        id: d.id,
        catalog_item_id: d.catalog_item_id,
        min_quantity: d.min_quantity,
        catalog_item: Array.isArray(d.catalog_items) ? d.catalog_items[0] : d.catalog_items
      }))
    };
  } catch (error: any) {
    return { error: error.message, data: [] };
  }
}

export async function setPromotionItems(promotionId: string, siteId: string, catalogItemIds: string[]) {
  try {
    const supabase = await createClient();
    
    // Clear old
    await supabase.from("promotion_catalog_items").delete().eq("promotion_id", promotionId);
    
    // Insert new
    if (catalogItemIds.length > 0) {
      const inserts = catalogItemIds.map(id => ({
        site_id: siteId,
        promotion_id: promotionId,
        catalog_item_id: id
      }));
      
      const { error } = await supabase.from("promotion_catalog_items").insert(inserts);
      if (error) throw new Error(error.message);
    }
    
    revalidatePath(`/promotions/${promotionId}`);
    revalidateTag(shopCacheTag(siteId), "max");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function setPromotionCategories(promotionId: string, siteId: string, catalogCategoryIds: string[]) {
  try {
    const supabase = await createClient();
    
    // Clear old
    await supabase.from("promotion_catalog_categories").delete().eq("promotion_id", promotionId);
    
    // Insert new
    if (catalogCategoryIds.length > 0) {
      const inserts = catalogCategoryIds.map(id => ({
        site_id: siteId,
        promotion_id: promotionId,
        catalog_category_id: id
      }));
      
      const { error } = await supabase.from("promotion_catalog_categories").insert(inserts);
      if (error) throw new Error(error.message);
    }
    
    revalidatePath(`/promotions/${promotionId}`);
    revalidateTag(shopCacheTag(siteId), "max");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deletePromotion(id: string) {
  try {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("promotions")
      .select("site_id")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("promotions")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
    
    revalidatePath(`/promotions`);
    if (existing?.site_id) revalidateTag(shopCacheTag(existing.site_id), "max");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function listPromotionRequiredCategories(promotionId: string, siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("promotion_required_categories")
      .select(`
        id, catalog_category_id, min_quantity,
        catalog_categories(name)
      `)
      .eq("promotion_id", promotionId)
      .eq("site_id", siteId);

    if (error) throw new Error(error.message);

    return {
      data: data.map((d: any) => ({
        id: d.id,
        catalog_category_id: d.catalog_category_id,
        min_quantity: d.min_quantity,
        catalog_category: Array.isArray(d.catalog_categories)
          ? d.catalog_categories[0]
          : d.catalog_categories,
      })),
    };
  } catch (error: any) {
    return { error: error.message, data: [] };
  }
}

export async function setPromotionRequiredItems(
  promotionId: string,
  siteId: string,
  items: { catalog_item_id: string; min_quantity: number }[]
) {
  try {
    const supabase = await createClient();
    
    // Check permission
    const { data: promo } = await supabase.from("promotions").select("id").eq("id", promotionId).eq("site_id", siteId).single();
    if (!promo) throw new Error("Promotion not found or access denied");

    await supabase.from("promotion_required_items").delete().eq("promotion_id", promotionId);

    if (items.length > 0) {
      const { error } = await supabase.from("promotion_required_items").insert(
        items.map(item => ({
          promotion_id: promotionId,
          site_id: siteId,
          catalog_item_id: item.catalog_item_id,
          min_quantity: item.min_quantity
        }))
      );
      if (error) throw new Error(error.message);
    }
    
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function setPromotionRequiredCategories(
  promotionId: string,
  siteId: string,
  categories: { catalog_category_id: string; min_quantity: number }[]
) {
  try {
    const supabase = await createClient();

    const { data: promo } = await supabase
      .from("promotions")
      .select("id")
      .eq("id", promotionId)
      .eq("site_id", siteId)
      .single();
    if (!promo) throw new Error("Promotion not found or access denied");

    await supabase
      .from("promotion_required_categories")
      .delete()
      .eq("promotion_id", promotionId);

    if (categories.length > 0) {
      const { error } = await supabase.from("promotion_required_categories").insert(
        categories.map((cat) => ({
          promotion_id: promotionId,
          site_id: siteId,
          catalog_category_id: cat.catalog_category_id,
          min_quantity: cat.min_quantity,
        }))
      );
      if (error) throw new Error(error.message);
    }

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function previewPromotionForCart(params: {
  siteId: string;
  code?: string;
  promotionId?: string;
  lines: PromotionCartLine[];
  buyerUserId?: string | null;
  leadId?: string | null;
  source?: string | null;
  locationId?: string | null;
}) {
  const result = await resolvePromotionDiscount({
    ...params,
    forceServiceRole: true,
  });

  if ("error" in result) return { error: result.error };

  return {
    discount: result.data.discount,
    promotionName: result.data.promotionName,
    promotionId: result.data.promotionId,
  };
}

