import 'server-only';
import { providerEndpoints, RAPPI_ORDER_PATH } from './endpoints';
import { authorizedRequest } from './http';
import { normalizeRappiOrder } from './rappi-normalize';
import { normalizeUberOrder } from './uber-normalize';
import { normalizeWebhook } from './webhooks';
import { array, id, object, requiredText } from './validation';
import { MarketplaceAction, MarketplaceProviderError, NormalizedOrder, ProviderActionResult, ProviderConfig, ProviderWebhookEvent } from './types';
export * from './types';
export { parseWebhook, normalizeWebhook } from './webhooks';

export function normalizeOrder(config: ProviderConfig, payload: unknown): NormalizedOrder {
  providerEndpoints(config);
  return config.provider === 'uber_eats' ? normalizeUberOrder(config, payload) : normalizeRappiOrder(config, payload);
}
/** Caller must authorize the imported order/store: the Rappi event response has no store identity. */
export async function fetchOrderEvents(config: ProviderConfig, externalOrderId: string): Promise<ProviderWebhookEvent[]> {
  const endpoint = providerEndpoints(config);
  const orderId = id(externalOrderId);
  if (config.provider !== 'rappi') throw new MarketplaceProviderError('unsupported_operation', 'Order event history is only supported for Rappi.');
  const rows = array(await authorizedRequest(config, new URL(`${RAPPI_ORDER_PATH}/${orderId}/events`, endpoint.api)));
  return rows.map(value => {
    const payload = object(value);
    requiredText(payload.event);
    requiredText(payload.event_time);
    if (payload.order_id !== undefined && id(payload.order_id) !== orderId) {
      throw new MarketplaceProviderError('invalid_response', 'The marketplace returned events for a different order.');
    }
    return normalizeWebhook(config, { ...payload, store_id: payload.store_id ?? config.store_id, order_id: orderId });
  });
}
/** Caller rate-limits recovery (at least 45 seconds) and persists every row: new consumes READY into SENT. */
export async function fetchNewOrders(config: ProviderConfig, status: 'new' | 'sent' = 'new'): Promise<NormalizedOrder[]> {
  const endpoint = providerEndpoints(config);
  if (config.provider !== 'rappi') throw new MarketplaceProviderError('unsupported_operation', 'New-order recovery listing is only supported for Rappi.');
  if (status !== 'new' && status !== 'sent') throw new MarketplaceProviderError('invalid_payload', 'Invalid recovery order list.');
  const url = new URL(status === 'sent' ? `${RAPPI_ORDER_PATH}/status/sent` : RAPPI_ORDER_PATH, endpoint.api);
  url.searchParams.set('storeId', config.store_id);
  return array(await authorizedRequest(config, url)).map(value => normalizeRappiOrder(config, value));
}
export async function fetchOrder(config: ProviderConfig, externalOrderId: string): Promise<NormalizedOrder> {
  const endpoint = providerEndpoints(config);
  const orderId = id(externalOrderId);
  if (config.provider === 'uber_eats') {
    const payload = await authorizedRequest(config, new URL(`/v2/eats/order/${orderId}`, endpoint.api));
    const result = normalizeUberOrder(config, payload);
    if (result.external_order_id !== orderId) throw new MarketplaceProviderError('invalid_response', 'The marketplace returned a different order.');
    return result;
  }
  // Never consume READY orders for a single-order refresh: only recovery may fetch the new-order list.
  const orders = await fetchNewOrders(config, 'sent');
  const result = orders.find(order => order.external_order_id === orderId);
  if (result) return result;
  throw new MarketplaceProviderError('not_found', 'The order is not available from the documented Rappi SENT order endpoint.');
}
function validateAction(input: MarketplaceAction): void {
  if (!input || !['accept', 'reject', 'ready', 'cancel'].includes(input.action)) {
    throw new MarketplaceProviderError('invalid_payload', 'Invalid marketplace action.');
  }
  if (input.cooking_time_minutes !== undefined && (!Number.isInteger(input.cooking_time_minutes)
    || input.cooking_time_minutes < 1 || input.cooking_time_minutes > 120)) {
    throw new MarketplaceProviderError('invalid_payload', 'Cooking time must be between 1 and 120 minutes.');
  }
  if (input.reason !== undefined && (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500)) {
    throw new MarketplaceProviderError('invalid_payload', 'Invalid marketplace action reason.');
  }
  if (['reject', 'cancel'].includes(input.action) && !input.reason?.trim()) {
    throw new MarketplaceProviderError('invalid_payload', 'A reason is required for this marketplace action.');
  }
}
function unsupported(): never {
  throw new MarketplaceProviderError('unsupported_operation', 'This operation is not supported by the documented marketplace contract or store configuration.');
}
/** Caller must authorize Rappi order/store ownership and action state against its imported order. */
export async function actOnOrder(config: ProviderConfig, externalOrderId: string, input: MarketplaceAction): Promise<ProviderActionResult> {
  const endpoint = providerEndpoints(config);
  const orderId = id(externalOrderId);
  validateAction(input);
  let path: string;
  let method = 'POST';
  let body: Record<string, unknown> | undefined;
  if (config.provider === 'uber_eats') {
    if (input.action === 'ready') unsupported();
    const suffix = { accept: 'accept_pos_order', reject: 'deny_pos_order', cancel: 'cancel' }[input.action];
    path = `/v1/eats/orders/${orderId}/${suffix}`;
    body = input.action === 'accept' ? { reason: input.reason ?? 'Accepted by merchant',
      ...(input.cooking_time_minutes === undefined ? {} : { pickup_time: Math.floor(Date.now() / 1000) + input.cooking_time_minutes * 60 }) }
      : input.action === 'reject' ? { reason: { code: 'OTHER', explanation: input.reason } }
        : { reason: 'OTHER', details: input.reason };
    // Verify this order belongs to the connection before any action is sent.
    await fetchOrder(config, orderId);
  } else {
    if (input.action === 'cancel' || (input.action === 'ready' && config.manual_ready !== true)) unsupported();
    if (input.action === 'accept') {
      if (input.cooking_time_minutes === undefined) throw new MarketplaceProviderError('invalid_payload', 'Rappi acceptance requires a cooking time.');
      path = `${RAPPI_ORDER_PATH}/${orderId}/take/${input.cooking_time_minutes}`;
      method = 'PUT';
    } else if (input.action === 'reject') {
      path = `${RAPPI_ORDER_PATH}/${orderId}/reject`;
      method = 'PUT';
      body = { reason: input.reason };
    } else path = `${RAPPI_ORDER_PATH}/${orderId}/ready-for-pickup`;
    // No list preflight: new-order reads consume unrelated READY orders, and WEBHOOK orders may be taken directly.
  }
  const result = await authorizedRequest(config, new URL(path, endpoint.api), {
    method, ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }, true);
  if (result !== undefined) {
    const acknowledgement = object(result);
    if (Object.keys(acknowledgement).length && typeof acknowledgement.message !== 'string') {
      throw new MarketplaceProviderError('invalid_response', 'The marketplace returned an invalid action acknowledgement.');
    }
    if (acknowledgement.message !== undefined) requiredText(acknowledgement.message);
  }
  return { external_order_id: orderId, action: input.action, acknowledged: true };
}