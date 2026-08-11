import { CatalogItem } from '../types';

export type FulfillmentMethod = 'pickup' | 'ship' | 'none' | 'dine_in';
export type CheckoutFulfillmentMethod = 'pickup' | 'ship' | 'none' | 'dine_in';

/**
 * Returns the allowed delivery options for a given catalog item.
 * If the item has metadata.delivery_options configured, it uses those.
 * Otherwise, it falls back to defaults based on the site settings or item's kind.
 */
export function getItemDeliveryOptions(
  item: Partial<CatalogItem>,
  siteDefaultDelivery?: CheckoutFulfillmentMethod[]
): CheckoutFulfillmentMethod[] {
  if (item.metadata?.delivery_options && item.metadata.delivery_options.length > 0) {
    return item.metadata.delivery_options;
  }

  // Fallback to site settings if provided
  if (siteDefaultDelivery && siteDefaultDelivery.length > 0) {
    // Only apply site defaults to physical products; others must be 'none' unless explicitly overridden
    if (item.kind === 'product') {
      return siteDefaultDelivery;
    }
  }

  // Backward compatibility defaults
  if (item.kind === 'product') {
    return ['pickup', 'ship', 'dine_in'];
  }

  // service, digital_asset, etc.
  return ['none'];
}

/**
 * Whether the item offers physical delivery methods (pickup and/or ship).
 */
export function itemHasDelivery(item: Partial<CatalogItem>): boolean {
  const options = getItemDeliveryOptions(item);
  return options.includes('pickup') || options.includes('ship') || options.includes('dine_in');
}

/**
 * Returns configured pickup location IDs for an item.
 * Empty array means "all active locations" (no restriction).
 */
export function getItemPickupLocationIds(item: Partial<CatalogItem>): string[] {
  const ids = item.metadata?.pickup_location_ids;
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
}

/**
 * Intersects pickup location IDs across cart items that allow pickup.
 * - If an item has no restriction (empty list), it does not narrow the set.
 * - If every restricted item yields an empty intersection, returns [].
 * - If no item has restrictions, returns null (meaning all site locations OK).
 */
export function intersectPickupLocationIds(
  items: Partial<CatalogItem>[]
): string[] | null {
  const pickupItems = items.filter((item) => getItemDeliveryOptions(item).includes('pickup'));
  if (pickupItems.length === 0) return null;

  let restricted: string[] | null = null;

  for (const item of pickupItems) {
    const ids = getItemPickupLocationIds(item);
    if (ids.length === 0) continue; // unrestricted
    if (restricted === null) {
      restricted = [...ids];
    } else {
      restricted = restricted.filter((id) => ids.includes(id));
    }
  }

  return restricted; // null = all OK; [] = incompatible; string[] = allowed set
}

/**
 * Computes the intersection of allowed delivery options across multiple cart items.
 */
export function intersectDeliveryOptions(items: { allowed: CheckoutFulfillmentMethod[] }[]): CheckoutFulfillmentMethod[] {
  if (!items || items.length === 0) return [];

  const ALL: CheckoutFulfillmentMethod[] = ['pickup', 'ship', 'none', 'dine_in'];

  return items.reduce((acc, item) => {
    return acc.filter((method) => item.allowed.includes(method));
  }, [...ALL]);
}

/**
 * Chooses the best default fulfillment method from a list of allowed options.
 * Preference order: ship -> pickup -> none
 */
export function defaultFulfillment(options: CheckoutFulfillmentMethod[]): CheckoutFulfillmentMethod | undefined {
  if (options.includes('ship')) return 'ship';
  if (options.includes('pickup')) return 'pickup';
  if (options.includes('dine_in')) return 'dine_in';
  if (options.includes('none')) return 'none';
  return undefined;
}

/**
 * Validates if a chosen fulfillment method is allowed for the given cart items.
 */
export function isFulfillmentAllowed(method: CheckoutFulfillmentMethod, items: { allowed: CheckoutFulfillmentMethod[] }[]): boolean {
  const allowed = intersectDeliveryOptions(items);
  return allowed.includes(method);
}

/**
 * Resolves the final shipping cost for an order.
 * Only applies if fulfillment method is 'ship'.
 *
 * Logic:
 * 1. If cart subtotal >= free shipping threshold -> 0
 * 2. If any item covers the entire order -> max of covers_order amounts + sum of extra amounts (ignores global site shipping cost)
 * 3. Else -> global site shipping cost + sum of extra amounts
 */
export function resolveOrderShippingCost(
  fulfillmentMethod: CheckoutFulfillmentMethod,
  subtotal: number,
  freeShippingThreshold: number | null | undefined,
  siteShippingCost: number | null | undefined,
  items: Partial<CatalogItem>[]
): number {
  if (fulfillmentMethod !== 'ship') {
    return 0;
  }

  if (freeShippingThreshold != null && subtotal >= freeShippingThreshold) {
    return 0;
  }

  let globalBase = siteShippingCost || 0;
  let hasCoversOrder = false;
  let maxCoversOrderAmount = 0;
  let sumExtraAmount = 0;

  for (const item of items) {
    // undefined = inherit / no product contribution; null = explicit $0 contribution
    if (item.metadata?.shipping_cost === undefined) continue;

    const amount = item.metadata.shipping_cost ?? 0;
    const mode = item.metadata?.shipping_cost_mode || 'extra';

    if (mode === 'covers_order') {
      hasCoversOrder = true;
      maxCoversOrderAmount = Math.max(maxCoversOrderAmount, amount);
    } else {
      sumExtraAmount += amount;
    }
  }

  if (hasCoversOrder) {
    return maxCoversOrderAmount + sumExtraAmount;
  }

  return globalBase + sumExtraAmount;
}
