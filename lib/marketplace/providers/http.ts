import 'server-only';
import { createHash } from 'node:crypto';
import { assertSafeProviderUrl, providerEndpoints } from './endpoints';
import { MarketplaceProviderError, ProviderConfig } from './types';
import { object, text } from './validation';

export const PROVIDER_TIMEOUT_MS = 10000;
export const PROVIDER_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const tokens = new Map<string, { value: string; expires: number }>();
const inflight = new Map<string, Promise<string>>();

/** Fixed-host requests only. Redirects, unbounded bodies, caches, and provider error bodies are forbidden. */
export async function requestProvider(url: URL, init: RequestInit, allowEmpty = false): Promise<unknown> {
  assertSafeProviderUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', redirect: 'error', signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new MarketplaceProviderError('http_error', 'The marketplace request was not successful.', response.status);
    }
    const size = Number(response.headers.get('content-length'));
    if (size > PROVIDER_MAX_RESPONSE_BYTES) {
      await response.body?.cancel();
      throw new MarketplaceProviderError('invalid_response', 'The marketplace response exceeds the size limit.');
    }
    const chunks: Uint8Array[] = [];
    let length = 0;
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > PROVIDER_MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new MarketplaceProviderError('invalid_response', 'The marketplace response exceeds the size limit.');
        }
        chunks.push(chunk.value);
      }
    }
    const body = Buffer.concat(chunks).toString('utf8');
    if (!body.trim() && allowEmpty) return undefined;
    if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      throw new MarketplaceProviderError('invalid_response', 'Expected a JSON marketplace response.');
    }
    try { return JSON.parse(body) as unknown; } catch {
      throw new MarketplaceProviderError('invalid_response', 'The marketplace returned invalid JSON.');
    }
  } catch (error) {
    if (error instanceof MarketplaceProviderError) throw error;
    throw new MarketplaceProviderError(controller.signal.aborted ? 'timeout' : 'http_error',
      controller.signal.aborted ? 'The marketplace request timed out.' : 'The marketplace request failed.');
  } finally { clearTimeout(timer); }
}

function tokenKey(config: ProviderConfig): string {
  return createHash('sha256').update(JSON.stringify([
    config.provider, config.environment, config.country, config.store_id, config.client_id, config.client_secret,
  ])).digest('hex');
}
async function loadToken(config: ProviderConfig, key: string): Promise<string> {
  const endpoint = providerEndpoints(config);
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: string;
  if (config.provider === 'uber_eats') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams({ client_id: config.client_id, client_secret: config.client_secret,
      grant_type: 'client_credentials', scope: 'eats.order' }).toString();
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ client_id: config.client_id, client_secret: config.client_secret });
  }
  const payload = object(await requestProvider(new URL(endpoint.token), { method: 'POST', headers, body }));
  const token = text(payload.access_token);
  const type = text(payload.token_type);
  // Rappi documents one-week validity, even where expires_in is omitted.
  const expires = payload.expires_in ?? (config.provider === 'rappi' ? 604800 : undefined);
  if (!token || token.length > 32768 || /[\r\n]/.test(token) || (type && type.toLowerCase() !== 'bearer')
    || typeof expires !== 'number' || !Number.isFinite(expires) || expires <= 0) {
    throw new MarketplaceProviderError('invalid_response', 'The marketplace returned an invalid access token.');
  }
  const bounded = Math.min(expires, config.provider === 'rappi' ? 604800 : 2592000);
  const margin = Math.min(60, bounded / 10);
  for (const [cacheKey, entry] of tokens) if (entry.expires <= Date.now()) tokens.delete(cacheKey);
  if (tokens.size >= 256) tokens.delete(tokens.keys().next().value as string);
  tokens.set(key, { value: token, expires: Date.now() + (bounded - margin) * 1000 });
  return token;
}
export async function getProviderToken(config: ProviderConfig): Promise<string> {
  providerEndpoints(config);
  const key = tokenKey(config);
  const cached = tokens.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = loadToken(config, key).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
export async function authorizedRequest(config: ProviderConfig, url: URL, init: RequestInit = {}, allowEmpty = false): Promise<unknown> {
  assertSafeProviderUrl(url);
  const token = await getProviderToken(config);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set(config.provider === 'uber_eats' ? 'Authorization' : 'x-authorization', `Bearer ${token}`);
  return requestProvider(url, { ...init, headers }, allowEmpty);
}