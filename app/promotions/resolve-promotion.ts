import { createClient, createServiceClient } from "@/lib/supabase/server";

export type PromotionCartLine = {
  catalogItemId: string;
  subtotal: number;
};

export type ResolvePromotionParams = {
  siteId: string;
  code: string;
  lines: PromotionCartLine[];
  buyerUserId?: string | null;
  leadId?: string | null;
  /** Exclude this order when counting per-user usage (apply on existing order). */
  excludeOrderId?: string | null;
  forceServiceRole?: boolean;
};

export type ResolvePromotionResult = {
  promotionId: string;
  promotionName: string;
  discount: number;
  orderSubtotal: number;
};

function normalizePromotionCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Validate a promotion code against cart lines and compute the discount.
 * Does not mutate any database rows.
 */
export async function resolvePromotionDiscount(
  params: ResolvePromotionParams
): Promise<{ data: ResolvePromotionResult } | { error: string }> {
  try {
    const {
      siteId,
      lines,
      buyerUserId,
      leadId,
      excludeOrderId,
      forceServiceRole = false,
    } = params;

    const code = normalizePromotionCode(params.code);
    if (!code) return { error: "Invalid or inactive promotion code" };
    if (!lines || lines.length === 0) return { error: "Order has no items" };

    const supabase = forceServiceRole
      ? await createServiceClient(true)
      : await createClient();

    const { data: promo } = await supabase
      .from("promotions")
      .select("*")
      .eq("site_id", siteId)
      .eq("code", code)
      .eq("status", "active")
      .single();

    if (!promo) return { error: "Invalid or inactive promotion code" };

    const now = new Date();
    if (promo.starts_at && new Date(promo.starts_at) > now) {
      return { error: "Promotion has not started yet" };
    }
    if (promo.ends_at && new Date(promo.ends_at) < now) {
      return { error: "Promotion has expired" };
    }

    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
      return { error: "Promotion usage limit reached" };
    }

    const orderSubtotal = lines.reduce((sum, item) => sum + Number(item.subtotal), 0);

    if (promo.min_order_amount && orderSubtotal < promo.min_order_amount) {
      return { error: `Order must be at least ${promo.min_order_amount}` };
    }

    if (promo.usage_limit_per_user) {
      const identityField = buyerUserId ? "buyer_user_id" : leadId ? "lead_id" : null;
      if (!identityField) {
        return { error: "Promotion requires an identifiable buyer" };
      }
      const identityValue = buyerUserId || leadId;

      let usageQuery = supabase
        .from("sale_orders")
        .select("id", { count: "exact", head: true })
        .eq("promotion_id", promo.id)
        .eq(identityField, identityValue);

      if (excludeOrderId) {
        usageQuery = usageQuery.neq("id", excludeOrderId);
      }

      const { count: priorUses } = await usageQuery.not(
        "status",
        "in",
        "(cancelled,canceled)"
      );

      if ((priorUses ?? 0) >= promo.usage_limit_per_user) {
        return { error: "You have already used this promotion the maximum number of times" };
      }
    }

    let discount = 0;
    if (promo.applies_to === "all") {
      discount =
        promo.discount_type === "fixed"
          ? Number(promo.discount_value)
          : orderSubtotal * (Number(promo.discount_value) / 100);
    } else {
      const { data: pItems } = await supabase
        .from("promotion_catalog_items")
        .select("catalog_item_id")
        .eq("promotion_id", promo.id);
      const eligibleItemIds = new Set(pItems?.map((p: any) => p.catalog_item_id) || []);

      const { data: pCats } = await supabase
        .from("promotion_catalog_categories")
        .select("catalog_category_id")
        .eq("promotion_id", promo.id);
      const eligibleCategoryIds = new Set(pCats?.map((p: any) => p.catalog_category_id) || []);

      if (eligibleItemIds.size === 0 && eligibleCategoryIds.size === 0) {
        return { error: "Promotion has no eligible products or categories configured" };
      }

      const itemIds = lines.map((i) => i.catalogItemId);
      const { data: catalogItems } = await supabase
        .from("catalog_items")
        .select("id, category_id")
        .in("id", itemIds);
      const itemCatMap = new Map(catalogItems?.map((ci: any) => [ci.id, ci.category_id]));

      let eligibleSubtotal = 0;
      for (const item of lines) {
        const catId = itemCatMap.get(item.catalogItemId);
        const isEligible =
          eligibleItemIds.has(item.catalogItemId) ||
          (catId && eligibleCategoryIds.has(catId));
        if (isEligible) eligibleSubtotal += Number(item.subtotal);
      }

      if (eligibleSubtotal <= 0) {
        return { error: "No eligible items for this promotion" };
      }

      discount =
        promo.discount_type === "fixed"
          ? Math.min(Number(promo.discount_value), eligibleSubtotal)
          : eligibleSubtotal * (Number(promo.discount_value) / 100);
    }

    discount = Math.min(discount, orderSubtotal);

    return {
      data: {
        promotionId: promo.id,
        promotionName: promo.name,
        discount,
        orderSubtotal,
      },
    };
  } catch (error: any) {
    return { error: error.message || "Failed to resolve promotion" };
  }
}
