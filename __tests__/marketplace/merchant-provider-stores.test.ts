/** @jest-environment node */
import { activateMerchantStore, deactivateMerchantStore, getMerchantStoreStatus, listMerchantStores } from '../../lib/marketplace/merchant/providers';
import { app, json, rappiStores, synthetic } from './merchant-provider-fixtures';

describe('offline token-authorized merchant stores', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;
  const originalFetch = global.fetch;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock; });
  afterEach(() => { global.fetch = originalFetch; });

  test('Rappi production discovery uses api country origin, independent headers and flattens children', async () => {
    const config = app('rappi', 'production');
    const merchantToken = synthetic();
    const integrator = synthetic();
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/token/login/')) return json({ access_token: integrator });
      expect(String(url)).toBe('https://api.rappi.com.mx/api/v2/restaurants-integrations-public-api/stores/integration-status');
      expect(new Headers(init?.headers).get('X-Authorization')).toBe(`Bearer ${integrator}`);
      expect(new Headers(init?.headers).get('Authorization-Partners')).toBe(`Bearer ${merchantToken}`);
      expect(init?.method).toBeUndefined();
      expect(init?.body).toBeUndefined();
      return json(rappiStores(config, true));
    });
    expect(await listMerchantStores(config, merchantToken)).toEqual([
      { id: '10', name: 'Authorized Parent', integrated: true, integration_status: 'active', integration_id: config.integration_id },
      { id: '20', name: 'Authorized Child', integrated: false, integration_status: 'inactive', parent_id: '10' },
    ]);
  });

  test('Uber pagination remains fixed-origin and uses merchant token only, preserves location data', async () => {
    const config = app();
    const token = synthetic();
    let page = 0;
    fetchMock.mockImplementation(async (url, init) => {
      const target = new URL(String(url));
      expect(target.origin).toBe('https://test-api.uber.com');
      expect(target.pathname).toBe('/v1/eats/stores');
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${token}`);
      expect(new Headers(init?.headers).get('Accept-Encoding')).toBe('gzip');
      if (page++ === 0) return json({ next_key: 'https://untrusted.example.test/page', stores: [
        { store_id: 'first', name: 'First', location: { address: 'Reserved road', city: 'Test', country: 'MX' },
          pos_data: { integration_enabled: true, order_manager_client_id: config.client_id, is_order_manager_pending: true } },
      ] });
      expect(target.searchParams.get('start_key')).toBe('https://untrusted.example.test/page');
      return json({ next_key: null, stores: [{ store_id: 'second', name: 'Second',
        pos_data: { integration_enabled: true, order_manager_client_id: config.client_id, is_order_manager_pending: false } }] });
    });
    const stores = await listMerchantStores(config, token);
    expect(stores).toHaveLength(2);
    expect(stores[0]).toMatchObject({ id: 'first', integration_status: 'pending', location: { country: 'MX' } });
    expect(stores[1]).toMatchObject({ id: 'second', integration_status: 'active' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('Uber activation nominates core manager via documented query, never deprecated payload, and stays pending', async () => {
    const config = app();
    const token = synthetic();
    fetchMock.mockImplementation(async (url, init) => {
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${token}`);
      if (String(url).includes('/pos_data')) {
        const target = new URL(String(url));
        expect(target.pathname).toBe('/v1/eats/stores/authorized/pos_data');
        expect(Object.fromEntries(target.searchParams)).toEqual({ is_order_manager: 'true', integrator_store_id: 'native-location',
          integrator_brand_id: 'native-brand' });
        expect(init?.method).toBe('POST');
        expect(init?.body).toBeUndefined();
        return new Response(null, { status: 200 });
      }
      return json({ stores: [{ store_id: 'authorized', name: 'Provider Name' }] });
    });
    expect(await activateMerchantStore(config, token, { id: 'authorized', name: 'Untrusted Claim' }, {
      is_order_manager: true, integrator_store_id: 'native-location', integrator_brand_id: 'native-brand',
    })).toEqual({ status: 'pending' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('Rappi provisioning uses provider-authorized name and exact batch fields without pretending active', async () => {
    const config = app('rappi');
    const token = synthetic();
    const batch = synthetic();
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/token/login/')) return json({ access_token: synthetic() });
      if (String(url).endsWith('/stores/provisioning')) {
        expect(new URL(String(url)).origin).toBe('https://api.dev.rappi.com');
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ stores: [{ store_id: '10', name: 'Authorized Parent', status: 'ACTIVE',
          ping_active: false, get_menu_active: false, cancellation_events: true, other_events: true, store_integration_id: 'location' }] });
        return json({ batch_id: batch, accepted: [{ store_id: '10', integration_id: config.integration_id }], rejected: [] }, 202);
      }
      return json(rappiStores(config));
    });
    expect(await activateMerchantStore(config, token, { id: '10', name: 'Forged Name' }, { integrator_store_id: 'location' }))
      .toEqual({ status: 'pending', batch_id: batch });
  });

  test.each(['uber_eats', 'rappi'] as const)('arbitrary %s store claims never reach mutation endpoint', async provider => {
    const config = app(provider);
    fetchMock.mockImplementation(async url => String(url).includes('/token/login/') ? json({ access_token: synthetic() })
      : json(provider === 'rappi' ? rappiStores(config) : { stores: [{ store_id: 'authorized', name: 'Name' }] }));
    await expect(activateMerchantStore(config, synthetic(), { id: 'forged', name: 'Name' })).rejects.toMatchObject({ code: 'store_mismatch' });
    await expect(deactivateMerchantStore(config, synthetic(), { id: 'forged' })).rejects.toMatchObject({ code: 'store_mismatch' });
    expect(fetchMock.mock.calls.every(([, init]) => init?.method === undefined || String(init.body).includes('client_id'))).toBe(true);
  });

  test('Rappi batch rejected, mismatching accepted integration and another integration fail closed', async () => {
    const config = app('rappi');
    let variant = 0;
    fetchMock.mockImplementation(async url => {
      if (String(url).includes('/token/login/')) return json({ access_token: synthetic() });
      if (String(url).endsWith('/stores/provisioning')) return json(variant === 0
        ? { batch_id: synthetic(), accepted: [], rejected: [{ store_id: '10', reason: 'not_owned' }] }
        : { batch_id: synthetic(), accepted: [{ store_id: '10', integration_id: synthetic() }], rejected: [] }, 202);
      return json(variant === 2 ? rappiStores({ ...config, integration_id: synthetic() }, true) : rappiStores(config));
    });
    for (variant = 0; variant < 3; variant++) {
      await expect(activateMerchantStore(config, synthetic(), { id: '10', name: 'Name' })).rejects.toThrow();
    }
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/stores/provisioning'))).toHaveLength(2);
  });

  test('idempotent active result requires live matching integration state and makes no mutation', async () => {
    const config = app('rappi');
    fetchMock.mockImplementation(async url => String(url).includes('/token/login/') ? json({ access_token: synthetic() }) : json(rappiStores(config, true)));
    expect(await activateMerchantStore(config, synthetic(), { id: '10', name: 'Name' })).toEqual({ status: 'active' });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  test('documented deactivation uses Uber DELETE and Rappi asynchronous deprovisioning, not availability toggles', async () => {
    for (const provider of ['uber_eats', 'rappi'] as const) {
      const config = app(provider);
      const batch = synthetic();
      fetchMock.mockImplementation(async (url, init) => {
        if (String(url).includes('/token/login/')) return json({ access_token: synthetic() });
        if (String(url).endsWith('/pos_data')) {
          expect(init?.method).toBe('DELETE');
          return new Response(null, { status: 200 });
        }
        if (String(url).endsWith('/stores/deprovisioning')) {
          expect(init?.method).toBe('POST');
          expect(JSON.parse(String(init?.body))).toEqual({ stores: [{ store_id: '10' }] });
          return json({ batch_id: batch, accepted: [{ store_id: '10', integration_id: config.integration_id }], rejected: [] }, 202);
        }
        return json(provider === 'rappi' ? rappiStores(config, true) : { stores: [{ store_id: '10', name: 'Name' }] });
      });
      expect(await deactivateMerchantStore(config, synthetic(), { id: '10' })).toEqual({ status: 'pending', acknowledged: true,
        ...(provider === 'rappi' ? { batch_id: batch } : {}) });
    }
  });

  test('pagination loops/duplicate IDs/bad integration booleans are rejected', async () => {
    const config = app();
    for (const payload of [{ stores: [{ store_id: 'same', name: 'One' }, { store_id: 'same', name: 'Two' }] },
      { stores: [{ store_id: 'one', name: 'One', pos_data: { integration_enabled: 'true' } }] },
      { stores: [], next_key: 'repeated' }]) {
      fetchMock.mockImplementation(async () => json(payload));
      await expect(listMerchantStores(config, synthetic())).rejects.toThrow();
    }
    await expect(getMerchantStoreStatus(config, synthetic(), { id: '../arbitrary' })).rejects.toThrow();
  });
});