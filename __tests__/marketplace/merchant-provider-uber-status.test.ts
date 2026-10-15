/** @jest-environment node */
import { getMerchantStoreStatus, getUberStoreIntegrationStatus, listMerchantStores, deactivateMerchantStore, activateMerchantStore } from '../../lib/marketplace/merchant/providers';
import { app, json, synthetic } from './merchant-provider-fixtures';

describe('authoritative offline Uber POS integration status', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;
  const originalFetch = global.fetch;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock; });
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

  test('missing discovery summary is pending, authoritative flat app POS payload confirms manager', async () => {
    const config = app();
    const merchant = synthetic();
    const application = synthetic();
    fetchMock.mockImplementation(async (url, init) => {
      const target = new URL(String(url));
      if (target.pathname.endsWith('/token')) {
        expect(target.origin).toBe('https://sandbox-login.uber.com');
        expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({ client_id: config.client_id,
          client_secret: config.client_secret, grant_type: 'client_credentials', scope: 'eats.store' });
        return json({ access_token: application, token_type: 'Bearer', expires_in: 2592000 });
      }
      expect(target.origin).toBe('https://test-api.uber.com');
      if (target.pathname.endsWith('/pos_data')) {
        expect(target.pathname).toBe('/v1/eats/stores/authorized/pos_data');
        expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${application}`);
        return json({ store_id: 'authorized', integration_enabled: true, order_manager_client_id: config.client_id });
      }
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${merchant}`);
      return json({ stores: [{ store_id: 'authorized', name: 'Provider Name' }] });
    });
    expect((await listMerchantStores(config, merchant))[0].integration_status).toBe('pending');
    expect(await getMerchantStoreStatus(config, merchant, { id: 'authorized' })).toMatchObject({ id: 'authorized',
      integrated: true, integration_status: 'active', name: 'Provider Name' });
  });

  test.each([
    { enabled: true, pending: true, manager: 'self', expected: 'pending' },
    { enabled: true, pending: false, manager: 'other', expected: 'pending' },
    { enabled: true, pending: undefined, manager: undefined, expected: 'pending' },
    { enabled: true, pending: false, manager: 'self', expected: 'active' },
    { enabled: false, pending: false, manager: 'self', expected: 'inactive' },
  ])('never promotes secondary/pending manager: $expected', async ({ enabled, pending, manager, expected }) => {
    const config = app();
    fetchMock.mockImplementation(async url => String(url).endsWith('/token')
      ? json({ access_token: synthetic(), expires_in: 3600 }) : json({ store_id: 'store', integration_enabled: enabled,
        ...(pending !== undefined ? { is_order_manager_pending: pending } : {}),
        ...(manager ? { order_manager_client_id: manager === 'self' ? config.client_id : synthetic() } : {}) }));
    expect(await getUberStoreIntegrationStatus(config, { id: 'store' })).toEqual({ id: 'store', integrated: enabled, integration_status: expected });
  });

  test('POS 404 after deletion allows inactive status; auth endpoint 404/403 and POS 401/403/500 never fake revocation', async () => {
    for (const code of [401, 403, 404, 500]) {
      const config = app();
      fetchMock.mockImplementation(async url => String(url).endsWith('/token')
        ? json({ access_token: synthetic(), expires_in: 3600 }) : json({ message: synthetic() }, code));
      if (code === 404) expect(await getUberStoreIntegrationStatus(config, { id: 'store' })).toEqual({ id: 'store', integrated: false, integration_status: 'inactive' });
      else await expect(getUberStoreIntegrationStatus(config, { id: 'store' })).rejects.toMatchObject({ code: 'http_error', http_status: code });
    }
    fetchMock.mockResolvedValue(json({ message: synthetic() }, 404));
    await expect(getUberStoreIntegrationStatus(app(), { id: 'store' })).rejects.toMatchObject({ code: 'http_error', http_status: 404 });
  });

  test('merchant discovery authorizes before app scoped POS fetch; arbitrary store blocked', async () => {
    fetchMock.mockResolvedValue(json({ stores: [{ store_id: 'authorized', name: 'Name' }] }));
    await expect(getMerchantStoreStatus(app(), synthetic(), { id: 'arbitrary' })).rejects.toMatchObject({ code: 'store_mismatch' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('stale active discovery summary never yields active when authoritative POS still pending', async () => {
    const config = app();
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith('/token')) return json({ access_token: synthetic(), expires_in: 3600 });
      if (String(url).includes('/pos_data')) {
        if (init?.method === 'POST') return new Response(null, { status: 200 });
        return json({ store_id: 'owned', integration_enabled: true, order_manager_client_id: config.client_id,
          is_order_manager_pending: true });
      }
      return json({ stores: [{ store_id: 'owned', name: 'Owned', pos_data: { integration_enabled: true,
        order_manager_client_id: config.client_id, is_order_manager_pending: false } }] });
    });
    expect(await getMerchantStoreStatus(config, synthetic(), { id: 'owned' })).toMatchObject({ integration_status: 'pending' });
    expect(await activateMerchantStore(config, synthetic(), { id: 'owned', name: 'Owned' }, { is_order_manager: true }))
      .toEqual({ status: 'pending' });
  });

  test('GET POS verifies returned store and strict booleans', async () => {
    const config = app();
    let payload: unknown = {};
    fetchMock.mockImplementation(async url => String(url).endsWith('/token')
      ? json({ access_token: synthetic(), expires_in: 3600 }) : json(payload));
    for (payload of [{ store_id: 'wrong', integration_enabled: true }, { store_id: 'store', integration_enabled: 'true' },
      { store_id: 'store', integration_enabled: true, is_order_manager_pending: 'false' },
      { store_id: 'store', integration_enabled: true, order_manager_client_id: 1 }]) {
      await expect(getUberStoreIntegrationStatus(config, { id: 'store' })).rejects.toMatchObject({ code: 'invalid_response' });
    }
  });

  test('scope-specific app token cache deduplicates refresh and rotates credentials', async () => {
    jest.useFakeTimers();
    const config = app();
    fetchMock.mockImplementation(async url => String(url).endsWith('/token')
      ? json({ access_token: synthetic(), expires_in: 10 }) : json({ store_id: 'store', integration_enabled: false }));
    await Promise.all([getUberStoreIntegrationStatus(config, { id: 'store' }), getUberStoreIntegrationStatus(config, { id: 'store' })]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/token'))).toHaveLength(1);
    jest.advanceTimersByTime(9100);
    await getUberStoreIntegrationStatus(config, { id: 'store' });
    await getUberStoreIntegrationStatus({ ...config, client_secret: synthetic() }, { id: 'store' });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/token'))).toHaveLength(3);
  });

  test('Uber merchant still owns store after app DELETE; no fabricated store mismatch', async () => {
    const config = app();
    const merchant = synthetic();
    let deleted = false;
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith('/token')) return json({ access_token: synthetic(), expires_in: 3600 });
      if (String(url).includes('/pos_data')) {
        if (init?.method === 'DELETE') { deleted = true; return new Response(null, { status: 200 }); }
        return json({}, deleted ? 404 : 200);
      }
      return json({ stores: [{ store_id: 'owned', name: 'Owned Location' }] });
    });
    expect(await deactivateMerchantStore(config, merchant, { id: 'owned' })).toEqual({ status: 'pending', acknowledged: true });
    expect(await getMerchantStoreStatus(config, merchant, { id: 'owned' })).toMatchObject({ id: 'owned', integration_status: 'inactive' });
  });
});