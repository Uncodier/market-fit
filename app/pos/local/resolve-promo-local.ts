import {
  assertPromotionChannelAccess,
} from "@/app/promotions/promotion-channels";
import {
  checkPromotionWeekday,
  checkPromotionRequiredItems,
} from "@/app/promotions/promotion-conditions";
import {
  computeBogoDiscount,
  lineUnitPrice,
} from "@/app/promotions/bogo-discount";
import type { LocalPromotion } from "./types";

export type LocalPromoLine = {
  catalogItemId: string;
  categoryId?: string | null;
  subtotal: number;
  quantity?: number;
};

export type LocalPromoMatch = {
  promotionId: string;
  promotionName: string;
  code: string | null;
  discount: number;
  orderSubtotal: number;
  /** True when promo has no coupon code and activates via conditions. */
  byConditions: boolean;
  imageUrl?: string | null;
  usageLimitPerUser?: number | null;
};

/** True when the promotion can only be redeemed by an identifiable customer. */
export function promotionRequiresIdentifiableBuyer(
  usageLimitPerUser?: number | null,
): boolean {
  return Number(usageLimitPerUser) > 0;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function hasCode(promo: LocalPromotion): boolean {
  return Boolean(promo.code && String(promo.code).trim());
}

/**
 * Evaluates a single promotion against cart lines (channel, schedule, conditions, discount).
 */
export function evaluatePromotionLocal(params: {
  promo: LocalPromotion;
  lines: LocalPromoLine[];
  locationId?: string | null;
  timezone?: string | null;
}): { data: LocalPromoMatch } | { error: string } {
  const { promo } = params;
  if (!params.lines.length) return { error: "Order has no items" };
  if (promo.status !== "active") {
    return { error: "Invalid or inactive promotion code" };
  }

  const channelError = assertPromotionChannelAccess({
    channels: promo.channels,
    locationIds: promo.location_ids,
    source: "pos",
    locationId: params.locationId,
  });
  if (channelError) return { error: channelError };

  const now = new Date();
  if (promo.starts_at && new Date(promo.starts_at) > now) {
    return { error: "Promotion has not started yet" };
  }
  if (promo.ends_at && new Date(promo.ends_at) < now) {
    return { error: "Promotion has expired" };
  }

  const weekdayError = checkPromotionWeekday({
    activeWeekdays: promo.active_weekdays,
    timezone: params.timezone,
  });
  if (weekdayError) return { error: weekdayError };

  if (
    promo.usage_limit != null &&
    promo.usage_count != null &&
    promo.usage_count >= promo.usage_limit
  ) {
    return { error: "Promotion usage limit reached" };
  }

  const orderSubtotal = params.lines.reduce(
    (sum, line) => sum + Number(line.subtotal),
    0,
  );
  if (promo.min_order_amount && orderSubtotal < promo.min_order_amount) {
    return { error: `Order must be at least ${promo.min_order_amount}` };
  }

  if (
    (promo.required_items && promo.required_items.length > 0) ||
    (promo.required_categories && promo.required_categories.length > 0)
  ) {
    const reqItemsError = checkPromotionRequiredItems({
      mode: (promo.required_items_mode as "all" | "any") || "all",
      requiredItems: promo.required_items || [],
      requiredCategories: promo.required_categories || [],
      lines: params.lines,
    });
    if (reqItemsError) return { error: reqItemsError };
  }

  const eligibleItemIds = new Set(promo.catalog_item_ids || []);
  const eligibleCategoryIds = new Set(promo.category_ids || []);
  // selected_items with no targets configured → treat as entire order
  const scopesEntireOrder =
    promo.applies_to === "all" ||
    (eligibleItemIds.size === 0 && eligibleCategoryIds.size === 0);

  const isLineEligible = (line: LocalPromoLine) => {
    if (scopesEntireOrder) return true;
    return (
      eligibleItemIds.has(line.catalogItemId) ||
      (!!line.categoryId && eligibleCategoryIds.has(line.categoryId))
    );
  };

  let discount = 0;
  if (promo.discount_type === "bogo") {
    const bogoLines = params.lines.map((line) => ({
      unitPrice: lineUnitPrice(Number(line.subtotal), line.quantity),
      quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
      eligible: isLineEligible(line),
    }));
    if (!bogoLines.some((l) => l.eligible)) {
      return { error: "No eligible items for this promotion" };
    }
    discount = computeBogoDiscount(
      bogoLines,
      promo.bogo_buy_qty ?? 1,
      promo.bogo_get_qty ?? 1,
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
    for (const line of params.lines) {
      if (isLineEligible(line)) eligibleSubtotal += Number(line.subtotal);
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
      code: hasCode(promo) ? normalizeCode(String(promo.code)) : null,
      discount,
      orderSubtotal,
      byConditions: !hasCode(promo),
      imageUrl: promo.image_url || null,
      usageLimitPerUser: promo.usage_limit_per_user ?? null,
    },
  };
}

/**
 * Local preview of promotion discount by coupon code. Server re-validates on sync.
 */
export function resolvePromotionDiscountLocal(params: {
  code: string;
  promotions: LocalPromotion[];
  lines: LocalPromoLine[];
  locationId?: string | null;
  timezone?: string | null;
}): { data: LocalPromoMatch } | { error: string } {
  const code = normalizeCode(params.code);
  if (!code) return { error: "Invalid or inactive promotion code" };

  const promo = params.promotions.find(
    (p) => p.status === "active" && normalizeCode(p.code || "") === code,
  );
  if (!promo) return { error: "Invalid or inactive promotion code" };

  return evaluatePromotionLocal({
    promo,
    lines: params.lines,
    locationId: params.locationId,
    timezone: params.timezone,
  });
}

/**
 * Finds the best matching automatic (no-code) promotion whose conditions are met.
 * Prefers the largest discount.
 */
export function findMatchingConditionPromotionLocal(params: {
  promotions: LocalPromotion[];
  lines: LocalPromoLine[];
  locationId?: string | null;
  timezone?: string | null;
}): LocalPromoMatch | null {
  if (!params.lines.length) return null;

  let best: LocalPromoMatch | null = null;
  for (const promo of params.promotions) {
    if (promo.status !== "active") continue;
    if (hasCode(promo)) continue;

    const res = evaluatePromotionLocal({
      promo,
      lines: params.lines,
      locationId: params.locationId,
      timezone: params.timezone,
    });
    if ("error" in res) continue;
    if (!best || res.data.discount > best.discount) {
      best = res.data;
    }
  }
  return best;
}
