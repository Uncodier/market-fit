/** @jest-environment node */
import { assertReadReady, commerceFixtures, commerceUrl, requiredReadFixture } from '../../tests/support/read-assertions';
import { finderData } from '../../tests/support/read-people';
import type { Page, Locator } from '@playwright/test';

jest.mock('../../tests/support/workspace', () => ({ dismissConsent: jest.fn() }));
jest.mock('@playwright/test', () => ({
  expect: (value: { visible?: boolean; count?: number; url?: () => string }) => ({
    toHaveURL: async (predicate: (url: URL) => boolean) => expect(predicate(new URL(value.url!()))).toBe(true),
    toBeVisible: async () => expect(value.visible).toBe(true),
    toHaveCount: async (count: number) => expect(value.count).toBe(count),
  }),
}));

const env = {
  TEST_COMMERCE_BASE_URL: 'http://localhost:3100',
  TEST_SHOP_SLUG: 'e2e-shop',
  TEST_CATALOG_ITEM_ID: '11111111-1111-4111-8111-111111111111',
  TEST_CATALOG_ITEM_NAME: 'Fixture Item',
};

describe('read fixture validation', () => {
  it.each(Object.keys(env))('requires %s without a hidden fixture fallback', name => {
    expect(() => commerceFixtures({ ...env, [name]: '' })).toThrow(name);
  });
  it('builds commerce URLs on the explicit host, not the workspace host', () => {
    expect(commerceUrl('/marketplace', env)).toBe('http://localhost:3100/marketplace');
    expect(commerceFixtures(env)).toEqual({ slug: 'e2e-shop', itemId: env.TEST_CATALOG_ITEM_ID, itemName: 'Fixture Item' });
  });
  it.each(['invalid', 'demo-item', '../../secret'])('rejects invalid catalog IDs: %s', value => {
    expect(() => commerceFixtures({ ...env, TEST_CATALOG_ITEM_ID: value })).toThrow('UUID');
  });
  it.each(['../shop', 'shop?token=x', 'shop#x', 'shop/name'])('rejects non-segment shop slugs: %s', value => {
    expect(() => commerceFixtures({ ...env, TEST_SHOP_SLUG: value })).toThrow('URL segment');
  });
  it.each(['https://user:secret@example.test', 'https://example.test/path', 'file:///tmp/test', 'https://example.test?token=x'])(
    'rejects unsafe commerce origins: %s', value => {
      expect(() => commerceUrl('/marketplace', { ...env, TEST_COMMERCE_BASE_URL: value })).toThrow('HTTP(S) origin');
    },
  );
  it.each(['//example.test/cart', 'https://example.test/cart', '/\\example.test/cart'])(
    'rejects external commerce targets: %s', value => expect(() => commerceUrl(value, env)).toThrow(),
  );
  it('requires the configured buyer identity', () => {
    expect(() => requiredReadFixture('TEST_BUYER_EMAIL', {})).toThrow('TEST_BUYER_EMAIL');
  });
});

describe('People provider results', () => {
  it('accepts successful populated and explicit empty data contracts', () => {
    expect(finderData({ success: true, data: { search_results: [{}] } }, 'search').search_results).toHaveLength(1);
    expect(finderData({ search_results: [] }, 'search').search_results).toEqual([]);
    expect(finderData({ total_persons: 0 }, 'totals').total_persons).toBe(0);
  });
  it.each([
    { success: false, data: { search_results: [] } },
    { error: 'provider unavailable', search_results: [] },
    { success: true, data: { error: 'rate limited', search_results: [] } },
    { success: true, data: { success: false, search_results: [] } },
  ])('rejects provider failure disguised as empty HTTP 200: %j', body => {
    expect(() => finderData(body, 'search')).toThrow('provider failed');
  });
  it.each([{}, { search_results: null }, { search_results: '[]' }])('requires actual search results: %j', body => {
    expect(() => finderData(body, 'search')).toThrow('results contract');
  });
  it.each([{}, { total_persons: -1 }, { total_persons: '0' }])('requires successful totals: %j', body => {
    expect(() => finderData(body, 'totals')).toThrow('successful count');
  });
});

describe('hard read gates without launching a browser', () => {
  const oldBase = process.env.TEST_BASE_URL;
  beforeEach(() => { process.env.TEST_BASE_URL = 'http://localhost:3000'; });
  afterAll(() => {
    if (oldBase === undefined) delete process.env.TEST_BASE_URL;
    else process.env.TEST_BASE_URL = oldBase;
  });

  function pageFor(url: string, loading = 0, errors = 0) {
    return {
      url: () => url,
      locator: (selector: string) => ({ count: selector.includes('animate-pulse') ? loading : errors }),
      getByText: () => ({ filter: () => ({ count: 0 }) }),
    } as unknown as Page;
  }
  const proof = (visible: boolean) => ({ visible }) as unknown as Locator;

  it('accepts only the correct route with positive content and settled loading', async () => {
    await expect(assertReadReady(pageFor('http://localhost:3000/dashboard?tab=sales'), '/dashboard?tab=sales', proof(true))).resolves.toBeUndefined();
  });
  it.each(['http://localhost:3000/auth', 'http://localhost:3000/dashboard?tab=overview', 'http://localhost:3100/dashboard?tab=sales'])(
    'rejects redirects, incorrect tab or wrong host: %s', async url => {
      await expect(assertReadReady(pageFor(url), '/dashboard?tab=sales', proof(true))).rejects.toThrow();
    },
  );
  it('rejects an empty shell even when its URL and title look healthy', async () => {
    await expect(assertReadReady(pageFor('http://localhost:3000/orders'), '/orders', proof(false))).rejects.toThrow();
  });
  it('fails rather than warning when skeletons never finish', async () => {
    await expect(assertReadReady(pageFor('http://localhost:3000/orders', 1), '/orders', proof(true))).rejects.toThrow();
  });
  it('rejects visible provider errors even with a working search control', async () => {
    await expect(assertReadReady(pageFor('http://localhost:3000/people', 0, 1), '/people', proof(true))).rejects.toThrow();
  });
});