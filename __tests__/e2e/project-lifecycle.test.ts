/** @jest-environment node */
import fs from 'node:fs';
import { readEnvironment, assertDisposable } from '../../tests/support/environment';
import { assertOwnedProject, projectLifecyclePolicy, boundSessionToken } from '../../tests/support/project-lifecycle-policy';
import { requireMutationEnvironment } from '../../tests/support/mutation-safety';

const env = {
  TEST_TARGET: 'production', TEST_SUITE: 'project-lifecycle',
  TEST_BASE_URL: 'https://app.makinari.com', TEST_COMMERCE_BASE_URL: 'https://www.makinari.com',
  TEST_SITE_ID: '11111111-1111-4111-8111-111111111111', TEST_SITE_NAME: 'Reference fixture',
  TEST_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', TEST_SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
  TEST_SUPABASE_ANON_KEY: 'sb_publishable_testonly', TEST_ALLOW_PROJECT_LIFECYCLE: '1',
  SHIPLIGHT_RUN_ID: 'lifecycle-test-123',
};
const project = { id: '22222222-2222-4222-8222-222222222222', name: 'Shiplight Lifecycle lifecycle-test-123',
  url: 'https://lifecycle-test-123.example.invalid', user_id: 'owner-test' };

it('permits only an explicitly acknowledged isolated project lifecycle suite', () => {
  expect(projectLifecyclePolicy(env).marker).toBe(project.name);
  expect(() => projectLifecyclePolicy({ ...env, TEST_ALLOW_PROJECT_LIFECYCLE: '' })).toThrow('TEST_ALLOW_PROJECT_LIFECYCLE');
  expect(() => projectLifecyclePolicy({ ...env, TEST_SUITE: 'smoke' })).toThrow('isolated suite');
});
it.each(['latest', 'discovery', '../escape', '', 'a'.repeat(101)])('rejects unsafe run ID %s', id => {
  expect(() => projectLifecyclePolicy({ ...env, SHIPLIGHT_RUN_ID: id })).toThrow();
});
it.each(['https://otherbackendprojectx.supabase.co', 'http://abcdefghijklmnopqrst.supabase.co',
  'https://secret@abcdefghijklmnopqrst.supabase.co', 'https://abcdefghijklmnopqrst.supabase.co/path'])('rejects mismatched/unsafe backend %s', url => {
  expect(() => projectLifecyclePolicy({ ...env, TEST_SUPABASE_URL: url })).toThrow();
});
it('rejects privileged database keys', () => {
  const key = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  expect(() => projectLifecyclePolicy({ ...env, TEST_SUPABASE_ANON_KEY: key })).toThrow('public anon key');
});
it('requires a loopback backend for local execution', () => {
  expect(() => projectLifecyclePolicy({ ...env, TEST_TARGET: 'local', TEST_BASE_URL: 'http://localhost:3000',
    TEST_COMMERCE_BASE_URL: 'http://localhost:3000' })).toThrow('loopback backend');
});
it('never authorizes ordinary production CRUD, role boundaries or agent mutations', () => {
  for (const suite of ['regression', 'roles']) {
    expect(() => readEnvironment({ ...env, TEST_SUITE: suite, TEST_ALLOW_MUTATIONS: '1', TEST_DISPOSABLE_ENVIRONMENT: '1' }))
      .toThrow('forbidden in production');
  }
  expect(() => requireMutationEnvironment(env)).toThrow('forbidden in production');
  expect(() => assertDisposable(env)).toThrow('forbidden in production');
});
it('requires exact persisted ownership, ID, run marker and reserved URL before archival', () => {
  expect(() => assertOwnedProject(project, 'owner-test', env)).not.toThrow();
  for (const altered of [{ ...project, id: env.TEST_SITE_ID }, { ...project, id: 'demo-test' },
    { ...project, name: 'Existing customer project' }, { ...project, user_id: 'foreign-user' },
    { ...project, url: 'https://customer.example.com' }]) {
    expect(() => assertOwnedProject(altered, 'owner-test', env)).toThrow();
  }
});
it('binds chunked proxy-named cookies by verified JWT issuer, not cookie naming alone', () => {
  const token = `header.${Buffer.from(JSON.stringify({ iss: `${env.TEST_SUPABASE_URL}/auth/v1` })).toString('base64url')}.signature`;
  const raw = `base64-${Buffer.from(JSON.stringify({ access_token: token })).toString('base64url')}`;
  const cookies = [{ name: 'sb-db-auth-token.1', value: raw.slice(25) }, { name: 'sb-db-auth-token.0', value: raw.slice(0, 25) }];
  expect(boundSessionToken(cookies, env.TEST_SUPABASE_URL)).toBe(token);
  expect(() => boundSessionToken(cookies, 'https://otherbackendprojectx.supabase.co')).toThrow('Unable to bind');
  expect(() => boundSessionToken([{ name: 'sb-db-auth-token', value: 'malformed' }], env.TEST_SUPABASE_URL)).toThrow('Unable to bind');
});
it('keeps the lifecycle native test out of broad YAML transpilation and protects password artifacts', async () => {
  const { sources } = await import('../../scripts/e2e/run.cjs');
  expect(sources('project-lifecycle')).toEqual([]);
  const config = fs.readFileSync('playwright.config.ts', 'utf8');
  expect(config).toContain("const privateLifecycle = suite === 'project-lifecycle' || suite === 'account-lifecycle'");
  expect(config).toContain("video: privateLifecycle ? 'off' : 'retain-on-failure'");
  expect(config).toContain("trace: privateLifecycle ? 'off' : 'retain-on-failure'");
  expect(config).toContain("screenshot: privateLifecycle ? 'off' : 'only-on-failure'");
  const source = fs.readFileSync('tests/projects/lifecycle.spec.ts', 'utf8');
  expect(source).not.toMatch(/\.delete\(|service_role|waitForTimeout|force: true/);
});