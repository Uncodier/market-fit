/** @jest-environment node */
import preflight from '../../tests/support/preflight';

const original = process.env;
beforeEach(() => {
  process.env = {
    TEST_TARGET: 'local', TEST_SUITE: 'smoke',
    TEST_BASE_URL: 'http://localhost:3000', TEST_COMMERCE_BASE_URL: 'http://localhost:3000',
    TEST_SITE_ID: '11111111-1111-4111-8111-111111111111', TEST_SITE_NAME: 'E2E',
    TEST_ADMIN_EMAIL: 'admin@example.invalid', TEST_ADMIN_PASSWORD: 'test-only',
    TEST_SHOP_SLUG: 'e2e', TEST_CATALOG_ITEM_ID: '22222222-2222-4222-8222-222222222222',
    TEST_CATALOG_ITEM_NAME: 'Fixture', TEST_CONTENT_NAME: 'Content sentinel', TEST_LEAD_NAME: 'Lead sentinel',
  };
});
afterEach(() => { process.env = original; });

it('allows a fully declared smoke without making requests', async () => {
  await expect(preflight()).resolves.toBeUndefined();
});
it.each(['TEST_ADMIN_PASSWORD', 'TEST_CONTENT_NAME', 'TEST_LEAD_NAME', 'TEST_CATALOG_ITEM_ID'])('blocks missing %s before browser setup', async key => {
  delete process.env[key];
  await expect(preflight()).rejects.toThrow(key);
});
it('does not substitute admin credentials for a buyer identity', async () => {
  process.env.TEST_SUITE = 'buyer';
  await expect(preflight()).rejects.toThrow('TEST_BUYER_EMAIL');
});
it('does not silently skip an unconfigured permission matrix', async () => {
  process.env.TEST_SUITE = 'roles';
  process.env.TEST_ALLOW_MUTATIONS = '1';
  process.env.TEST_DISPOSABLE_ENVIRONMENT = '1';
  await expect(preflight()).rejects.toThrow('TEST_COLLABORATOR_EMAIL');
});