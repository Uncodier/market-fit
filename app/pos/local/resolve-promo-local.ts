import {
  assertPromotionChannelAccess,
} from "@/app/promotions/promotion-channels";
import type { LocalPromotion } from "./types";

export type LocalPromoLine = {
  catalogItemId: string;
  categoryId?: string | null;
  subtotal: number;
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Local preview of promotion discount. Server re-validates on sync.
 * Skips per-user usage counts (requires live DB).
 */
export function resolvePromotionDiscountLocal(params: {
  code: string;
  promotions: LocalPromotion[];
  lines: LocalPromoLine[];
  locationId?: string | null;
}):
  | {
      data: {
        promotionId: string;
        promotionName: string;
        discount: number;
        orderSubtotal: number;
      };
    }
  | { error: string } {
  const code = normalizeCode(params.code);
  if (!code) return { error: "Invalid or inactive promotion code" };
  if (!params.lines.length) return { error: "Order has no items" };

  const promo = params.promotions.find(
    (p) =>
      p.status === "active" && normalizeCode(p.code || "") === code,
  );
  if (!promo) return { error: "Invalid or inactive promotion code" };

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

  let discount = 0;
  if (promo.applies_to === "all") {
    discount =
      promo.discount_type === "fixed"
        ? Number(promo.discount_value)
        : orderSubtotal * (Number(promo.discount_value) / 100);
  } else {
    const eligibleItemIds = new Set(promo.catalog_item_ids || []);
    const eligibleCategoryIds = new Set(promo.category_ids || []);
    if (eligibleItemIds.size === 0 && eligibleCategoryIds.size === 0) {
      return { error: "Promotion has no eligible products or categories configured" };
    }

    let eligibleSubtotal = 0;
    for (const line of params.lines) {
      const eligible =
        eligibleItemIds.has(line.catalogItemId) ||
        (!!line.categoryId && eligibleCategoryIds.has(line.categoryId));
      if (eligible) eligibleSubtotal += Number(line.subtotal);
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
}
