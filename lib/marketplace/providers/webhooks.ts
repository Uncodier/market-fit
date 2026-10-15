import { normalizeRappiOrder, rappiDelivery } from './rappi-normalize';
import { normalizeUberOrder } from './uber-normalize';
import { MarketplaceProvider, ProviderConfig, ProviderWebhookEvent } from './types';
import { assertStore, eventTime, id, invalid, object, optionalObject, text } from './validation';

const RAPPI_CANCEL_EVENTS = new Set([
  'NEW_ORDER_SCHEDULED_CANCELLED', 'ORDER_EVENT_CANCEL', 'cancel_by_user', 'canceled_with_charge',
  'cancel_without_charges', 'cancel_by_support', 'cancel_by_support_with_charge', 'cancel_by_application_user',
  'canceled_from_cms', 'canceled_by_fraud_automation', 'canceled_store_closed', 'cancel_by_sk_with_charge',
]);
const RAPPI_ORDER_EVENTS = new Set([
  'ORDER_OTHER_EVENT', 'taken_visible_order', 'replace_storekeeper', 'ready_for_pick_up',
  'domiciliary_in_store', 'hand_to_domiciliary', 'arrive', 'close_order',
]);

/** Routing metadata is untrusted until the exact raw request has passed signature verification. */
export function parseWebhook(provider: MarketplaceProvider, value: unknown): ProviderWebhookEvent {
  const payload = object(value);
  if (provider === 'uber_eats') {
    const meta = optionalObject(payload.meta);
    const type = text(payload.event_type);
    if (!type) invalid();
    const kind = ['orders.cancel', 'orders.failure'].includes(type) ? 'cancel'
      : type === 'orders.release' ? 'delivery'
        : ['orders.notification', 'orders.scheduled.notification'].includes(type) ? 'order' : 'ignore';
    const orderId = meta.resource_id ?? payload.resource_id;
    return { external_store_id: id(meta.user_id ?? payload.user_id),
      external_order_id: kind === 'ignore' || orderId === undefined ? undefined : id(orderId),
      event_key: payload.event_id === undefined ? undefined : id(payload.event_id),
      event_type: type, kind, event_at: eventTime(payload.event_time) };
  }
  if (provider !== 'rappi') invalid();
  const detail = optionalObject(payload.order_detail);
  const store = optionalObject(payload.store);
  const storeId = store.internal_id ?? detail.store_id ?? payload.store_id ?? payload.external_store_id;
  const orderId = detail.order_id ?? payload.order_id;
  const type = text(payload.event) ?? text(payload.event_type) ?? (payload.action === 'scheduled' ? 'NEW_ORDER_SCHEDULED'
    : payload.action === 'cancelled' ? 'NEW_ORDER_SCHEDULED_CANCELLED' : payload.order_detail ? 'NEW_ORDER'
      : payload.courier_id !== undefined ? 'ORDER_RT_TRACKING' : 'UNKNOWN');
  const cancelled = RAPPI_CANCEL_EVENTS.has(type);
  const kind = cancelled ? 'cancel' : ['NEW_ORDER', 'NEW_ORDER_SCHEDULED'].includes(type) ? 'order'
    : type === 'ORDER_RT_TRACKING' || RAPPI_ORDER_EVENTS.has(type) ? 'delivery' : 'ignore';
  return { external_store_id: id(storeId), external_order_id: orderId === undefined ? undefined : id(orderId),
    event_key: payload.event_id === undefined ? undefined : id(payload.event_id), event_type: type, kind,
    event_at: eventTime(payload.event_time ?? payload.created_at) };
}

/** Call only after signature verification; metadata store scope is checked again here. */
export function normalizeWebhook(config: ProviderConfig, value: unknown): ProviderWebhookEvent {
  const event = parseWebhook(config.provider, value);
  assertStore(event.external_store_id, config.store_id);
  const payload = object(value);
  if (event.kind !== 'ignore' && !event.external_order_id) invalid();
  if (event.kind === 'order') {
    if (config.provider === 'rappi') {
      event.normalized_order = normalizeRappiOrder(config, payload);
    } else if (payload.order !== undefined) {
      event.normalized_order = normalizeUberOrder(config, payload.order);
      assertStore(event.normalized_order.external_order_id, event.external_order_id!);
    }
    if (event.normalized_order && ['NEW_ORDER_SCHEDULED', 'orders.scheduled.notification'].includes(event.event_type)) {
      event.normalized_order.status = 'scheduled';
      event.normalized_order.totals_provisional = true;
    }
  } else if (event.kind === 'delivery' && config.provider === 'rappi') {
    event.delivery = rappiDelivery(payload);
  }
  return event;
}