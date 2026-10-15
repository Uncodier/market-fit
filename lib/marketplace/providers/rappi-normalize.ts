import { providerEndpoints } from './endpoints';
import { lineIdentity } from './line-identity';
import { MarketplaceDelivery, MarketplaceOrderStatus, NormalizedOrder, NormalizedOrderItem, ProviderConfig } from './types';
import { array, assertStore, coordinate, eventTime, id, invalid, nonnegative, object, optionalObject, quantity, requiredText, text } from './validation';

const STATUS: Record<string, MarketplaceOrderStatus> = {
  CREATED: 'pending', WEBHOOK: 'pending', READY: 'pending', SENT: 'pending',
  TAKEN: 'accepted', READY_FOR_PICKUP: 'ready', REJECTED: 'rejected', TIMEOUT: 'cancelled',
  CANCELLED: 'cancelled', CANCELED: 'cancelled', COMPLETED: 'completed', DELIVERED: 'completed',
};
function normalizeItem(value: unknown, path: string, depth = 0): NormalizedOrderItem {
  if (depth > 8) invalid();
  const item = object(value);
  const amount = nonnegative(item.price);
  const count = quantity(item.quantity);
  const modifiers = array(item.subitems, true).map((child, index) => normalizeItem(child, `${path}.${index}`, depth + 1));
  // Rappi prices exclude toppings; subitem quantities are per parent unit.
  const total = item.total === undefined
    ? (amount + modifiers.reduce((sum, child) => sum + child.total, 0)) * count
    : nonnegative(item.total);
  const productId = id(item.id ?? item.sku);
  const comments = typeof item.comments === 'string' ? text(item.comments)
    : Array.isArray(item.comments) && item.comments.every(value => typeof value === 'string') ? text(item.comments.join('\n')) : undefined;
  return { external_id: lineIdentity(productId, path), external_product_id: productId, sku: text(item.sku), name: requiredText(item.name),
    notes: comments?.slice(0, 4000),
    quantity: count, unit_price: amount, total, modifiers, modifiers_included_in_price: true };
}
export function rappiDelivery(value: unknown): MarketplaceDelivery | undefined {
  const payload = object(value);
  const additional = optionalObject(payload.additional_information);
  const courier = optionalObject(additional.courier_data);
  const courierId = courier.id ?? payload.courier_id;
  const latitude = coordinate(payload.lat, 90);
  const longitude = coordinate(payload.lng, 180);
  const name = text(courier.full_name) ?? text(additional.storekeeper_name);
  const phone = text(courier.phone);
  const hasCourier = courierId !== undefined || latitude !== undefined || longitude !== undefined || name || phone;
  const etaMs = payload.eta_in_millis;
  const etaSeconds = additional.eta_to_store;
  const eta = typeof etaMs === 'number' ? nonnegative(etaMs) / 60000
    : typeof etaSeconds === 'number' ? nonnegative(etaSeconds) / 60 : undefined;
  const providerEvent = text(payload.event);
  if (!hasCourier && eta === undefined && !providerEvent) return undefined;
  return { courier: hasCourier ? { id: courierId === undefined ? undefined : id(courierId), name, phone, latitude, longitude } : undefined,
    provider_event: providerEvent, eta_minutes: eta };
}
export function normalizeRappiOrder(config: ProviderConfig, value: unknown): NormalizedOrder {
  const endpoint = providerEndpoints(config);
  const payload = object(value);
  const detail = object(payload.order_detail);
  const store = optionalObject(payload.store);
  const storeId = id(store.internal_id ?? detail.store_id);
  assertStore(storeId, config.store_id);
  const provisional = payload.action === 'scheduled';
  const rawStatus = text(detail.status) ?? text(payload.status);
  const status = provisional ? 'scheduled' : payload.action === 'cancelled' ? 'cancelled'
    : rawStatus ? STATUS[rawStatus.toUpperCase()] : 'pending';
  if (!status) invalid();
  const totals = object(detail.totals);
  // The official early scheduled example omits these fields entirely: zeros remain explicitly provisional.
  const subtotal = totals.total_products === undefined && provisional ? 0 : nonnegative(totals.total_products);
  const discount = totals.total_discounts === undefined && provisional ? 0 : nonnegative(totals.total_discounts);
  const customer = optionalObject(payload.customer);
  const method = requiredText(detail.delivery_method).toLowerCase();
  if (!['delivery', 'marketplace', 'pickup'].includes(method)) invalid();
  const orderId = id(detail.order_id);
  const currency = text(detail.currency) ?? endpoint.currency;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) invalid();
  const deliveryInfo = optionalObject(detail.delivery_information);
  return {
    external_order_id: orderId, external_store_id: storeId, display_id: text(detail.display_id) ?? orderId,
    status, currency, total: nonnegative(totals.total_order), subtotal,
    discount_total: discount, totals_provisional: provisional,
    marketplace_totals: Object.fromEntries([
      ...Object.entries(totals).filter(([, value]) => typeof value === 'number').map(([key, value]) => [key, nonnegative(value)]),
      ...Object.entries(optionalObject(totals.charges)).map(([key, value]) => [`charges.${key}`, nonnegative(value)]),
      ...Object.entries(optionalObject(totals.other_totals)).map(([key, value]) => [`other_totals.${key}`, nonnegative(value)]),
    ]),
    items: array(detail.items).map((item, index) => normalizeItem(item, String(index))),
    customer: { name: [text(customer.first_name), text(customer.last_name)].filter(Boolean).join(' ') || undefined,
      phone: text(customer.phone_number), email: text(customer.email) },
    fulfillment_method: method === 'pickup' ? 'pickup' : 'delivery',
    delivery_mode: method === 'marketplace' ? 'merchant_managed' : 'marketplace_managed',
    delivery: method !== 'pickup' && text(deliveryInfo.complete_address) ? { address: text(deliveryInfo.complete_address) } : undefined,
    scheduled_at: eventTime(detail.place_at), accept_by: eventTime(detail.accept_by),
    event_at: eventTime(payload.event_time ?? detail.created_at),
  };
}