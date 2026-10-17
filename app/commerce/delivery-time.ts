export function formatDeliveryTime(shop?: {
  delivery_time_min?: number | null;
  delivery_time_max?: number | null;
} | null, t?: (key: string, params?: Record<string, string | number>) => string): string | null {
  if (!shop) return null;

  const min = shop.delivery_time_min;
  const max = shop.delivery_time_max;

  if (min != null && max != null && max > min) {
    return t ? t("commerce.deliveryTime.range", { min, max }) : `${min}–${max} min`;
  }
  
  if (min != null) {
    return t ? t("commerce.deliveryTime.single", { minutes: min }) : `${min} min`;
  }

  // If only max is set for some reason, we could display it, but usually min is the primary.
  if (max != null) {
    return t ? t("commerce.deliveryTime.upTo", { minutes: max }) : `Up to ${max} min`;
  }

  return null;
}
