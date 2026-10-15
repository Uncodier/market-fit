import 'server-only';
import { providerEndpoints } from '../../providers/endpoints';
import { getProviderToken, requestProvider } from '../../providers/http';
import { MarketplaceProviderError } from '../../providers/types';
import { id } from '../../providers/validation';
import type { AppConfig } from './types';

export const RAPPI_BASE = '/api/v2/restaurants-integrations-public-api';

export function failConfiguration(): never {
  throw new MarketplaceProviderError('invalid_config', 'Merchant onboarding configuration is unavailable or invalid.');
}

/** These destinations are registered deployment settings. They are never fetch targets. */
export function applicationUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
      || url.search || !url.hostname.includes('.') || /[\r\n]/.test(value) || value.length > 2048) failConfiguration();
    return url;
  } catch { return failConfiguration(); }
}

export function appEndpoints(app: AppConfig): { api: string; authorize: string; token: string } {
  // Reuse credential/country validation and the existing M2M token endpoint contract.
  const endpoints = providerEndpoints({ ...app, store_id: 'onboarding' });
  applicationUrl(app.redirect_uri);
  applicationUrl(app.webhook_url);
  if (app.integration_id !== undefined) id(app.integration_id);
  if (app.provider === 'uber_eats') {
    const auth = app.environment === 'sandbox' ? 'https://sandbox-login.uber.com' : 'https://auth.uber.com';
    return { api: endpoints.api, authorize: `${auth}/oauth/v2/authorize`, token: endpoints.token };
  }
  const auth = app.environment === 'sandbox' ? 'https://login.partners.dev.rappi.com' : 'https://login.partners.rappi.com';
  return { api: new URL(endpoints.token).origin, authorize: `${auth}/authorize`, token: `${auth}/oauth/token` };
}

export function bearer(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 65536 || /[\s\x00-\x1f\x7f]/.test(value)) {
    throw new MarketplaceProviderError('invalid_payload', 'Invalid merchant authorization credential.');
  }
  return value;
}

export function verifierValue(value: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._~-]{43,128}$/.test(value)) {
    throw new MarketplaceProviderError('invalid_payload', 'Invalid OAuth verifier.');
  }
  return value;
}

export function rappiIntegration(app: AppConfig): string {
  appEndpoints(app);
  if (app.provider !== 'rappi' || !app.integration_id) failConfiguration();
  return id(app.integration_id);
}

export async function merchantRequest(app: AppConfig, merchantToken: string, path: string,
  init: RequestInit = {}, allowEmpty = false): Promise<unknown> {
  const endpoint = appEndpoints(app);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const token = bearer(merchantToken);
  if (app.provider === 'rappi') {
    headers.set('X-Authorization', `Bearer ${await getProviderToken({ ...app, store_id: 'onboarding' })}`);
    headers.set('Authorization-Partners', `Bearer ${token}`);
  } else headers.set('Authorization', `Bearer ${token}`);
  return requestProvider(new URL(path, endpoint.api), { ...init, headers }, allowEmpty);
}

export async function rappiAppRequest(app: AppConfig, path: string, init: RequestInit = {}): Promise<unknown> {
  rappiIntegration(app);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Authorization', `Bearer ${await getProviderToken({ ...app, store_id: 'onboarding' })}`);
  return requestProvider(new URL(`${RAPPI_BASE}${path}`, appEndpoints(app).api), { ...init, headers });
}

export const jsonBody = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});