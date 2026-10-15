/** @jest-environment node */
import { randomBytes } from 'node:crypto';
import { actOnOrder, fetchOrder, fetchOrderEvents, fetchNewOrders } from '../../lib/marketplace/providers';
import { assertSafeProviderUrl } from '../../lib/marketplace/providers/endpoints';
import { PROVIDER_MAX_RESPONSE_BYTES, PROVIDER_TIMEOUT_MS, requestProvider } from '../../lib/marketplace/providers/http';
import { config, jsonResponse, rappiOrder, uberOrder } from './provider-fixtures';

describe('offline marketplace HTTP adapters', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;
  const originalFetch = global.fetch;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock; });
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

  test('Uber authenticates with actual configured credentials, approved scope, sandbox hosts and token cache', async () => {
    const connection = config();
    const payload = uberOrder(connection.store_id);
    const token = randomBytes(32).toString('base64url');
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/oauth/')) {
        expect(String(url)).toBe('https://sandbox-login.uber.com/oauth/v2/token');
        const form = new URLSearchParams(String(init?.body));
        expect(form.get('client_id')).toBe(connection.client_id);
        expect(form.get('client_secret')).toBe(connection.client_secret);
        expect(form.get('scope')).toBe('eats.order');
        expect(form.get('grant_type')).toBe('client_credentials');
        return jsonResponse({ access_token: token, token_type: 'Bearer', expires_in: 3600 });
      }
      expect(String(url)).toBe(`https://test-api.uber.com/v2/eats/order/${payload.id}`);
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${token}`);
      expect(init).toMatchObject({ cache: 'no-store', redirect: 'error' });
      expect(init?.signal).toBeDefined();
      return jsonResponse(payload);
    });
    await Promise.all([fetchOrder(connection, payload.id), fetchOrder(connection, payload.id)]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/oauth/'))).toHaveLength(1);
  });
  test('credential rotation and safe token expiry invalidate process cache', async () => {
    jest.useFakeTimers();
    const connection = config();
    const payload = uberOrder(connection.store_id);
    fetchMock.mockImplementation(async url => String(url).includes('/oauth/')
      ? jsonResponse({ access_token: randomBytes(32).toString('hex'), expires_in: 10 }) : jsonResponse(payload));
    await fetchOrder(connection, payload.id);
    jest.advanceTimersByTime(9100);
    await fetchOrder(connection, payload.id);
    await fetchOrder({ ...connection, client_secret: randomBytes(32).toString('hex') }, payload.id);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/oauth/'))).toHaveLength(3);
  });
  test('Uber documented acceptance/rejection/cancellation payloads and unsupported ready', async () => {
    const connection = config();
    const payload = uberOrder(connection.store_id);
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/oauth/')) return jsonResponse({ access_token: randomBytes(32).toString('hex'), expires_in: 3600 });
      if (String(url).includes('/v2/')) return jsonResponse(payload);
      expect(init?.method).toBe('POST');
      return new Response(null, { status: 204 });
    });
    await actOnOrder(connection, payload.id, { action: 'accept', cooking_time_minutes: 15 });
    const accept = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/accept_pos_order'));
    expect(String(accept?.[0])).toContain('/v1/eats/orders/');
    expect(JSON.parse(String(accept?.[1]?.body))).toMatchObject({ reason: 'Accepted by merchant', pickup_time: expect.any(Number) });
    expect(await actOnOrder(connection, payload.id, { action: 'reject', reason: 'Unavailable item' })).toMatchObject({ acknowledged: true });
    const reject = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/deny_pos_order'));
    expect(JSON.parse(String(reject?.[1]?.body))).toEqual({ reason: { code: 'OTHER', explanation: 'Unavailable item' } });
    await actOnOrder(connection, payload.id, { action: 'cancel', reason: 'Cannot prepare' });
    const cancel = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/cancel'));
    expect(JSON.parse(String(cancel?.[1]?.body))).toEqual({ reason: 'OTHER', details: 'Cannot prepare' });
    const calls = fetchMock.mock.calls.length;
    await expect(actOnOrder(connection, payload.id, { action: 'ready' })).rejects.toMatchObject({ code: 'unsupported_operation' });
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });
  test('Rappi uses country token host, x-authorization and store-filtered documented lists', async () => {
    const connection = { ...config('rappi'), environment: 'production' as const };
    const payload = rappiOrder(connection.store_id);
    const token = randomBytes(32).toString('hex');
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/token/')) {
        expect(String(url)).toBe('https://api.rappi.com.mx/restaurants/auth/v1/token/login/integrations');
        expect(JSON.parse(String(init?.body))).toEqual({ client_id: connection.client_id, client_secret: connection.client_secret });
        return jsonResponse({ access_token: token });
      }
      const target = new URL(String(url));
      expect(target.hostname).toBe('services.mxgrability.rappi.com');
      expect(target.searchParams.get('storeId')).toBe(connection.store_id);
      expect(new Headers(init?.headers).get('x-authorization')).toBe(`Bearer ${token}`);
      return jsonResponse(target.pathname.endsWith('/status/sent') ? [payload] : []);
    });
    expect((await fetchOrder(connection, payload.order_detail.order_id)).total).toBe(315);
    expect(fetchMock.mock.calls).toHaveLength(2);
    await expect(fetchOrder(connection, 'missing-order')).rejects.toMatchObject({ code: 'not_found' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/orders/missing-order'))).toBe(false);
    expect(fetchMock.mock.calls.filter(([url]) => !String(url).includes('/token/'))
      .every(([url]) => new URL(String(url)).pathname.endsWith('/status/sent'))).toBe(true);
  });
  test('Rappi actions are documented, cancellation always unsupported, manual-ready opt-in', async () => {
    const connection = config('rappi');
    const payload = rappiOrder(connection.store_id);
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/token/')) return jsonResponse({ access_token: randomBytes(32).toString('hex') });
      if (init?.method === 'PUT' || init?.method === 'POST') return new Response(null, { status: 200 });
      return jsonResponse([payload]);
    });
    await actOnOrder(connection, payload.order_detail.order_id, { action: 'accept', cooking_time_minutes: 12 });
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/take/12') && init?.method === 'PUT')).toBe(true);
    await actOnOrder(connection, payload.order_detail.order_id, { action: 'reject', reason: 'Unavailable' });
    const reject = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/reject'));
    expect(JSON.parse(String(reject?.[1]?.body))).toEqual({ reason: 'Unavailable' });
    await expect(actOnOrder(connection, payload.order_detail.order_id, { action: 'cancel', reason: 'Unavailable' })).rejects.toMatchObject({ code: 'unsupported_operation' });
    await expect(actOnOrder(connection, payload.order_detail.order_id, { action: 'ready' })).rejects.toMatchObject({ code: 'unsupported_operation' });
    await actOnOrder({ ...connection, manual_ready: true }, payload.order_detail.order_id, { action: 'ready' });
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/ready-for-pickup') && init?.method === 'POST')).toBe(true);
    expect(fetchMock.mock.calls.every(([, init]) => ['POST', 'PUT'].includes(init?.method ?? 'GET'))).toBe(true);
  });
  test('Rappi event sync and recovery use the documented endpoints', async () => {
    const connection = config('rappi');
    const payload = rappiOrder(connection.store_id, 'order-id');
    fetchMock.mockImplementation(async url => {
      if (String(url).includes('/token/')) return jsonResponse({ access_token: randomBytes(32).toString('hex') });
      if (String(url).endsWith('/order-id/events')) return jsonResponse([
        { event: 'canceled_with_charge', event_time: '2026-01-01T12:31:12.501Z', additional_information: {} },
        { event: 'taken_visible_order', event_time: '2026-01-01T12:30:12.501Z', additional_information: { eta_to_store: '15' } },
      ]);
      expect(new URL(String(url)).searchParams.get('storeId')).toBe(connection.store_id);
      return jsonResponse([payload]);
    });
    const events = await fetchOrderEvents(connection, 'order-id');
    expect(events[0]).toMatchObject({ external_order_id: 'order-id', external_store_id: connection.store_id, kind: 'cancel' });
    expect(events[1]).toMatchObject({ kind: 'delivery', delivery: { provider_event: 'taken_visible_order' } });
    expect(events[1].delivery?.status).toBeUndefined();
    expect((await fetchNewOrders(connection))[0].external_order_id).toBe('order-id');
    await expect(fetchOrderEvents(config(), 'order-id')).rejects.toMatchObject({ code: 'unsupported_operation' });
    await expect(fetchNewOrders(config())).rejects.toMatchObject({ code: 'unsupported_operation' });
  });
  test('invalid IDs, country, action input and cross-store data are rejected before action writes', async () => {
    const connection = config();
    await expect(fetchOrder(connection, 'https://attacker.invalid/order')).rejects.toThrow();
    await expect(fetchOrder({ ...config('rappi'), country: 'ZZ' }, 'order')).rejects.toThrow();
    await expect(actOnOrder(connection, 'order', { action: 'accept', cooking_time_minutes: 121 })).rejects.toThrow();
    await expect(actOnOrder(connection, 'order', { action: 'cancel' })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockImplementation(async url => String(url).includes('/oauth/')
      ? jsonResponse({ access_token: randomBytes(32).toString('hex'), expires_in: 3600 }) : jsonResponse(uberOrder('different-store', 'order')));
    await expect(actOnOrder(connection, 'order', { action: 'accept' })).rejects.toMatchObject({ code: 'store_mismatch' });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST' && String(init.body).includes('Accepted'))).toBe(false);
  });
  test('errors never echo provider bodies or configured credentials', async () => {
    const connection = config();
    const token = randomBytes(32).toString('hex');
    fetchMock.mockResolvedValue(jsonResponse({ message: `${connection.client_id} ${connection.client_secret} ${connection.webhook_secret} ${token}` }, 401));
    try { await fetchOrder(connection, 'order'); throw new Error('Expected error'); } catch (error) {
      const output = JSON.stringify(error) + String(error);
      for (const sensitive of [connection.client_id, connection.client_secret, connection.webhook_secret!, token]) expect(output).not.toContain(sensitive);
      expect(error).toMatchObject({ code: 'http_error', http_status: 401 });
    }
  });
  test('invalid token structure, non-JSON and unbounded responses fail closed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ access_token: randomBytes(32).toString('hex'), expires_in: -1 }));
    await expect(fetchOrder(config(), 'order')).rejects.toMatchObject({ code: 'invalid_response' });
    fetchMock.mockResolvedValue(new Response('<html>bad</html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect(requestProvider(new URL('https://api.uber.com/v2/eats/order/order'), {})).rejects.toMatchObject({ code: 'invalid_response' });
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(PROVIDER_MAX_RESPONSE_BYTES + 1)); controller.close(); } });
    fetchMock.mockResolvedValue(new Response(stream, { headers: { 'Content-Type': 'application/json' } }));
    await expect(requestProvider(new URL('https://api.uber.com/v2/eats/order/order'), {})).rejects.toMatchObject({ code: 'invalid_response' });
  });
  test('timeouts abort fetch and all unsafe destinations are rejected', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
    }));
    const request = requestProvider(new URL('https://api.uber.com/v2/eats/order/order'), {});
    const assertion = expect(request).rejects.toMatchObject({ code: 'timeout' });
    jest.advanceTimersByTime(PROVIDER_TIMEOUT_MS + 1);
    await assertion;
    for (const target of ['http://api.uber.com/order', 'https://attacker.invalid/order', 'https://api.uber.com:8443/order', 'https://api.uber.com/order#fragment']) {
      expect(() => assertSafeProviderUrl(new URL(target))).toThrow();
    }
    const authenticated = new URL('https://provider.invalid');
    authenticated.username = randomBytes(18).toString('hex');
    authenticated.password = randomBytes(32).toString('hex');
    expect(() => assertSafeProviderUrl(authenticated)).toThrow();
  });
});