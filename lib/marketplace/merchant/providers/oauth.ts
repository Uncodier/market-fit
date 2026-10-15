import 'server-only';
import { createHash } from 'node:crypto';
import { requestProvider } from '../../providers/http';
import { MarketplaceProviderError } from '../../providers/types';
import { object } from '../../providers/validation';
import { appEndpoints, bearer, verifierValue } from './common';
import type { AppConfig, MerchantAuthorization } from './types';

/** Caller owns durable single-use state, verifier storage, expiration and user/site binding. */
export function buildAuthorizationUrl(app: AppConfig, state: string, verifier: string): string {
  const endpoints = appEndpoints(app);
  verifierValue(verifier);
  if (typeof state !== 'string' || !/^[a-zA-Z0-9_-]{32,256}$/.test(state)) {
    throw new MarketplaceProviderError('invalid_payload', 'Invalid OAuth state.');
  }
  const url = new URL(endpoints.authorize);
  url.searchParams.set('client_id', app.client_id);
  url.searchParams.set('redirect_uri', app.redirect_uri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', app.provider === 'rappi' ? 'openid profile email' : 'eats.pos_provisioning');
  // Uber's official confidential authorization-code flow does not document PKCE.
  if (app.provider === 'rappi') {
    url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return url.toString();
}

function tokenExpiry(payload: Record<string, unknown>, merchantToken: string, rappi: boolean): string | undefined {
  if (rappi) {
    if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(merchantToken)) {
      throw new MarketplaceProviderError('invalid_response', 'Rappi did not return an OIDC merchant token.');
    }
    // This claim is an expiry hint only. Store ownership is always validated by Rappi.
    try {
      const claims = object(JSON.parse(Buffer.from(merchantToken.split('.')[1], 'base64url').toString('utf8')) as unknown);
      if (typeof claims.exp === 'number' && Number.isFinite(claims.exp) && claims.exp > Date.now() / 1000
        && claims.exp < 253402300800) return new Date(claims.exp * 1000).toISOString();
      if (claims.exp !== undefined) throw new Error('Invalid expiry');
    } catch {
      throw new MarketplaceProviderError('invalid_response', 'Rappi returned invalid merchant token claims.');
    }
    return undefined;
  }
  if (payload.expires_in === undefined) return undefined;
  if (typeof payload.expires_in !== 'number' || !Number.isFinite(payload.expires_in)
    || payload.expires_in <= 0 || payload.expires_in > 2592000) {
    throw new MarketplaceProviderError('invalid_response', 'Invalid merchant authorization expiry.');
  }
  return new Date(Date.now() + payload.expires_in * 1000).toISOString();
}

export async function exchangeAuthorization(app: AppConfig, code: string, verifier: string): Promise<MerchantAuthorization> {
  const endpoint = appEndpoints(app);
  bearer(code);
  verifierValue(verifier);
  const form = new URLSearchParams({ grant_type: 'authorization_code', code,
    client_id: app.client_id, redirect_uri: app.redirect_uri });
  if (app.provider === 'rappi') form.set('code_verifier', verifier);
  else form.set('client_secret', app.client_secret);
  const payload = object(await requestProvider(new URL(endpoint.token), { method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() }));
  const merchant_token = bearer(app.provider === 'rappi' ? payload.id_token : payload.access_token);
  if (payload.token_type !== undefined && (typeof payload.token_type !== 'string' || payload.token_type.toLowerCase() !== 'bearer')) {
    throw new MarketplaceProviderError('invalid_response', 'Unsupported merchant token type.');
  }
  const expires_at = tokenExpiry(payload, merchant_token, app.provider === 'rappi');
  return { merchant_token, ...(expires_at ? { expires_at } : {}),
    ...(app.provider === 'uber_eats' && payload.refresh_token !== undefined ? { refresh_token: bearer(payload.refresh_token) } : {}) };
}