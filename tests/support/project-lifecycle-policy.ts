import { readEnvironment, required, requiredUuid } from './environment';

type Environment = Record<string, string | undefined>;
export type OwnedProject = { id: string; name: string; url: string; user_id: string };

/** Narrow exception: never grants authority to regression/agent mutation helpers. */
export function projectLifecyclePolicy(env: Environment = process.env) {
  const environment = readEnvironment(env);
  if (environment.suite !== 'project-lifecycle') throw new Error('Project lifecycle requires its isolated suite');
  if (env.TEST_ALLOW_PROJECT_LIFECYCLE !== '1') {
    throw new Error('Project creation/archival requires TEST_ALLOW_PROJECT_LIFECYCLE=1');
  }
  const runId = required(env, 'SHIPLIGHT_RUN_ID');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(runId) || runId === 'latest' || runId === 'discovery') {
    throw new Error('Project lifecycle requires a unique explicit run ID');
  }
  const backend = new URL(required(env, 'TEST_SUPABASE_URL'));
  if (backend.username || backend.password || backend.search || backend.hash || backend.pathname !== '/') {
    throw new Error('TEST_SUPABASE_URL must be a canonical origin');
  }
  if (environment.target === 'local') {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(backend.hostname) || !['http:', 'https:'].includes(backend.protocol)) {
      throw new Error('Local project lifecycle requires a loopback backend');
    }
  } else {
    const ref = required(env, 'TEST_SUPABASE_PROJECT_REF');
    if (!/^[a-z0-9]{20}$/.test(ref) || backend.origin !== `https://${ref}.supabase.co`) {
      throw new Error('Project lifecycle requires the explicitly selected Supabase backend');
    }
  }
  const key = required(env, 'TEST_SUPABASE_ANON_KEY');
  if (!key.startsWith('sb_publishable_')) {
    let role: unknown;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* rejected below */ }
    if (role !== 'anon') throw new Error('Project lifecycle requires a public anon key, never service role');
  }
  const marker = `Shiplight Lifecycle ${runId}`;
  // No customer domain, DNS configuration, paid checkout or channel connection.
  const url = `https://${runId.toLowerCase().replace(/_/g, '-').slice(0, 50)}.example.invalid`;
  return { ...environment, backend: backend.origin, key, marker, url };
}

export function assertOwnedProject(project: OwnedProject, userId: string, env: Environment = process.env): void {
  const policy = projectLifecyclePolicy(env);
  requiredUuid({ ID: project.id }, 'ID');
  if (project.id === policy.siteId || project.user_id !== userId || project.name !== policy.marker || project.url !== policy.url) {
    throw new Error('Refusing archival: project is not the exact run-owned creation');
  }
}

export function boundSessionToken(cookies: { name: string; value: string }[], backend: string): string {
  const prefixes = [`sb-${new URL(backend).hostname.split('.')[0]}-auth-token`, 'sb-db-auth-token'];
  for (const prefix of prefixes) {
    const chunks = cookies.filter(cookie => cookie.name === prefix || cookie.name.startsWith(`${prefix}.`))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!chunks.length) continue;
    try {
      const raw = chunks.map(cookie => cookie.value).join('');
      const token = JSON.parse(raw.startsWith('base64-') ? Buffer.from(raw.slice(7), 'base64url').toString() : raw).access_token;
      const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      if (new URL(claims.iss).origin === backend) return token;
    } catch { /* No token or cookie contents may escape this helper. */ }
  }
  throw new Error('Unable to bind project lifecycle to the configured browser session/backend');
}