export type BogoLine = {
  unitPrice: number;
  quantity: number;
  eligible: boolean;
};

/** Optional translator: `(key, params) => localized string`. */
export type DiscountLabelTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Buy X Get Y free: freeCount = floor(n / (buy+get)) * get.
 * Free units are the cheapest eligible unit prices first.
 */
export function computeBogoDiscount(
  lines: BogoLine[],
  buyQty: number,
  getQty: number
): number {
  const buy = Math.max(1, Math.floor(Number(buyQty) || 1));
  const get = Math.max(1, Math.floor(Number(getQty) || 1));
  const groupSize = buy + get;

  const unitPrices: number[] = [];
  for (const line of lines) {
    if (!line.eligible) continue;
    const qty = Math.max(0, Math.floor(Number(line.quantity) || 0));
    const unit = Number(line.unitPrice);
    if (!Number.isFinite(unit) || unit < 0 || qty <= 0) continue;
    for (let i = 0; i < qty; i++) {
      unitPrices.push(unit);
    }
  }

  const freeCount = Math.floor(unitPrices.length / groupSize) * get;
  if (freeCount <= 0) return 0;

  unitPrices.sort((a, b) => a - b);
  let discount = 0;
  for (let i = 0; i < freeCount; i++) {
    discount += unitPrices[i];
  }
  return discount;
}

function translateOrFallback(
  t: DiscountLabelTranslate | undefined,
  key: string,
  params: Record<string, string | number>,
  fallback: string,
): string {
  if (!t) return fallback;
  const value = t(key, params);
  if (!value || value === key) return fallback;
  return value;
}

/** Human-readable label: "2x1" for buy=1 get=1, else "Buy X Get Y" (localized when t is provided). */
export function formatBogoLabel(
  buyQty?: number | null,
  getQty?: number | null,
  t?: DiscountLabelTranslate,
): string {
  const buy = Math.max(1, Math.floor(Number(buyQty) || 1));
  const get = Math.max(1, Math.floor(Number(getQty) || 1));
  if (buy === 1 && get === 1) return "2x1";
  return translateOrFallback(
    t,
    "promotions.badge.buyGet",
    { buy, get },
    `Buy ${buy} Get ${get}`,
  );
}

export function formatPromotionDiscountLabel(
  promo: {
    discount_type: string;
    discount_value?: number | null;
    bogo_buy_qty?: number | null;
    bogo_get_qty?: number | null;
  },
  t?: DiscountLabelTranslate,
): string {
  if (promo.discount_type === "bogo") {
    return formatBogoLabel(promo.bogo_buy_qty, promo.bogo_get_qty, t);
  }
  const value = promo.discount_value ?? 0;
  if (promo.discount_type === "percent") {
    return translateOrFallback(
      t,
      "promotions.badge.percentOff",
      { value },
      `${value}% OFF`,
    );
  }
  return translateOrFallback(
    t,
    "promotions.badge.fixedOff",
    { value },
    `$${value} OFF`,
  );
}

export function lineUnitPrice(subtotal: number, quantity?: number | null): number {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  return Number(subtotal) / qty;
}
