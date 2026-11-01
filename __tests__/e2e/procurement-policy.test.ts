/** @jest-environment node */
import { procurementPolicy, procurementMarker, assertProcurementQaOwnership } from '../../tests/support/procurement-policy';

const now = Date.parse('2026-10-31T00:00:00Z');
function environment(): Record<string, string> {
  const qa = 'qa-offline';
  return {
    TEST_TARGET: 'local', TEST_SUITE: 'procurement', TEST_BASE_URL: 'http://localhost:3000', TEST_COMMERCE_BASE_URL: 'http://localhost:3000',
    TEST_SITE_ID: '11111111-1111-4111-8111-111111111111', TEST_SITE_NAME: `${qa} workspace`, TEST_FOREIGN_SITE_ID: '22222222-2222-4222-8222-222222222222',
    TEST_CATALOG_ITEM_ID: '33333333-3333-4333-8333-333333333333', TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
    TEST_SUPABASE_ANON_KEY: 'sb_publishable_offline', TEST_ALLOW_MUTATIONS: '1', TEST_DISPOSABLE_ENVIRONMENT: '1',
    QA_STATUS: 'VERIFIED', QA_ENVIRONMENT_ID: qa, QA_EXPIRES_AT: '2026-10-31T02:00:00Z', SHIPLIGHT_RUN_ID: `${qa}-procurement-unique`,
    ...Object.fromEntries(['ADMIN', 'BUYER', 'COLLABORATOR', 'FOREIGN'].flatMap(role => [
      [`TEST_${role}_EMAIL`, `${role.toLowerCase()}@${qa}.invalid`], [`TEST_${role}_PASSWORD`, 'offline-only'],
    ])),
  };
}

describe('procurement destructive authority is never inferred', () => {
  it('accepts only explicitly selected verified expiring local QA scope', () => {
    expect(procurementPolicy(environment(), now).qaId).toBe('qa-offline');
  });
  it.each([
    ['TEST_TARGET', 'production'], ['TEST_TARGET', 'staging'], ['TEST_SUITE', 'smoke'], ['TEST_SUITE', 'subsystems'],
    ['TEST_ALLOW_MUTATIONS', '0'], ['TEST_DISPOSABLE_ENVIRONMENT', '0'], ['QA_STATUS', 'PLANNED'],
    ['QA_EXPIRES_AT', 'invalid'], ['QA_EXPIRES_AT', '2026-10-31T00:19:59Z'],
    ['QA_ENVIRONMENT_ID', '../qa-offline'], ['SHIPLIGHT_RUN_ID', 'latest'], ['SHIPLIGHT_RUN_ID', 'qa-other-procurement-unique'],
    ['TEST_BUYER_EMAIL', 'admin@qa-offline.invalid'], ['TEST_BUYER_EMAIL', 'buyer@example.com'],
    ['TEST_FOREIGN_SITE_ID', '11111111-1111-4111-8111-111111111111'], ['TEST_CATALOG_ITEM_ID', 'demo-item'],
    ['TEST_SUPABASE_URL', 'https://remote.supabase.co'], ['TEST_SUPABASE_ANON_KEY', 'service-role'],
  ])('rejects unsafe %s=%s before connecting', (name, value) => {
    expect(() => procurementPolicy({ ...environment(), [name]: value }, now)).toThrow();
  });
  it('does not alias scenario markers or accept traversal', () => {
    const env = environment();
    env.QA_EXPIRES_AT = new Date(Date.now() + 7200000).toISOString();
    expect(procurementMarker('personal-draft', env)).not.toBe(procurementMarker('business-draft', env));
    expect(() => procurementMarker('../cleanup', env)).toThrow();
  });
  it('requires exact installer metadata, expiry and acting role', () => {
    const env = environment();
    env.QA_EXPIRES_AT = new Date(Date.now() + 7200000).toISOString();
    const metadata = { qa_fixture: 'market-fit-qa-v1', qa_environment_id: env.QA_ENVIRONMENT_ID, qa_expires_at: env.QA_EXPIRES_AT, qa_role: 'buyer' };
    expect(() => assertProcurementQaOwnership(metadata, 'buyer', env)).not.toThrow();
    for (const key of ['qa_fixture', 'qa_environment_id', 'qa_expires_at', 'qa_role']) {
      expect(() => assertProcurementQaOwnership({ ...metadata, [key]: 'foreign' }, 'buyer', env)).toThrow();
    }
  });
});