export type PromotionRedemptionRow = {
  id: string;
  order_number: string;
  created_at: string;
  discount_total: number | string | null;
  total: number | string | null;
  currency?: string | null;
  status: string;
  promotion_id: string;
  promotions?:
    | { name?: string | null; code?: string | null }
    | { name?: string | null; code?: string | null }[]
    | null;
  sales?:
    | {
        source?: string | null;
        leads?: { name?: string | null } | { name?: string | null }[] | null;
      }
    | {
        source?: string | null;
        leads?: { name?: string | null } | { name?: string | null }[] | null;
      }[]
    | null;
};

export type PromotionRedemption = {
  id: string;
  orderNumber: string;
  createdAt: string;
  discountTotal: number;
  total: number;
  currency: string;
  status: string;
  promotionId: string;
  promotionName: string | null;
  promotionCode: string | null;
  customerName: string | null;
  source: string | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function mapPromotionRedemption(
  row: PromotionRedemptionRow,
): PromotionRedemption {
  const promo = first(row.promotions);
  const sale = first(row.sales);
  const lead = first(sale?.leads);

  return {
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    discountTotal: Number(row.discount_total) || 0,
    total: Number(row.total) || 0,
    currency: row.currency || "USD",
    status: row.status,
    promotionId: row.promotion_id,
    promotionName: promo?.name ?? null,
    promotionCode: promo?.code ?? null,
    customerName: lead?.name ?? null,
    source: sale?.source ?? null,
  };
}

/** Prefer the live order list when the denormalized counter is behind. */
export function displayPromotionUsageCount(
  usageCount: number | null | undefined,
  listedRedemptions: number,
): number {
  return Math.max(Number(usageCount) || 0, listedRedemptions);
}
