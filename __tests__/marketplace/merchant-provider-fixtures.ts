import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../../lib/marketplace/merchant/providers/types';

export const synthetic = (): string => randomBytes(32).toString('base64url');
export const verifier = (): string => randomBytes(48).toString('base64url');
export function app(provider: AppConfig['provider'] = 'uber_eats', environment: AppConfig['environment'] = 'sandbox'): AppConfig {
  return { provider, environment, country: 'MX', client_id: synthetic(), client_secret: synthetic(),
    redirect_uri: 'https://merchant.example.test/oauth/callback', webhook_url: 'https://merchant.example.test/webhooks',
    ...(provider === 'rappi' ? { integration_id: synthetic() } : {}) };
}
export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}
export function merchantJwt(exp = Math.floor(Date.now() / 1000) + 3600): string {
  return [Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: synthetic(), exp })).toString('base64url'), synthetic()].join('.');
}
export function rappiStores(config: AppConfig, integrated = false): unknown {
  return { stores: [{ store_id: '10', name: 'Authorized Parent', brand: 'Brand', integrated,
    ...(integrated ? { integration_id: config.integration_id } : {}), children: [
      { store_id: '20', name: 'Authorized Child', brand: 'Brand', integrated: false },
    ] }] };
}
export function webhook(event: string, storeId: string, url: string, secret?: string): unknown {
  return { event, stores: [{ store_id: storeId, url, state: 'ENABLE' }], ...(secret ? { secret } : {}) };
}