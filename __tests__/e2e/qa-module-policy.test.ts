/** @jest-environment node */
import { qaModulePolicy } from '../../tests/support/qa-module-policy';
import { readEnvironment } from '../../tests/support/environment';

const now = Date.parse('2026-10-31T12:00:00Z');
const env = {
  TEST_TARGET: 'local', TEST_SUITE: 'procurement', TEST_BASE_URL: 'http://127.0.0.1:3000',
  TEST_COMMERCE_BASE_URL: 'http://127.0.0.1:3000', TEST_SITE_ID: '11111111-1111-4111-8111-111111111111',
  TEST_SITE_NAME: 'QA workspace', TEST_ALLOW_MUTATIONS: '1', TEST_DISPOSABLE_ENVIRONMENT: '1',
  QA_STATUS: 'VERIFIED', QA_ENVIRONMENT_ID: 'qa-unit', SHIPLIGHT_RUN_ID: 'qa-unit-procurement-case1',
  QA_EXPIRES_AT: '2026-10-31T16:00:00Z', TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
  TEST_SUPABASE_ANON_KEY: 'sb_publishable_test_public_only',
};

it.each(['procurement', 'subsystems', 'records'])('allows only explicitly scoped verified %s QA', suite => {
  expect(qaModulePolicy({ ...env, TEST_SUITE: suite, SHIPLIGHT_RUN_ID: `qa-unit-${suite}-case1` }, now))
    .toMatchObject({ suite, qaId: 'qa-unit', backend: 'http://127.0.0.1:54321' });
});
it.each(['QA_STATUS', 'QA_ENVIRONMENT_ID', 'SHIPLIGHT_RUN_ID', 'QA_EXPIRES_AT', 'TEST_SUPABASE_URL', 'TEST_SUPABASE_ANON_KEY'])
('rejects absent %s before any browser calls', key => {
  expect(() => qaModulePolicy({ ...env, [key]: '' }, now)).toThrow();
});
it.each(['qa-other-procurement-case1', 'qa-unit-subsystems-case1', '../qa-unit-procurement-case1', 'latest'])
('rejects wrong run identity %s', runId => {
  expect(() => qaModulePolicy({ ...env, SHIPLIGHT_RUN_ID: runId }, now)).toThrow('namespace');
});
it.each(['invalid', '2026-10-31T12:19:59Z', '2026-10-30T16:00:00Z'])('rejects inadequate expiry %s', expiry => {
  expect(() => qaModulePolicy({ ...env, QA_EXPIRES_AT: expiry }, now)).toThrow('expiry');
});
it('cannot run these mutation suites in production even with both flags', () => {
  expect(() => readEnvironment({ ...env, TEST_TARGET: 'production', TEST_BASE_URL: 'https://app.makinari.com',
    TEST_COMMERCE_BASE_URL: 'https://www.makinari.com' })).toThrow('production');
});
it('rejects remote backend and service-role credentials', () => {
  expect(() => qaModulePolicy({ ...env, TEST_SUPABASE_URL: 'https://example.supabase.co' }, now)).toThrow('loopback');
  const secret = `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.test`;
  expect(() => qaModulePolicy({ ...env, TEST_SUPABASE_ANON_KEY: secret }, now)).toThrow('public Supabase key');
});
it('rejects regression suite reuse and missing consent', () => {
  expect(() => qaModulePolicy({ ...env, TEST_SUITE: 'regression' }, now)).toThrow('isolated');
  expect(() => qaModulePolicy({ ...env, TEST_ALLOW_MUTATIONS: '0' }, now)).toThrow('TEST_ALLOW_MUTATIONS');
});