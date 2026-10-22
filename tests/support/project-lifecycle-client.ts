import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { projectLifecyclePolicy, assertOwnedProject, boundSessionToken, type OwnedProject } from './project-lifecycle-policy';

/** Read-only RLS client using the very same session/backend as the browser. */
export async function projectLifecycleClient(page: Page) {
  const policy = projectLifecyclePolicy();
  const token = boundSessionToken(await page.context().cookies(policy.baseURL), policy.backend);
  const client = createClient(policy.backend, policy.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const auth = await client.auth.getUser(token);
  if (auth.error || !auth.data.user || auth.data.user.email?.toLowerCase() !== process.env.TEST_ADMIN_EMAIL?.toLowerCase()) {
    throw new Error('Project lifecycle browser account does not match the configured admin');
  }
  const fixture = await client.from('sites').select('id,name').eq('id', policy.siteId).single();
  if (fixture.error || fixture.data?.name !== policy.siteName) throw new Error('Configured reference workspace does not match');
  return { client, userId: auth.data.user.id, policy };
}

export async function findOwnedProject(client: SupabaseClient, userId: string): Promise<OwnedProject | null> {
  const { marker, url } = projectLifecyclePolicy();
  const result = await client.from('sites').select('id,name,url,user_id')
    .eq('user_id', userId).eq('name', marker).eq('url', url);
  if (result.error || !result.data || result.data.length > 1) throw new Error('Unable to uniquely resolve run-owned project');
  if (!result.data.length) return null;
  const project = result.data[0] as OwnedProject;
  assertOwnedProject(project, userId);
  return project;
}

export async function projectIsActive(client: SupabaseClient, project: OwnedProject, userId: string): Promise<boolean> {
  assertOwnedProject(project, userId);
  const result = await client.from('sites').select('id,name,url,user_id').eq('id', project.id);
  if (result.error || !result.data || result.data.length > 1) throw new Error('Unable to verify project visibility under RLS');
  if (!result.data.length) return false;
  assertOwnedProject(result.data[0] as OwnedProject, userId);
  return true;
}