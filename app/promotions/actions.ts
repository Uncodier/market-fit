"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PromotionParams, PromotionWithCampaign } from "./types";
import { Promotion } from "@/app/types";

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

export async function applyPromotionToOrder(siteId: string, saleOrderId: string, promotionCode: string, forceServiceRole: boolean = false) {
  try {
    const supabase = forceServiceRole ? await createServiceClient(true) : await createClient();
    
    // 1. Find active promotion
    const { data: promo } = await supabase
      .from("promotions")
      .select("*")
      .eq("site_id", siteId)
      .eq("code", promotionCode)
      .eq("status", "active")
      .single();
      
    if (!promo) throw new Error("Invalid or inactive promotion code");
    
    // 2. Validate dates
    const now = new Date();
    if (promo.starts_at && new Date(promo.starts_at) > now) throw new Error("Promotion has not started yet");
    if (promo.ends_at && new Date(promo.ends_at) < now) throw new Error("Promotion has expired");
    
    // 3. Validate usage limit
    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) throw new Error("Promotion usage limit reached");

    // 4. Load order items & calculate total to check min_order_amount
    const { data: items } = await supabase.from("sale_order_items").select("*").eq("sale_order_id", saleOrderId);
    if (!items || items.length === 0) throw new Error("Order has no items");

    const orderSubtotal = items.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0);
    
    if (promo.min_order_amount && orderSubtotal < promo.min_order_amount) {
      throw new Error(`Order must be at least ${promo.min_order_amount}`);
    }

    // 4b. Load order & check per-user limit
    const { data: order } = await supabase.from("sale_orders").select("id, sale_id, tax_total, buyer_user_id, lead_id").eq("id", saleOrderId).single();
    if (!order) throw new Error("Order not found");

    if (promo.usage_limit_per_user) {
      const identityField = order.buyer_user_id ? 'buyer_user_id' : (order.lead_id ? 'lead_id' : null);
      if (!identityField) {
        throw new Error("Promotion requires an identifiable buyer");
      }
      const identityValue = order.buyer_user_id || order.lead_id;

      const { count: priorUses } = await supabase
        .from("sale_orders")
        .select("id", { count: "exact", head: true })
        .eq("promotion_id", promo.id)
        .eq(identityField, identityValue)
        .neq("id", saleOrderId)
        .not("status", "in", "(cancelled,canceled)");

      if ((priorUses ?? 0) >= promo.usage_limit_per_user) {
        throw new Error("You have already used this promotion the maximum number of times");
      }
    }

    // 5. Calculate discount
    let discount = 0;
    if (promo.applies_to === 'all') {
      discount = promo.discount_type === 'fixed' 
        ? promo.discount_value 
        : orderSubtotal * (promo.discount_value / 100);
    } else {
      // selected_items: products and/or categories
      const { data: pItems } = await supabase.from("promotion_catalog_items").select("catalog_item_id").eq("promotion_id", promo.id);
      const eligibleItemIds = new Set(pItems?.map((p: any) => p.catalog_item_id) || []);
      
      const { data: pCats } = await supabase.from("promotion_catalog_categories").select("catalog_category_id").eq("promotion_id", promo.id);
      const eligibleCategoryIds = new Set(pCats?.map((p: any) => p.catalog_category_id) || []);

      if (eligibleItemIds.size === 0 && eligibleCategoryIds.size === 0) {
        throw new Error("Promotion has no eligible products or categories configured");
      }

      const itemIds = items.map((i: any) => i.catalog_item_id);
      const { data: catalogItems } = await supabase.from("catalog_items").select("id, category_id").in("id", itemIds);
      const itemCatMap = new Map(catalogItems?.map((ci: any) => [ci.id, ci.category_id]));

      let eligibleSubtotal = 0;
      for (const item of items) {
        const catId = itemCatMap.get(item.catalog_item_id);
        const isEligible = eligibleItemIds.has(item.catalog_item_id) || (catId && eligibleCategoryIds.has(catId));
        if (isEligible) eligibleSubtotal += Number(item.subtotal);
      }

      if (eligibleSubtotal <= 0) {
        throw new Error("No eligible items for this promotion");
      }

      discount = promo.discount_type === 'fixed'
        ? Math.min(promo.discount_value, eligibleSubtotal)
        : eligibleSubtotal * (promo.discount_value / 100);
    }

    // Cap discount to total
    discount = Math.min(discount, orderSubtotal);

    const taxTotal = Number(order?.tax_total) || 0;

    // 6. Update order
    const total = Math.max(0, orderSubtotal - discount + taxTotal);
    const { error: updateError } = await supabase
      .from("sale_orders")
      .update({
        promotion_id: promo.id,
        discount_total: discount,
        total: total
      })
      .eq("id", saleOrderId);

    if (updateError) throw new Error(updateError.message);
    
    // 6b. Update sale amount
    if (order?.sale_id) {
      await supabase.from("sales").update({ amount: total, amount_due: total }).eq("id", order.sale_id);
    }

    
    // 7. Increment usage count
    await supabase
      .from("promotions")
      .update({ usage_count: promo.usage_count + 1 })
      .eq("id", promo.id);

    return { success: true, discount, total };
  } catch (error: any) {
    return { error: error.message };
  }
}
