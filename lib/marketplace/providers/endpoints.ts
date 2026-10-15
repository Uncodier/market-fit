import { ProviderConfig, MarketplaceProviderError } from './types';
import { id } from './validation';

const RAPPI_COUNTRIES: Record<string, { api: string; auth: string; currency: string }> = {
  MX: { api: 'services.mxgrability.rappi.com', auth: 'api.rappi.com.mx', currency: 'MXN' },
  CO: { api: 'services.rappi.com', auth: 'api.rappi.com.co', currency: 'COP' },
  BR: { api: 'services.rappi.com.br', auth: 'api.rappi.com.br', currency: 'BRL' },
  AR: { api: 'services.rappi.com.ar', auth: 'api.rappi.com.ar', currency: 'ARS' },
  CL: { api: 'services.rappi.cl', auth: 'api.rappi.cl', currency: 'CLP' },
  PE: { api: 'services.rappi.pe', auth: 'api.rappi.pe', currency: 'PEN' },
  EC: { api: 'services.rappi.com.ec', auth: 'api.rappi.com.ec', currency: 'USD' },
  CR: { api: 'services.rappi.co.cr', auth: 'api.rappi.co.cr', currency: 'CRC' },
  UY: { api: 'services.rappi.com.uy', auth: 'api.rappi.com.uy', currency: 'UYU' },
};
export const RAPPI_ORDER_PATH = '/api/v2/restaurants-integrations-public-api/orders';
export function providerEndpoints(config: ProviderConfig): { api: string; token: string; currency?: string } {
  if (!config || !['uber_eats', 'rappi'].includes(config.provider) || !['sandbox', 'production'].includes(config.environment)
    || typeof config.country !== 'string' || !/^[A-Z]{2}$/.test(config.country)
    || typeof config.client_id !== 'string' || !config.client_id.trim() || config.client_id.length > 4096
    || typeof config.client_secret !== 'string' || !config.client_secret.trim() || config.client_secret.length > 4096) {
    throw new MarketplaceProviderError('invalid_config', 'Invalid marketplace connection configuration.');
  }
  id(config.store_id);
  if (config.provider === 'uber_eats') return {
    api: config.environment === 'sandbox' ? 'https://test-api.uber.com' : 'https://api.uber.com',
    token: config.environment === 'sandbox' ? 'https://sandbox-login.uber.com/oauth/v2/token' : 'https://auth.uber.com/oauth/v2/token',
  };
  const country = RAPPI_COUNTRIES[config.country];
  if (!country) throw new MarketplaceProviderError('invalid_config', 'Unsupported Rappi country.');
  return {
    api: `https://${config.environment === 'sandbox' ? 'microservices.dev.rappi.com' : country.api}`,
    token: `https://${config.environment === 'sandbox' ? 'api.dev.rappi.com' : country.auth}/restaurants/auth/v1/token/login/integrations`,
    currency: country.currency,
  };
}
const HOSTS = new Set([
  'api.uber.com', 'test-api.uber.com', 'auth.uber.com', 'sandbox-login.uber.com',
  'microservices.dev.rappi.com', 'api.dev.rappi.com',
  'login.partners.rappi.com', 'login.partners.dev.rappi.com',
  ...Object.values(RAPPI_COUNTRIES).flatMap(country => [country.api, country.auth]),
]);
export function assertSafeProviderUrl(url: URL): void {
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.username || url.password || url.port || url.hash) {
    throw new MarketplaceProviderError('invalid_config', 'Unsafe marketplace request target.');
  }
}