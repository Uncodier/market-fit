import { formatPromotionDiscountLabel } from "./bogo-discount";
import {
  isPromotionAvailableForStorefront,
  type MerchandisingPromotion,
  type StorefrontSurface,
} from "./promotion-availability";

export type PromoBadge = {
  promotionId: string;
  /** English fallback; prefer formatting from discount fields with locale. */
  label: string;
  href: string;
  discount_type?: string;
  discount_value?: number | null;
  bogo_buy_qty?: number | null;
  bogo_get_qty?: number | null;
};

export type StorefrontPromoCard = MerchandisingPromotion & {
  catalog_item_ids: string[];
  category_ids: string[];
};

export type ShopMerchandisingPlacement = {
  general: StorefrontPromoCard[];
  byItemId: Record<string, PromoBadge>;
  byCategoryId: Record<string, StorefrontPromoCard[]>;
};

export type MarketplaceMerchandisingPlacement = {
  discountsFeed: StorefrontPromoCard[];
  byItemId: Record<string, PromoBadge>;
};

export function promoBadgeLabel(
  promo: {
    discount_type?: string;
    discount_value?: number | null;
    bogo_buy_qty?: number | null;
    bogo_get_qty?: number | null;
  },
  t?: import("./bogo-discount").DiscountLabelTranslate,
): string {
  return formatPromotionDiscountLabel(
    {
      discount_type: promo.discount_type || "percent",
      discount_value: promo.discount_value,
      bogo_buy_qty: promo.bogo_buy_qty,
      bogo_get_qty: promo.bogo_get_qty,
    },
    t,
  );
}

function normalizePromo(promo: MerchandisingPromotion): StorefrontPromoCard {
  return {
    ...promo,
    catalog_item_ids: promo.catalog_item_ids || [],
    category_ids: promo.category_ids || [],
  };
}

function isItemTargeted(promo: StorefrontPromoCard): boolean {
  return (
    promo.applies_to === "selected_items" && promo.catalog_item_ids.length > 0
  );
}

function isCategoryOnly(promo: StorefrontPromoCard): boolean {
  return (
    promo.applies_to === "selected_items" &&
    promo.catalog_item_ids.length === 0 &&
    promo.category_ids.length > 0
  );
}

export function placeShopMerchandising(params: {
  promotions: MerchandisingPromotion[];
  timezone?: string | null;
  hrefFor: (promotionId: string) => string;
  now?: Date;
}): ShopMerchandisingPlacement {
  const general: StorefrontPromoCard[] = [];
  const byItemId: Record<string, PromoBadge> = {};
  const byCategoryId: Record<string, StorefrontPromoCard[]> = {};

  for (const raw of params.promotions) {
    if (
      !isPromotionAvailableForStorefront({
        promo: raw,
        surface: "shop",
        timezone: params.timezone,
        now: params.now,
      })
    ) {
      continue;
    }

    const promo = normalizePromo(raw);

    if (promo.applies_to === "all") {
      general.push(promo);
      continue;
    }

    if (isItemTargeted(promo)) {
      const badge: PromoBadge = {
        promotionId: promo.id,
        label: promoBadgeLabel(promo),
        href: params.hrefFor(promo.id),
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        bogo_buy_qty: promo.bogo_buy_qty,
        bogo_get_qty: promo.bogo_get_qty,
      };
      for (const itemId of promo.catalog_item_ids) {
        if (!byItemId[itemId]) byItemId[itemId] = badge;
      }
      continue;
    }

    if (isCategoryOnly(promo)) {
      for (const catId of promo.category_ids) {
        if (!byCategoryId[catId]) byCategoryId[catId] = [];
        byCategoryId[catId].push(promo);
      }
    }
  }

  return { general, byItemId, byCategoryId };
}

export function placeMarketplaceMerchandising(params: {
  promotions: MerchandisingPromotion[];
  timezone?: string | null;
  hrefFor: (promotionId: string) => string;
  now?: Date;
}): MarketplaceMerchandisingPlacement {
  const discountsFeed: StorefrontPromoCard[] = [];
  const byItemId: Record<string, PromoBadge> = {};

  for (const raw of params.promotions) {
    if (
      !isPromotionAvailableForStorefront({
        promo: raw,
        surface: "marketplace",
        timezone: params.timezone,
        now: params.now,
      })
    ) {
      continue;
    }

    const promo = normalizePromo(raw);
    discountsFeed.push(promo);

    if (isItemTargeted(promo)) {
      const badge: PromoBadge = {
        promotionId: promo.id,
        label: promoBadgeLabel(promo),
        href: params.hrefFor(promo.id),
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        bogo_buy_qty: promo.bogo_buy_qty,
        bogo_get_qty: promo.bogo_get_qty,
      };
      for (const itemId of promo.catalog_item_ids) {
        if (!byItemId[itemId]) byItemId[itemId] = badge;
      }
    }
  }

  return { discountsFeed, byItemId };
}

export function filterSurfacePromotions(
  promotions: MerchandisingPromotion[],
  surface: StorefrontSurface,
  timezone?: string | null,
  now?: Date,
): MerchandisingPromotion[] {
  return promotions.filter((promo) =>
    isPromotionAvailableForStorefront({ promo, surface, timezone, now }),
  );
}
