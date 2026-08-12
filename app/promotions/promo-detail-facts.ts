import { formatPromotionDiscountLabel } from "./bogo-discount";

export type PromoDetailFactsTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type PromoDetailFactsInput = {
  code?: string | null;
  discount_type?: string;
  discount_value?: number | null;
  bogo_buy_qty?: number | null;
  bogo_get_qty?: number | null;
  applies_to?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active_weekdays?: number[] | null;
  min_order_amount?: number | null;
  usage_limit?: number | null;
  usage_limit_per_user?: number | null;
  required_items_mode?: "all" | "any" | null;
  required_items?: {
    catalog_item_id: string;
    min_quantity: number;
    item?: { name?: string | null } | null;
  }[];
  required_categories?: {
    catalog_category_id: string;
    min_quantity: number;
    category?: { name?: string | null } | null;
  }[];
  currency?: string | null;
};

export type PromoDetailFacts = {
  restrictions: string[];
  conditions: string[];
  specifications: string[];
};

const WEEKDAY_KEYS = [
  "common.days.short.sun",
  "common.days.short.mon",
  "common.days.short.tue",
  "common.days.short.wed",
  "common.days.short.thu",
  "common.days.short.fri",
  "common.days.short.sat",
] as const;

const WEEKDAY_FALLBACKS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function translateOrFallback(
  t: PromoDetailFactsTranslate | undefined,
  key: string,
  params: Record<string, string | number> | undefined,
  fallback: string,
): string {
  if (!t) return fallback;
  const value = params ? t(key, params) : t(key);
  if (!value || value === key) return fallback;
  return value;
}

function formatDateLabel(iso: string, locale?: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale || "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatWeekdays(
  weekdays: number[],
  t?: PromoDetailFactsTranslate,
): string {
  const labels = [...weekdays]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) =>
      translateOrFallback(t, WEEKDAY_KEYS[d], undefined, WEEKDAY_FALLBACKS[d]),
    );
  return labels.join(", ");
}

export function buildPromoDetailFacts(
  promo: PromoDetailFactsInput,
  options?: {
    t?: PromoDetailFactsTranslate;
    formatPrice?: (amount: number, currency?: string) => string;
    locale?: string | null;
  },
): PromoDetailFacts {
  const t = options?.t;
  const formatPrice = options?.formatPrice;
  const locale = options?.locale;
  const currency = (promo.currency || "USD").toUpperCase();

  const restrictions: string[] = [];
  const conditions: string[] = [];
  const specifications: string[] = [];

  // --- Restrictions ---
  if (promo.starts_at || promo.ends_at) {
    if (promo.starts_at && promo.ends_at) {
      restrictions.push(
        translateOrFallback(
          t,
          "shop.promo.fact.validFromTo",
          {
            from: formatDateLabel(promo.starts_at, locale),
            to: formatDateLabel(promo.ends_at, locale),
          },
          `Valid ${formatDateLabel(promo.starts_at, locale)} – ${formatDateLabel(promo.ends_at, locale)}`,
        ),
      );
    } else if (promo.starts_at) {
      restrictions.push(
        translateOrFallback(
          t,
          "shop.promo.fact.validFrom",
          { from: formatDateLabel(promo.starts_at, locale) },
          `Valid from ${formatDateLabel(promo.starts_at, locale)}`,
        ),
      );
    } else if (promo.ends_at) {
      restrictions.push(
        translateOrFallback(
          t,
          "shop.promo.fact.validUntil",
          { to: formatDateLabel(promo.ends_at, locale) },
          `Valid until ${formatDateLabel(promo.ends_at, locale)}`,
        ),
      );
    }
  }

  if (promo.active_weekdays && promo.active_weekdays.length > 0) {
    const days = formatWeekdays(promo.active_weekdays, t);
    restrictions.push(
      translateOrFallback(
        t,
        "shop.promo.fact.validDays",
        { days },
        `Valid on ${days}`,
      ),
    );
  }

  if (
    promo.min_order_amount != null &&
    Number(promo.min_order_amount) > 0
  ) {
    const amount = Number(promo.min_order_amount);
    const formatted = formatPrice
      ? formatPrice(amount, currency)
      : `$${amount}`;
    restrictions.push(
      translateOrFallback(
        t,
        "shop.promo.fact.minOrder",
        { amount: formatted },
        `Minimum order ${formatted}`,
      ),
    );
  }

  if (promo.usage_limit != null && Number(promo.usage_limit) > 0) {
    restrictions.push(
      translateOrFallback(
        t,
        "shop.promo.fact.usageLimit",
        { count: Number(promo.usage_limit) },
        `Limited to ${Number(promo.usage_limit)} total uses`,
      ),
    );
  }

  if (
    promo.usage_limit_per_user != null &&
    Number(promo.usage_limit_per_user) > 0
  ) {
    restrictions.push(
      translateOrFallback(
        t,
        "shop.promo.fact.usageLimitPerUser",
        { count: Number(promo.usage_limit_per_user) },
        `Limited to ${Number(promo.usage_limit_per_user)} uses per customer`,
      ),
    );
  }

  // --- Conditions ---
  const requiredItems = promo.required_items || [];
  const requiredCategories = promo.required_categories || [];
  if (requiredItems.length > 0 || requiredCategories.length > 0) {
    const mode = promo.required_items_mode === "any" ? "any" : "all";
    const modeLabel = translateOrFallback(
      t,
      mode === "any"
        ? "shop.promo.fact.requiresAny"
        : "shop.promo.fact.requiresAll",
      undefined,
      mode === "any" ? "Requires any of" : "Requires all of",
    );

    const parts: string[] = [];
    for (const row of requiredItems) {
      const name = row.item?.name || "Product";
      const qty = Math.max(1, Number(row.min_quantity) || 1);
      parts.push(
        translateOrFallback(
          t,
          "shop.promo.fact.requiredItem",
          { name, qty },
          `${name} (qty ${qty})`,
        ),
      );
    }
    for (const row of requiredCategories) {
      const name = row.category?.name || "Category";
      const qty = Math.max(1, Number(row.min_quantity) || 1);
      parts.push(
        translateOrFallback(
          t,
          "shop.promo.fact.requiredCategory",
          { name, qty },
          `${name} category (qty ${qty})`,
        ),
      );
    }

    conditions.push(`${modeLabel}: ${parts.join(", ")}`);
  }

  // --- Specifications ---
  if (promo.discount_type) {
    const discountLabel = formatPromotionDiscountLabel(
      {
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        bogo_buy_qty: promo.bogo_buy_qty,
        bogo_get_qty: promo.bogo_get_qty,
      },
      t,
    );
    specifications.push(
      translateOrFallback(
        t,
        "shop.promo.fact.discount",
        { label: discountLabel },
        discountLabel,
      ),
    );
  }

  if (promo.code) {
    specifications.push(
      translateOrFallback(
        t,
        "shop.promo.fact.code",
        { code: promo.code },
        `Code ${promo.code}`,
      ),
    );
  }

  if (promo.applies_to === "all") {
    specifications.push(
      translateOrFallback(
        t,
        "shop.promo.fact.appliesEntireOrder",
        undefined,
        "Applies to the entire order",
      ),
    );
  } else if (promo.applies_to === "selected_items") {
    specifications.push(
      translateOrFallback(
        t,
        "shop.promo.fact.appliesSelected",
        undefined,
        "Applies to specific products or categories",
      ),
    );
  }

  return { restrictions, conditions, specifications };
}
