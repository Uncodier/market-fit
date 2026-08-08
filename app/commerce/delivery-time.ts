export function formatDeliveryTime(shop?: {
  delivery_time_min?: number | null;
  delivery_time_max?: number | null;
} | null): string | null {
  if (!shop) return null;

  const min = shop.delivery_time_min;
  const max = shop.delivery_time_max;

  if (min != null && max != null && max > min) {
    return `${min}–${max} min`;
  }
  
  if (min != null) {
    return `${min} min`;
  }

  // If only max is set for some reason, we could display it, but usually min is the primary.
  if (max != null) {
    return `Up to ${max} min`;
  }

  return null;
}
