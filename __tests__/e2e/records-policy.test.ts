/** @jest-environment node */
import { recordsPolicy } from '../../tests/support/records-policy';

const now = Date.parse('2026-11-10T12:00:00Z');
const env = {
  TEST_TARGET: 'local', TEST_SUITE: 'records', TEST_BASE_URL: 'http://127.0.0.1:3000',
  TEST_COMMERCE_BASE_URL: 'http://127.0.0.1:3000', TEST_SITE_ID: '11111111-1111-4111-8111-111111111111',
  TEST_SITE_NAME: 'QA workspace', TEST_ALLOW_MUTATIONS: '1', TEST_DISPOSABLE_ENVIRONMENT: '1',
  QA_STATUS: 'VERIFIED', QA_ENVIRONMENT_ID: 'qa-unit', SHIPLIGHT_RUN_ID: 'qa-unit-records-case1',
  QA_EXPIRES_AT: '2026-11-10T16:00:00Z', TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
  TEST_SUPABASE_ANON_KEY: 'sb_publishable_test_public_only',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test_public_only',
  TEST_RECORDS_RELATION_GUARD_READY: '1', TEST_RECORDS_LOCAL_EFFECTS_ACK: '1',
  TEST_RECORDS_TRASH_READY: '1',
  TEST_ADMIN_EMAIL: 'admin@qa-unit.invalid', TEST_ADMIN_PASSWORD: 'fake-test-only',
  TEST_FOREIGN_EMAIL: 'foreign@qa-unit.invalid', TEST_FOREIGN_PASSWORD: 'fake-test-only',
  TEST_FOREIGN_SITE_ID: '22222222-2222-4222-8222-222222222222', TEST_FOREIGN_SITE_NAME: 'Foreign QA',
  TEST_LEAD_NAME: 'QA contact', TEST_RECORDS_SUPPLIER_NAME: 'qa-unit supplier',
  TEST_RECORDS_ORDER_NUMBER: 'qa-unit order', TEST_RECORDS_SUPPLIER_ID: '33333333-3333-4333-8333-333333333333',
  TEST_RECORDS_ORDER_ID: '44444444-4444-4444-8444-444444444444',
};

it('accepts only the explicitly bound offline policy fixture', () => {
  expect(recordsPolicy(env, now)).toMatchObject({ suite: 'records', qaId: 'qa-unit' });
});

it.each(['TEST_RECORDS_RELATION_GUARD_READY', 'TEST_RECORDS_LOCAL_EFFECTS_ACK', 'TEST_RECORDS_TRASH_READY', 'TEST_ADMIN_EMAIL',
  'TEST_FOREIGN_PASSWORD', 'TEST_RECORDS_SUPPLIER_ID', 'TEST_RECORDS_ORDER_ID', 'TEST_FOREIGN_SITE_ID'])
('blocks missing %s before authentication or fixture writes', key => {
  expect(() => recordsPolicy({ ...env, [key]: '' }, now)).toThrow();
});

it('blocks production even with every mutation acknowledgment', () => {
  expect(() => recordsPolicy({ ...env, TEST_TARGET: 'production', TEST_BASE_URL: 'https://app.makinari.com',
    TEST_COMMERCE_BASE_URL: 'https://www.makinari.com' }, now)).toThrow(/production/);
});

it.each([
  { TEST_FOREIGN_SITE_ID: env.TEST_SITE_ID },
  { TEST_FOREIGN_EMAIL: env.TEST_ADMIN_EMAIL },
  { TEST_ADMIN_EMAIL: 'real@example.com' },
  { TEST_RECORDS_SUPPLIER_NAME: 'Real supplier' },
  { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' },
  { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'different' },
  { QA_STATUS: 'INCOMPLETE' },
])('rejects unsafe QA identity/backend configuration %p', override => {
  expect(() => recordsPolicy({ ...env, ...override }, now)).toThrow();
});