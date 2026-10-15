import 'server-only';
import { createHash } from 'node:crypto';
import { requestProvider } from '../../providers/http';
import { MarketplaceProviderError } from '../../providers/types';
import { id, object, text } from '../../providers/validation';
import { appEndpoints, bearer, failConfiguration } from './common';
import type { AppConfig, UberStoreIntegrationStatus } from './types';

// Separate scope from the operational eats.order token cache. Never use merchant tokens here.
const tokens = new Map<string, { token: string; expires: number }>();
const inflight = new Map<string, Promise<string>>();

async function loadStoreToken(app: AppConfig, key: string): Promise<string> {
  const form = new URLSearchParams({ client_id: app.client_id, client_secret: app.client_secret,
    grant_type: 'client_credentials', scope: 'eats.store' });
  const response = object(await requestProvider(new URL(appEndpoints(app).token), { method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() }));
  const token = bearer(response.access_token);
  if ((response.token_type !== undefined && (typeof response.token_type !== 'string' || response.token_type.toLowerCase() !== 'bearer'))
    || typeof response.expires_in !== 'number' || !Number.isFinite(response.expires_in) || response.expires_in <= 0
    || response.expires_in > 2592000) {
    throw new MarketplaceProviderError('invalid_response', 'Invalid Uber store authorization response.');
  }
  const expires = Date.now() + (response.expires_in - Math.min(60, response.expires_in / 10)) * 1000;
  for (const [cacheKey, entry] of tokens) if (entry.expires <= Date.now()) tokens.delete(cacheKey);
  if (tokens.size >= 256) tokens.delete(tokens.keys().next().value as string);
  tokens.set(key, { token, expires });
  return token;
}

async function storeToken(app: AppConfig): Promise<string> {
  const key = createHash('sha256').update(JSON.stringify([app.environment, app.client_id, app.client_secret, 'eats.store'])).digest('hex');
  const cached = tokens.get(key);
  if (cached && cached.expires > Date.now()) return cached.token;
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = loadStoreToken(app, key).finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

/** Caller MUST authorize its native store/app association before this application-scoped read. */
export async function getUberStoreIntegrationStatus(app: AppConfig,
  store: { id: string }): Promise<UberStoreIntegrationStatus> {
  const endpoints = appEndpoints(app);
  if (app.provider !== 'uber_eats') failConfiguration();
  const storeId = id(store.id);
  const token = await storeToken(app);
  let payload: Record<string, unknown>;
  try {
    payload = object(await requestProvider(new URL(`/v1/eats/stores/${encodeURIComponent(storeId)}/pos_data`, endpoints.api), {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }));
  } catch (error) {
    // GET requires an app integration; a deleted integration no longer has POS data.
    // Authorization failures, timeouts and other errors must not fabricate revocation.
    if (error instanceof MarketplaceProviderError && error.code === 'http_error' && error.http_status === 404) {
      return { id: storeId, integrated: false, integration_status: 'inactive' };
    }
    throw error;
  }
  if (id(payload.store_id) !== storeId || typeof payload.integration_enabled !== 'boolean'
    || (payload.is_order_manager_pending !== undefined && typeof payload.is_order_manager_pending !== 'boolean')
    || (payload.order_manager_client_id !== undefined && payload.order_manager_client_id !== null
      && typeof payload.order_manager_client_id !== 'string')) {
    throw new MarketplaceProviderError('invalid_response', 'Invalid Uber store integration details.');
  }
  const integrated = payload.integration_enabled;
  const manager = text(payload.order_manager_client_id);
  // Pending is optional; a matching nominated manager with no pending flag is documented.
  const active = integrated && manager === app.client_id && payload.is_order_manager_pending !== true;
  return { id: storeId, integrated, integration_status: !integrated ? 'inactive' : active ? 'active' : 'pending' };
}