import { checkPromotionWeekday } from "./promotion-conditions";
import {
  isPromotionAllowedForChannel,
  type PromotionChannel,
} from "./promotion-channels";

export type StorefrontSurface = "shop" | "marketplace";

export type MerchandisingPromotion = {
  id: string;
  status?: string;
  channels?: string[] | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active_weekdays?: number[] | null;
  usage_limit?: number | null;
  usage_count?: number | null;
  show_on_shop?: boolean | null;
  show_on_marketplace?: boolean | null;
  image_url?: string | null;
  applies_to?: string | null;
  name?: string;
  code?: string | null;
  discount_type?: string;
  discount_value?: number | null;
  bogo_buy_qty?: number | null;
  bogo_get_qty?: number | null;
  description?: string | null;
  catalog_item_ids?: string[];
  category_ids?: string[];
  site_id?: string;
};

/**
 * Whether a promotion may be linked/rendered on a storefront surface.
 * Does not consider schedule, weekday, or usage windows.
 */
export function isPromotionEligibleForStorefront(params: {
  promo: MerchandisingPromotion;
  surface: StorefrontSurface;
}): boolean {
  const { promo, surface } = params;

  if (promo.status !== "active") return false;

  if (surface === "shop" && !promo.show_on_shop) return false;
  if (surface === "marketplace" && !promo.show_on_marketplace) return false;

  if (
    !isPromotionAllowedForChannel(
      promo.channels as PromotionChannel[] | null | undefined,
      surface,
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Whether a promotion is currently within its schedule / weekday / usage window.
 */
export function isPromotionCurrentlyRunnable(params: {
  promo: MerchandisingPromotion;
  timezone?: string | null;
  now?: Date;
}): boolean {
  const { promo } = params;
  const now = params.now || new Date();

  if (promo.starts_at && new Date(promo.starts_at) > now) return false;
  if (promo.ends_at && new Date(promo.ends_at) < now) return false;

  const weekdayError = checkPromotionWeekday({
    activeWeekdays: promo.active_weekdays,
    timezone: params.timezone,
  });
  if (weekdayError) return false;

  if (
    promo.usage_limit != null &&
    promo.usage_count != null &&
    promo.usage_count >= promo.usage_limit
  ) {
    return false;
  }

  return true;
}

/**
 * Whether a promotion may appear on a storefront merchandising surface.
 * Requires show flag + channel access + schedule/usage availability.
 */
export function isPromotionAvailableForStorefront(params: {
  promo: MerchandisingPromotion;
  surface: StorefrontSurface;
  timezone?: string | null;
  now?: Date;
}): boolean {
  if (
    !isPromotionEligibleForStorefront({
      promo: params.promo,
      surface: params.surface,
    })
  ) {
    return false;
  }

  return isPromotionCurrentlyRunnable({
    promo: params.promo,
    timezone: params.timezone,
    now: params.now,
  });
}
