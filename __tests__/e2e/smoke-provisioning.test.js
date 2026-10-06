/** @jest-environment node */
import { fixtureId, fixturePlan, parseOptions, assertFixture, resolveSite,
  inspectFixtures, insertMissing, environmentValues, connect } from '../../scripts/e2e/smoke-fixtures.cjs';
import { mergeEnv } from '../../scripts/e2e/provision-smoke.cjs';
import dotenv from 'dotenv';

const siteId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const plan = fixturePlan(siteId, userId);

function queryClient(responses) {
  const query = {};
  for (const method of ['select', 'eq', 'single']) query[method] = jest.fn(() => query);
  query.then = (resolve, reject) => Promise.resolve(responses.shift()).then(resolve, reject);
  query.insert = jest.fn(() => query);
  return { from: jest.fn(() => query), query };
}

describe('explicit production smoke fixture provisioning', () => {
  it('defaults to no inserts and requires exact site plus webhook acknowledgment', () => {
    expect(parseOptions([])).toMatchObject({ apply: false, writeEnv: false });
    expect(parseOptions(['--write-env']).apply).toBe(false);
    expect(() => parseOptions(['--apply'])).toThrow('workflows');
    expect(() => parseOptions(['--apply', '--site-id', siteId])).toThrow('workflows');
    expect(parseOptions(['--apply', '--site-id', siteId, '--ack-workflows']).apply).toBe(true);
  });
  it.each([['--delete'], ['--reset'], ['--apply', '--apply'], ['--site-id', 'demo-1']])('rejects unsafe args %j', (...args) => {
    expect(() => parseOptions(args)).toThrow();
  });
  it('uses stable, distinct UUIDs scoped to site and fixture type', () => {
    expect(fixtureId(siteId, 'content')).toBe(fixtureId(siteId, 'content'));
    expect(new Set(plan.map(f => f.row.id)).size).toBe(3);
    expect(fixtureId(siteId, 'content')).not.toBe(fixtureId(userId, 'content'));
    expect(() => fixtureId('demo-1', 'content')).toThrow('UUID');
  });
  it('creates draft content, a contactless lead and a listed but not purchasable product', () => {
    expect(plan[0].row).toMatchObject({ status: 'draft', site_id: siteId, user_id: userId });
    expect(plan[1].row).toMatchObject({ email: null, phone: null, do_not_call: true, voice_call_consent_status: 'revoked' });
    expect(plan[2].row).toMatchObject({ is_marketplace_listed: true, is_purchasable: false, is_pos_available: false,
      is_recurring: false, is_reservation: false, parent_id: null });
  });
  it('refuses to overwrite altered fixtures or rows with no ownership marker', () => {
    expect(() => assertFixture(plan[0].row, plan[0].row)).not.toThrow();
    expect(() => assertFixture({ ...plan[0].row, metadata: {} }, plan[0].row)).toThrow('overwrite');
    expect(() => assertFixture({ ...plan[2].row, is_purchasable: true }, plan[2].row)).toThrow('overwrite');
  });
  it('requires exactly one non-archived authorized site and honors the acknowledged UUID', async () => {
    const site = { id: siteId, name: 'QA Site', user_id: userId, archived_at: null };
    const env = { TEST_SITE_NAME: site.name };
    await expect(resolveSite(queryClient([{ data: [site] }]), userId, env)).resolves.toEqual(site);
    await expect(resolveSite(queryClient([{ data: [site, site] }]), userId, env)).rejects.toThrow('exactly once');
    await expect(resolveSite(queryClient([{ data: [{ ...site, archived_at: '2026-01-01' }] }]), userId, env)).rejects.toThrow('Archived');
    await expect(resolveSite(queryClient([{ data: [site] }]), userId, env, userId)).rejects.toThrow('does not match');
    await expect(resolveSite(queryClient([{ data: [site] }, { data: { role: 'collaborator', status: 'active' } }]), siteId, env)).rejects.toThrow('admin');
    await expect(resolveSite(queryClient([{ data: [site] }, { data: { role: 'admin', status: 'pending' } }]), siteId, env)).rejects.toThrow('admin');
  });
  it('rejects fixture-name collisions before any insertion', async () => {
    const client = queryClient([{ data: [] }, { data: [{ id: userId }] }]);
    await expect(inspectFixtures(client, plan)).rejects.toThrow('collision');
    expect(client.query.insert).not.toHaveBeenCalled();
  });
  it('reuses verified fixtures without inserting or updating them', async () => {
    const client = queryClient(plan.flatMap(f => [{ data: [f.row] }, { data: [{ id: f.row.id }] }]));
    await expect(insertMissing(client, plan.map(f => ({ ...f, exists: true })))).resolves.toBeUndefined();
    expect(client.query.insert).not.toHaveBeenCalled();
    expect(client.query.eq).toHaveBeenCalledWith('site_id', siteId);
  });
  it('does not retry or automatically delete after an ambiguous insert failure', async () => {
    const client = queryClient([{ error: { code: '42501' } }]);
    await expect(insertMissing(client, plan.map(f => ({ ...f, exists: false })))).rejects.toThrow('no automatic delete or retry');
    expect(client.query.insert).toHaveBeenCalledTimes(1);
  });
  it('inserts only missing scoped rows and verifies persisted state', async () => {
    const client = queryClient([
      ...plan.map(f => ({ data: f.row })),
      ...plan.flatMap(f => [{ data: [f.row] }, { data: [{ id: f.row.id }] }]),
    ]);
    await insertMissing(client, plan.map(f => ({ ...f, exists: false })));
    expect(client.query.insert).toHaveBeenCalledTimes(3);
    for (const fixture of plan) expect(client.query.insert).toHaveBeenCalledWith(fixture.row);
  });
  it('forbids service-role keys and backend mismatch before authentication', async () => {
    const env = { TEST_TARGET: 'production', TEST_BASE_URL: 'https://app.makinari.com',
      TEST_COMMERCE_BASE_URL: 'https://www.makinari.com', TEST_SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
      TEST_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
      TEST_SUPABASE_ANON_KEY: `a.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.c` };
    await expect(connect(env)).rejects.toThrow('service-role');
    await expect(connect({ ...env, NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co' })).rejects.toThrow('backend');
  });
  it('uses UUID shop routing and never invents buyer credentials or deployment evidence', () => {
    const values = environmentValues({ id: siteId, name: 'QA Site' });
    expect(values.TEST_SHOP_SLUG).toBe(siteId);
    expect(values.TEST_CATALOG_ITEM_ID).toBe(plan[2].row.id);
    expect(values.TEST_ALLOW_MUTATIONS).toBe('0');
    expect(values).not.toHaveProperty('TEST_BUYER_PASSWORD');
    expect(values).not.toHaveProperty('TEST_DEPLOYED_SHA');
  });
  it('preserves unrelated secrets/comments, replaces duplicate keys and round-trips names', () => {
    const original = '# Keep me\nOTHER_SECRET=unchanged\nTEST_SITE_NAME=old\nexport TEST_SITE_NAME=duplicate\n';
    const merged = mergeEnv(original, { TEST_SITE_NAME: 'QA "Store" #1', TEST_SITE_ID: siteId });
    expect(merged).toContain('# Keep me');
    expect(merged).toContain('OTHER_SECRET=unchanged');
    expect(merged.match(/TEST_SITE_NAME=/g)).toHaveLength(1);
    expect(dotenv.parse(merged).TEST_SITE_NAME).toBe('QA "Store" #1');
    expect(() => mergeEnv(original, { TEST_SITE_NAME: 'QA\nINJECTED=1' })).toThrow('Multiline');
  });
});