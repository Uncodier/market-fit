import { MarketplaceDelivery, MarketplaceOrderStatus, NormalizedOrder, NormalizedOrderItem, ProviderConfig } from './types';
import { lineIdentity } from './line-identity';
import { array, assertStore, eventTime, id, invalid, nonnegative, number, object, optionalObject, quantity, requiredText, text } from './validation';

const STATUS: Record<string, MarketplaceOrderStatus> = {
  CREATED: 'pending', ACCEPTED: 'accepted', FINISHED: 'completed', CANCELED: 'cancelled',
  // DENIED is the POS denial state, not proof of cancellation; in-store tablet fallback may still accept it.
  DENIED: 'rejected', SCHEDULED: 'scheduled',
};
function exponent(currency: string): number {
  const result = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  return result ?? 2;
}
function money(value: unknown, currency: string): number {
  const amount = object(value);
  if (amount.currency_code !== currency || !Number.isSafeInteger(amount.amount)) invalid();
  return nonnegative(amount.amount) / 10 ** exponent(currency);
}
function normalizeItem(value: unknown, currency: string, path: string, depth = 0): NormalizedOrderItem {
  if (depth > 8) invalid();
  const item = object(value);
  const price = object(item.price);
  const removals: string[] = [];
  const modifiers = array(item.selected_modifier_groups, true).flatMap((value, groupIndex) => {
    const group = object(value);
    // Removed defaults have quantity zero: preserve preparation intent, never create a payable/native zero-quantity line.
    for (const value of array(group.removed_items, true)) {
      const removed = object(value);
      removals.push(`Remove: ${requiredText(removed.title)}`);
    }
    return array(group.selected_items, true).map((value, itemIndex) => ({ ...normalizeItem(value, currency, `${path}.${groupIndex}.${itemIndex}`, depth + 1),
      modifier_group_id: id(group.id), modifier_group_name: text(group.title) }));
  });
  const notes = [text(item.special_instructions), ...removals].filter(Boolean).join('\n');
  // Do not silently truncate a removal or customer instruction.
  if (notes.length > 4000) invalid();
  const productId = id(item.id);
  return { external_id: lineIdentity(productId, path, text(item.instance_id)), external_product_id: productId,
    sku: text(item.sku), name: requiredText(item.title),
    notes: text(notes),
    quantity: quantity(item.quantity), unit_price: money(price.unit_price, currency), total: money(price.total_price, currency),
    modifiers, modifiers_included_in_price: true };
}
function delivery(value: unknown): MarketplaceDelivery | undefined {
  const deliveries = array(value, true);
  if (!deliveries.length) return undefined;
  const current = object(deliveries[0]);
  const vehicle = optionalObject(current.vehicle);
  return { status: text(current.current_state), estimated_arrival_at: eventTime(current.estimated_pickup_time),
    courier: { id: current.id === undefined ? undefined : id(current.id),
      name: [text(current.first_name), text(current.last_name)].filter(Boolean).join(' ') || undefined,
      phone: text(current.phone), vehicle: [text(vehicle.make), text(vehicle.model)].filter(Boolean).join(' ') || undefined } };
}
export function normalizeUberOrder(config: ProviderConfig, value: unknown): NormalizedOrder {
  const payload = object(value);
  const storeId = id(object(payload.store).id);
  assertStore(storeId, config.store_id);
  const status = STATUS[requiredText(payload.current_state)];
  if (!status) invalid();
  const payment = object(payload.payment);
  const charges = object(payment.charges);
  const currency = requiredText(object(charges.total).currency_code);
  if (!/^[A-Z]{3}$/.test(currency)) invalid();
  const eater = optionalObject(payload.eater);
  const cart = object(payload.cart);
  const type = requiredText(payload.type);
  if (!['PICK_UP', 'DELIVERY_BY_UBER', 'DELIVERY_BY_RESTAURANT'].includes(type)) invalid();
  const promotions = array(optionalObject(payment.promotions).promotions, true);
  const discount = promotions.reduce<number>((sum, value) => {
    const promo = object(value);
    const amount = promo.promo_discount_value;
    if (!Number.isSafeInteger(amount)) invalid();
    return sum + Math.abs(number(amount)) / 10 ** exponent(currency);
  }, 0);
  return { external_order_id: id(payload.id), external_store_id: storeId, display_id: requiredText(payload.display_id), status,
    notes: text(cart.special_instructions)?.slice(0, 4000),
    currency, total: money(charges.total_promo_applied ?? charges.total, currency), subtotal: money(charges.sub_total, currency), discount_total: discount,
    marketplace_totals: Object.fromEntries(Object.entries(charges).filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, money(value, currency)])),
    totals_provisional: status === 'scheduled', items: array(cart.items).map((value, index) => normalizeItem(value, currency, String(index))),
    customer: { name: [text(eater.first_name), text(eater.last_name)].filter(Boolean).join(' ') || undefined,
      phone: text(eater.phone), email: text(eater.email) },
    fulfillment_method: type === 'PICK_UP' ? 'pickup' : 'delivery',
    delivery_mode: type === 'DELIVERY_BY_RESTAURANT' ? 'merchant_managed' : 'marketplace_managed',
    delivery: type === 'PICK_UP' ? undefined : delivery(payload.deliveries),
    scheduled_at: eventTime(payload.scheduled_at), accept_by: eventTime(payload.accept_by), event_at: eventTime(payload.placed_at) };
}