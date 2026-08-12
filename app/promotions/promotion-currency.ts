/** Resolve storefront/admin display currency for a promotion. */
export function resolvePromotionCurrency(
  promo?: { currency?: string | null } | null,
  siteCurrency?: string | null,
): string {
  const fromPromo = promo?.currency?.trim();
  if (fromPromo) return fromPromo.toUpperCase();
  const fromSite = siteCurrency?.trim();
  if (fromSite) return fromSite.toUpperCase();
  return "USD";
}
