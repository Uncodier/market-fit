import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readEnvironment, required, requiredUuid } from '../support/environment';
import { fixtureConnection } from '../support/mutation-safety';

const roles = ['ADMIN', 'COLLABORATOR', 'MARKETING', 'FOREIGN'] as const;
type Role = typeof roles[number];
const clients = new Map<Role, SupabaseClient>();
// These API/DB checks intentionally do not produce traces containing auth payloads.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test.beforeAll(async () => {
  readEnvironment();
  const connection = fixtureConnection();
  const identities = new Set<string>();
  for (const role of roles) {
    const client = createClient(connection.url, connection.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: required(process.env, `TEST_${role}_EMAIL`),
      password: required(process.env, `TEST_${role}_PASSWORD`),
    });
    expect(error?.code, `Dedicated ${role} fixture must authenticate`).toBeUndefined();
    expect(data.user?.id).toBeTruthy();
    identities.add(data.user!.id);
    clients.set(role, client);
  }
  expect(identities.size, 'Permission tests require four genuinely different users').toBe(4);
});

test.afterAll(async () => {
  await Promise.all([...clients.values()].map(client => client.auth.signOut({ scope: 'local' })));
});

for (const role of roles) {
  test(`${role.toLowerCase()} has exactly its intended database capabilities`, async () => {
    const { siteId } = readEnvironment();
    const client = clients.get(role)!;
    const { data: actualRole, error: roleError } = await client.rpc('current_user_site_role', { p_site_id: siteId });
    expect(roleError).toBeNull();
    if (role === 'ADMIN') expect(['owner', 'admin']).toContain(actualRole);
    else expect(actualRole).toBe(role === 'FOREIGN' ? null : role.toLowerCase());
    for (const command of ['select', 'insert', 'update', 'delete']) {
      const { data, error } = await client.rpc('user_can', { p_site_id: siteId, p_command: command });
      expect(error).toBeNull();
      const allowed = role === 'ADMIN' || (role === 'COLLABORATOR' && command !== 'delete') || (role === 'MARKETING' && command === 'select');
      expect(data, `${role} ${command}`).toBe(allowed);
    }
  });
}

test('live RLS hides an existing foreign site in both directions', async () => {
  const { siteId } = readEnvironment();
  const foreignSiteId = requiredUuid(process.env, 'TEST_FOREIGN_SITE_ID');
  for (const [role, own, foreign] of [['ADMIN', siteId, foreignSiteId], ['FOREIGN', foreignSiteId, siteId]] as const) {
    const client = clients.get(role)!;
    const ownResult = await client.from('sites').select('id').eq('id', own);
    expect(ownResult.error).toBeNull();
    expect(ownResult.data).toEqual([{ id: own }]);
    const foreignResult = await client.from('sites').select('id').eq('id', foreign);
    expect(foreignResult.error).toBeNull();
    expect(foreignResult.data, 'An empty result is meaningful only after proving the foreign fixture exists').toEqual([]);
  }
});

test('private analytics denies anonymous callers before returning tenant data', async ({ request }) => {
  const { baseURL, siteId } = readEnvironment();
  const date = new Date().toISOString().slice(0, 10);
  const query = new URLSearchParams({ siteId, startDate: date, endDate: date });
  const response = await request.get(`${baseURL}/api/revenue?${query}`, { maxRedirects: 0 });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body).not.toHaveProperty('totalSales');
});

test('the retired cron status endpoint is unavailable', async ({ request }) => {
  const { baseURL, siteId } = readEnvironment();
  const response = await request.get(`${baseURL}/api/cron-status?siteId=${siteId}`, { maxRedirects: 0 });
  // Next.js can return an HTML 404 after route deletion; do not require a JSON API.
  expect(response.status()).toBe(404);
  const body = await response.text();
  expect(body).not.toContain('"availableSiteIds"');
});