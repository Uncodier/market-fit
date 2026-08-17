import { CatalogItem } from '../types';
import { CheckoutFulfillmentMethod } from './delivery-options';

export type PaymentMethodType = 'card' | 'cash_on_pickup' | 'bank_transfer';

/**
 * Returns the allowed payment options for a given catalog item.
 * If the item has metadata.payment_options configured, it uses those.
 * Otherwise, it falls back to the site's default shop payment methods.
 */
export function getItemPaymentOptions(
  item: Partial<CatalogItem>,
  sitePaymentMethods: PaymentMethodType[] = ['card', 'cash_on_pickup']
): PaymentMethodType[] {
  if (item.metadata?.payment_options && Array.isArray(item.metadata.payment_options) && item.metadata.payment_options.length > 0) {
    return item.metadata.payment_options;
  }
  return sitePaymentMethods;
}

/**
 * Computes the intersection of allowed payment options across multiple cart items.
 */
export function intersectPaymentOptions(items: { allowed: PaymentMethodType[] }[]): PaymentMethodType[] {
  if (!items || items.length === 0) return [];
  const ALL: PaymentMethodType[] = ['card', 'cash_on_pickup', 'bank_transfer'];
  
  return items.reduce((acc, item) => {
    return acc.filter((method) => item.allowed.includes(method));
  }, [...ALL]);
}

/**
 * Returns available payment methods based on fulfillment and allowed options.
 * - 'cash_on_pickup' is only available if fulfillment is 'pickup' or 'dine_in'.
 * - Exception: if there are reservable or service items, 'cash_on_pickup' is allowed even for 'ship' or 'none'.
 * - 'card' and 'bank_transfer' are available for any fulfillment.
 */
export function getAvailablePaymentMethods(
  fulfillment: CheckoutFulfillmentMethod,
  allowed: PaymentMethodType[],
  items?: Partial<CatalogItem>[]
): PaymentMethodType[] {
  return allowed.filter(method => {
    if (method === 'cash_on_pickup') {
      const isServiceCart = items?.some(item => item.kind === 'service' || item.is_reservation);
      if (fulfillment !== 'pickup' && fulfillment !== 'dine_in' && !isServiceCart) {
        return false;
      }
    }
    return true;
  });
}
