import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertPromotionChannelAccess } from "./promotion-channels";
import { checkPromotionWeekday, checkPromotionRequiredItems } from "./promotion-conditions";
import { computeBogoDiscount, lineUnitPrice } from "./bogo-discount";

export type PromotionCartLine = {
  catalogItemId: string;
  subtotal: number;
  quantity?: number;
  categoryId?: string | null;
};

export type ResolvePromotionParams = {
  siteId: string;
  /** Coupon code. Optional when promotionId is provided. */
  code?: string | null;
  /** Direct promotion id for automatic / condition-based promos without a code. */
  promotionId?: string | null;
  lines: PromotionCartLine[];
  buyerUserId?: string | null;
  leadId?: string | null;
  /** Checkout/order source used for channel targeting (marketplace, shop, pos, …). */
  source?: string | null;
  /** POS / pickup location used when channel is pos. */
  locationId?: string | null;
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
      source,
      locationId,
      excludeOrderId,
      forceServiceRole = false,
      promotionId: promotionIdParam,
    } = params;

    const code = normalizePromotionCode(params.code || "");
    if (!code && !promotionIdParam) {
      return { error: "Invalid or inactive promotion code" };
    }
    if (!lines || lines.length === 0) return { error: "Order has no items" };

    const supabase = forceServiceRole
      ? await createServiceClient(true)
      : await createClient();

    const promoQuery = supabase
      .from("promotions")
      .select("*")
      .eq("site_id", siteId)
      .eq("status", "active");

    const [{ data: promo }, { data: settings }] = await Promise.all([
      promotionIdParam
        ? promoQuery.eq("id", promotionIdParam).maybeSingle()
        : promoQuery.eq("code", code).maybeSingle(),
      supabase
        .from("settings")
        .select("business_hours")
        .eq("site_id", siteId)
        .maybeSingle(),
    ]);

    if (!promo) return { error: "Invalid or inactive promotion code" };

    // Codeless promotions may only be applied by id (condition-based auto promos)
    if (!promotionIdParam && !promo.code) {
      return { error: "Invalid or inactive promotion code" };
    }

    const channelError = assertPromotionChannelAccess({
      channels: promo.channels,
      locationIds: promo.location_ids,
      source,
      locationId,
    });
    if (channelError) return { error: channelError };

    const now = new Date();
    if (promo.starts_at && new Date(promo.starts_at) > now) {
      return { error: "Promotion has not started yet" };
    }
    if (promo.ends_at && new Date(promo.ends_at) < now) {
      return { error: "Promotion has expired" };
    }

    const businessHours = settings?.business_hours;
    const parsedHours =
      typeof businessHours === "string"
        ? (() => {
            try {
              return JSON.parse(businessHours);
            } catch {
              return null;
            }
          })()
        : businessHours;
    const timezone =
      Array.isArray(parsedHours) && parsedHours.length > 0
        ? parsedHours[0]?.timezone
        : null;

    const weekdayError = checkPromotionWeekday({
      activeWeekdays: promo.active_weekdays,
      timezone,
    });
    if (weekdayError) return { error: weekdayError };

    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
      return { error: "Promotion usage limit reached" };
    }

    const orderSubtotal = lines.reduce((sum, item) => sum + Number(item.subtotal), 0);

    if (promo.min_order_amount && orderSubtotal < promo.min_order_amount) {
      return { error: `Order must be at least ${promo.min_order_amount}` };
    }

    const [{ data: requiredItems }, { data: requiredCategories }] =
      await Promise.all([
        supabase
          .from("promotion_required_items")
          .select("catalog_item_id, min_quantity")
          .eq("promotion_id", promo.id),
        supabase
          .from("promotion_required_categories")
          .select("catalog_category_id, min_quantity")
          .eq("promotion_id", promo.id),
      ]);

    if (
      (requiredItems && requiredItems.length > 0) ||
      (requiredCategories && requiredCategories.length > 0)
    ) {
      // Resolve category_id for cart lines when not already provided
      let linesWithCategories = lines;
      const needsCategoryLookup = lines.some((l) => l.categoryId == null);
      if (needsCategoryLookup && lines.length > 0) {
        const itemIds = lines.map((i) => i.catalogItemId);
        const { data: catalogItems } = await supabase
          .from("catalog_items")
          .select("id, category_id")
          .in("id", itemIds);
        const catMap = new Map(
          (catalogItems || []).map((ci: any) => [ci.id, ci.category_id])
        );
        linesWithCategories = lines.map((l) => ({
          ...l,
          categoryId: l.categoryId ?? catMap.get(l.catalogItemId) ?? null,
        }));
      }

      const reqItemsError = checkPromotionRequiredItems({
        mode: promo.required_items_mode as "all" | "any",
        requiredItems: requiredItems || [],
        requiredCategories: requiredCategories || [],
        lines: linesWithCategories,
      });
      if (reqItemsError) return { error: reqItemsError };
    }

    if (promo.usage_limit_per_user) {
      if (!buyerUserId && !leadId) {
        return { error: "Promotion requires an identifiable buyer" };
      }

      // buyer_user_id is on sale_orders; lead_id is on sales
      let usageQuery = buyerUserId
        ? supabase
            .from("sale_orders")
            .select("id", { count: "exact", head: true })
            .eq("promotion_id", promo.id)
            .eq("buyer_user_id", buyerUserId)
        : supabase
            .from("sale_orders")
            .select("id, sales!inner(lead_id)", { count: "exact", head: true })
            .eq("promotion_id", promo.id)
            .eq("sales.lead_id", leadId!);

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
    const { data: pItems } = await supabase
      .from("promotion_catalog_items")
      .select("catalog_item_id")
      .eq("promotion_id", promo.id);
    const eligibleItemIds = new Set(
      pItems?.map((p: any) => p.catalog_item_id) || []
    );

    const { data: pCats } = await supabase
      .from("promotion_catalog_categories")
      .select("catalog_category_id")
      .eq("promotion_id", promo.id);
    const eligibleCategoryIds = new Set(
      pCats?.map((p: any) => p.catalog_category_id) || []
    );

    // selected_items with no targets configured → treat as entire order
    const scopesEntireOrder =
      promo.applies_to === "all" ||
      (eligibleItemIds.size === 0 && eligibleCategoryIds.size === 0);

    let itemCatMap = new Map<string, string | null>();
    if (!scopesEntireOrder) {
      const itemIds = lines.map((i) => i.catalogItemId);
      const { data: catalogItems } = await supabase
        .from("catalog_items")
        .select("id, category_id")
        .in("id", itemIds);
      itemCatMap = new Map(
        catalogItems?.map((ci: any) => [ci.id, ci.category_id])
      );
    }

    const isLineEligible = (item: PromotionCartLine) => {
      if (scopesEntireOrder) return true;
      const catId = item.categoryId ?? itemCatMap.get(item.catalogItemId);
      return (
        eligibleItemIds.has(item.catalogItemId) ||
        (!!catId && eligibleCategoryIds.has(catId))
      );
    };

    if (promo.discount_type === "bogo") {
      const bogoLines = lines.map((item) => ({
        unitPrice: lineUnitPrice(Number(item.subtotal), item.quantity),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        eligible: isLineEligible(item),
      }));
      if (!bogoLines.some((l) => l.eligible)) {
        return { error: "No eligible items for this promotion" };
      }
      discount = computeBogoDiscount(
        bogoLines,
        promo.bogo_buy_qty ?? 1,
        promo.bogo_get_qty ?? 1
      );
      if (discount <= 0) {
        return { error: "Not enough eligible items for this promotion" };
      }
    } else if (scopesEntireOrder) {
      discount =
        promo.discount_type === "fixed"
          ? Number(promo.discount_value)
          : orderSubtotal * (Number(promo.discount_value) / 100);
    } else {
      let eligibleSubtotal = 0;
      for (const item of lines) {
        if (isLineEligible(item)) eligibleSubtotal += Number(item.subtotal);
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
