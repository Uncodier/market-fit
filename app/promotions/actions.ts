"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PromotionParams, PromotionWithCampaign } from "./types";
import { Promotion } from "@/app/types";
import {
  resolvePromotionDiscount,
  type PromotionCartLine,
} from "./resolve-promotion";

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

export async function upsertPromotion(promotion: Partial<Promotion>) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("promotions")
      .upsert({ ...promotion, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw new Error(error.message);
    
    revalidatePath(`/promotions`);
    if (promotion.id) revalidatePath(`/promotions/${promotion.id}`);
    if (promotion.campaign_id) revalidatePath(`/campaigns/${promotion.campaign_id}`);
    
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
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deletePromotion(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("promotions")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
    
    revalidatePath(`/promotions`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function previewPromotionForCart(params: {
  siteId: string;
  code: string;
  lines: PromotionCartLine[];
  buyerUserId?: string | null;
  leadId?: string | null;
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

export async function applyPromotionToOrder(
  siteId: string,
  saleOrderId: string,
  promotionCode: string,
  forceServiceRole: boolean = false
) {
  try {
    const supabase = forceServiceRole ? await createServiceClient(true) : await createClient();

    const { data: items } = await supabase
      .from("sale_order_items")
      .select("catalog_item_id, subtotal")
      .eq("sale_order_id", saleOrderId);
    if (!items || items.length === 0) throw new Error("Order has no items");

    const { data: order } = await supabase
      .from("sale_orders")
      .select("id, sale_id, tax_total, buyer_user_id, lead_id")
      .eq("id", saleOrderId)
      .single();
    if (!order) throw new Error("Order not found");

    const resolved = await resolvePromotionDiscount({
      siteId,
      code: promotionCode,
      lines: items.map((item: any) => ({
        catalogItemId: item.catalog_item_id,
        subtotal: Number(item.subtotal),
      })),
      buyerUserId: order.buyer_user_id,
      leadId: order.lead_id,
      excludeOrderId: saleOrderId,
      forceServiceRole,
    });

    if ("error" in resolved) throw new Error(resolved.error);

    const { promotionId, discount, orderSubtotal } = resolved.data;
    const taxTotal = Number(order.tax_total) || 0;
    const total = Math.max(0, orderSubtotal - discount + taxTotal);

    const { error: updateError } = await supabase
      .from("sale_orders")
      .update({
        promotion_id: promotionId,
        discount_total: discount,
        total: total,
      })
      .eq("id", saleOrderId);

    if (updateError) throw new Error(updateError.message);

    if (order.sale_id) {
      await supabase.from("sales").update({ amount: total, amount_due: total }).eq("id", order.sale_id);
    }

    const { data: promo } = await supabase
      .from("promotions")
      .select("usage_count")
      .eq("id", promotionId)
      .single();

    await supabase
      .from("promotions")
      .update({ usage_count: (promo?.usage_count ?? 0) + 1 })
      .eq("id", promotionId);

    return { success: true, discount, total };
  } catch (error: any) {
    return { error: error.message };
  }
}
