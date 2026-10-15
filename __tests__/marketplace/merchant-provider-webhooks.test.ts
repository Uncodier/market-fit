/** @jest-environment node */
import { registerRappiProvisioningWebhook, registerRappiStoreWebhooks } from '../../lib/marketplace/merchant/providers';
import type { RappiWebhookSecrets } from '../../lib/marketplace/merchant/providers/types';
import { app, json, rappiStores, synthetic, webhook } from './merchant-provider-fixtures';

describe('offline global Rappi event webhook registry', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;
  const originalFetch = global.fetch;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock; });
  afterEach(() => { global.fetch = originalFetch; });

  test('new per-event registration persists returned secrets immediately and preserves only explicit authorized store', async () => {
    const config = app('rappi');
    const keys: RappiWebhookSecrets = {};
    const newOrder = synthetic();
    const cancel = synthetic();
    const mutations: string[] = [];
    const persist = jest.fn(async (event: keyof RappiWebhookSecrets, secret: string) => { keys[event] = secret; });
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/token/login/')) return json({ access_token: synthetic() });
      if (String(url).endsWith('/stores/integration-status')) return json(rappiStores(config, true));
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { event: string };
        mutations.push(body.event);
        expect(JSON.parse(String(init.body))).toEqual({ event: body.event, data: [{ url: config.webhook_url, stores: ['10'] }] });
        expect(String(url)).toBe('https://api.dev.rappi.com/api/v2/restaurants-integrations-public-api/webhook');
        if (body.event === 'ORDER_EVENT_CANCEL') expect(keys.NEW_ORDER).toBe(newOrder);
        return json(webhook(body.event, '10', config.webhook_url, body.event === 'NEW_ORDER' ? newOrder : cancel));
      }
      return json([]);
    });
    const result = await registerRappiStoreWebhooks(config, synthetic(), '10', { existing_secrets: {},
      events: ['NEW_ORDER', 'ORDER_EVENT_CANCEL'], persist_created_secret: persist });
    expect(result).toEqual({ NEW_ORDER: newOrder, ORDER_EVENT_CANCEL: cancel });
    expect(keys).toEqual(result);
    expect(mutations).toEqual(['NEW_ORDER', 'ORDER_EVENT_CANCEL']);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('reset-secret'))).toBe(false);
  });

  test('existing app event secret adds a new store without resetting or overwriting other stores', async () => {
    const config = app('rappi');
    const secret = synthetic();
    const persist = jest.fn(async () => undefined);
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/token/login/')) return json({ access_token: synthetic() });
      if (String(url).endsWith('/stores/integration-status')) return json(rappiStores(config, true));
      if (init?.method === 'PUT') {
        expect(String(url).endsWith('/webhook/NEW_ORDER/add-stores')).toBe(true);
        expect(JSON.parse(String(init.body))).toEqual({ url: config.webhook_url, stores: ['10'] });
        return json(webhook('NEW_ORDER', '10', config.webhook_url));
      }
      return json([webhook('NEW_ORDER', 'another-store', 'https://other.example.test/events')]);
    });
    expect(await registerRappiStoreWebhooks(config, synthetic(), '10', { existing_secrets: { NEW_ORDER: secret },
      events: ['NEW_ORDER'], persist_created_secret: persist })).toEqual({ NEW_ORDER: secret });
    expect(persist).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => /reset-secret|change-url|remove-stores/.test(String(url)))).toBe(false);
  });

  test('same existing store and URL is idempotent without mutations or secret writes', async () => {
    const config = app('rappi');
    const persist = jest.fn(async () => undefined);
    fetchMock.mockImplementation(async url => String(url).includes('/token/login/') ? json({ access_token: synthetic() })
      : String(url).endsWith('/stores/integration-status') ? json(rappiStores(config, true))
        : json([webhook('NEW_ORDER', '10', config.webhook_url)]));
    await registerRappiStoreWebhooks(config, synthetic(), '10', { existing_secrets: { NEW_ORDER: synthetic() },
      events: ['NEW_ORDER'], persist_created_secret: persist });
    expect(persist).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  test('existing event without known encrypted global key aborts all mutations, not automatic reset', async () => {
    const config = app('rappi');
    const persist = jest.fn(async () => undefined);
    fetchMock.mockImplementation(async url => {
      if (String(url).includes('/token/login/')) return json({ access_token: synthetic() });
      if (String(url).endsWith('/stores/integration-status')) return json(rappiStores(config, true));
      return json(String(url).endsWith('/NEW_ORDER') ? [] : [webhook('ORDER_EVENT_CANCEL', 'another', config.webhook_url)]);
    });
    await expect(registerRappiStoreWebhooks(config, synthetic(), '10', { existing_secrets: {},
      events: ['NEW_ORDER', 'ORDER_EVENT_CANCEL'], persist_created_secret: persist })).rejects.toMatchObject({ code: 'invalid_config' });
    expect(persist).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  test('existing current store URL conflict or disabled event is never destructively changed', async () => {
    const config = app('rappi');
    for (const response of [webhook('NEW_ORDER', '10', 'https://other.example.test/endpoint'),
      { event: 'NEW_ORDER', stores: [{ store_id: '10', url: config.webhook_url, state: 'DISABLE' }] }]) {
      fetchMock.mockImplementation(async url => String(url).includes('/token/login/') ? json({ access_token: synthetic() })
        : String(url).endsWith('/stores/integration-status') ? json(rappiStores(config, true)) : json([response]));
      await expect(registerRappiStoreWebhooks(config, synthetic(), '10', { existing_secrets: { NEW_ORDER: synthetic() },
        events: ['NEW_ORDER'], persist_created_secret: async () => undefined })).rejects.toMatchObject({ code: 'invalid_config' });
    }
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  test('secret persistence failure stops subsequent remote creation while first event secret is recoverable', async () => {
    const config = app('rappi');
    const persist = jest.fn(async () => { throw new Error('Offline encrypted registry unavailable'); });
    fetchMock.mockImplementation(async (url, init) => String(url).includes('/token/login/') ? json({ access_token: synthetic() })
      : String(url).endsWith('/stores/integration-status') ? json(rappiStores(config, true))
        : init?.method === 'POST' ? json(webhook('NEW_ORDER', '10', config.webhook_url, synthetic())) : json([]));
    await expect(registerRappiStoreWebhooks(config, synthetic(), '10', { existing_secrets: {},
      events: ['NEW_ORDER', 'ORDER_EVENT_CANCEL'], persist_created_secret: persist })).rejects.toThrow('Offline encrypted registry unavailable');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith('/webhook') && init?.method === 'POST')).toHaveLength(1);
  });

  test('webhook registration denies unauthorized or pending stores and unsupported PING events', async () => {
    const config = app('rappi');
    fetchMock.mockImplementation(async url => String(url).includes('/token/login/') ? json({ access_token: synthetic() }) : json(rappiStores(config)));
    for (const storeId of ['arbitrary', '10']) {
      await expect(registerRappiStoreWebhooks(config, synthetic(), storeId, { existing_secrets: {},
        events: ['NEW_ORDER'], persist_created_secret: async () => undefined })).rejects.toThrow();
    }
    await expect(registerRappiStoreWebhooks(config, synthetic(), '10', { existing_secrets: {},
      events: ['PING'] as never, persist_created_secret: async () => undefined })).rejects.toThrow();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/webhook/'))).toBe(false);
  });

  test('integration provisioning webhook persists generated custom key BEFORE provider dispatch, always signed', async () => {
    const config = app('rappi');
    const keys: RappiWebhookSecrets = {};
    const persist = jest.fn(async (event: keyof RappiWebhookSecrets, secret: string) => { keys[event] = secret; });
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/token/login/')) return json({ access_token: synthetic() });
      expect(String(url)).toBe(`https://api.dev.rappi.com/api/v2/restaurants-integrations-public-api/clients/${config.client_id}/webhooks`);
      if (init?.method !== 'POST') return json([]);
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body).toEqual({ event: 'STORE_PROVISIONING_STATUS', url: config.webhook_url, secret: keys.STORE_PROVISIONING_STATUS });
      expect(persist).toHaveBeenCalledTimes(1);
      expect(typeof body.secret).toBe('string');
      expect(String(body.secret)).toHaveLength(43);
      return json({ clientId: config.client_id, event: body.event, url: body.url, state: true }, 201);
    });
    expect(await registerRappiProvisioningWebhook(config, { existing_secrets: {}, persist_created_secret: persist })).toEqual(keys);
  });

  test('existing provisioning webhook reuses key, missing key fails closed without remote modification', async () => {
    const config = app('rappi');
    const persist = jest.fn(async () => undefined);
    fetchMock.mockImplementation(async url => String(url).includes('/token/login/') ? json({ access_token: synthetic() })
      : json([{ clientId: config.client_id, event: 'STORE_PROVISIONING_STATUS', url: config.webhook_url, state: true }]));
    const secret = synthetic();
    expect(await registerRappiProvisioningWebhook(config, { existing_secrets: { STORE_PROVISIONING_STATUS: secret }, persist_created_secret: persist }))
      .toEqual({ STORE_PROVISIONING_STATUS: secret });
    await expect(registerRappiProvisioningWebhook(config, { existing_secrets: {}, persist_created_secret: persist })).rejects.toMatchObject({ code: 'invalid_config' });
    expect(persist).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  test('same app key reused across country hosts cannot silently create a second inconsistent event key', async () => {
    const config = { ...app('rappi', 'production'), country: 'CO' };
    const knownKey = synthetic();
    const persist = jest.fn(async () => undefined);
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/token/login/')) return json({ access_token: synthetic() });
      expect(new URL(String(url)).origin).toBe('https://api.rappi.com.co');
      if (String(url).endsWith('/stores/integration-status')) return json(rappiStores(config, true));
      expect(init?.method).toBeUndefined();
      return json([]);
    });
    await expect(registerRappiStoreWebhooks(config, synthetic(), '10', { existing_secrets: { NEW_ORDER: knownKey },
      events: ['NEW_ORDER'], persist_created_secret: persist })).rejects.toMatchObject({ code: 'invalid_config' });
    expect(persist).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('reset-secret'))).toBe(false);
  });
});