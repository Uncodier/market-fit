const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createHash, randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('dotenv');
const { MARKER, fixtureId } = require('./cases.cjs');
const root = path.resolve(__dirname, '../..');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function config(overrides = process.env) {
  const local = parse(fs.readFileSync(path.join(root, '.env.local')));
  const apiRoot = path.resolve(root, '../API');
  const api = fs.existsSync(path.join(apiRoot, '.env.local')) ? parse(fs.readFileSync(path.join(apiRoot, '.env.local'))) : {};
  const env = { ...local, ...overrides };
  let linked = {};
  if (fs.existsSync(path.join(apiRoot, '.vercel/project.json'))) linked = JSON.parse(fs.readFileSync(path.join(apiRoot, '.vercel/project.json'), 'utf8'));
  const required = name => { if (!env[name]) throw new Error(`Missing ${name}`); return env[name]; };
  const url = new URL(required('TEST_SUPABASE_URL'));
  if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid test backend');
  if (url.hostname !== `${required('TEST_SUPABASE_PROJECT_REF')}.supabase.co`) throw new Error('Test project mismatch');
  if (env.TEST_TARGET !== 'production' || env.TEST_BASE_URL !== 'https://app.makinari.com') throw new Error('This isolated canary requires the explicit production target');
  if (!UUID.test(required('TEST_SITE_ID'))) throw new Error('Invalid test site');
  const key = required('TEST_SUPABASE_ANON_KEY');
  // Never send a sibling project's observer credential to a different backend.
  if (new URL(api.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL).origin !== url.origin) throw new Error('Observer backend mismatch');
  const observerKey = api.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!observerKey) throw new Error('Server-only observation credential is required');
  const secrets = [required('TEST_ADMIN_EMAIL'), required('TEST_ADMIN_PASSWORD'), key, observerKey,
    ...Object.entries(env).filter(([k]) => /TOKEN|PASSWORD|SECRET|KEY/.test(k)).map(([, v]) => v),
    ...Object.entries(api).filter(([k]) => /TOKEN|PASSWORD|SECRET|KEY/.test(k)).map(([, v]) => v)].filter(Boolean);
  return { url: url.origin, key, observerKey, email: env.TEST_ADMIN_EMAIL, password: env.TEST_ADMIN_PASSWORD,
    siteId: env.TEST_SITE_ID, siteName: required('TEST_SITE_NAME'), apiRoot,
    deployedSha: /^[a-f0-9]{40}$/i.test(env.HARNESS_E2E_DEPLOYED_SHA || '') ? env.HARNESS_E2E_DEPLOYED_SHA : null,
    credentials: { token: env.HARNESS_E2E_SANDBOX_TOKEN || api.VERCEL_TOKEN || api.VERCEL_ACCESS_TOKEN || api.VERCEL_API_TOKEN,
      teamId: env.HARNESS_E2E_SANDBOX_TEAM_ID || api.VERCEL_TEAM_ID || linked.orgId,
      projectId: env.HARNESS_E2E_SANDBOX_PROJECT_ID || api.VERCEL_PROJECT_ID || linked.projectId },
    redact: text => {
      let value = String(text);
      for (const secret of secrets.sort((a, b) => b.length - a.length)) value = value.split(secret).join('[REDACTED]');
      return value.replace(/(Bearer\s+)[^\s"\\]+/gi, '$1[REDACTED]')
        .replace(/(https?:\/\/)[^\s/@]+@/gi, '$1[REDACTED]@')
        .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[REDACTED]')
        .replace(/((?:password|secret|token|api_key)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
    } };
}
async function connect(settings) {
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, init) => fetch(url, { ...init, redirect: 'error', signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(15000)]) }) } };
  const client = createClient(settings.url, settings.key, options);
  const auth = await client.auth.signInWithPassword({ email: settings.email, password: settings.password });
  if (auth.error || !auth.data.user) throw new Error('Test account authentication failed');
  const userId = auth.data.user.id;
  const site = await client.from('sites').select('id,name,user_id,archived_at').eq('id', settings.siteId).eq('name', settings.siteName).maybeSingle();
  if (site.error || !site.data || site.data.archived_at) throw new Error('Exact active test site not found');
  if (site.data.user_id !== userId) {
    const member = await client.from('site_members').select('role,status').eq('site_id', settings.siteId).eq('user_id', userId).maybeSingle();
    if (member.error || member.data?.role !== 'admin' || member.data?.status !== 'active') throw new Error('Test account must be owner or active administrator');
  }
  return { client, userId, observer: createClient(settings.url, settings.observerKey, options) };
}
function paths(id) {
  fixtureId(id, 'validate');
  const dir = path.join(root, 'agent-test-reports', 'harness', id);
  return { dir, manifest: path.join(dir, 'run.json'), report: path.join(dir, 'report.json'), observations: path.join(dir, 'observations.json'), lock: path.join(dir, '.lock') };
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  fs.renameSync(temporary, file);
}
function lock(p) {
  fs.mkdirSync(p.dir, { recursive: true, mode: 0o700 });
  const fd = fs.openSync(p.lock, 'wx', 0o600); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
  return () => fs.unlinkSync(p.lock);
}
function assertRun(run, settings, userId) {
  if (run.marker !== MARKER || run.siteId !== settings.siteId || run.userId !== userId || run.backend !== settings.url || run.cases?.length !== 5) throw new Error('Manifest scope mismatch');
  for (const spec of run.cases) if (spec.requirementId !== fixtureId(run.id, spec.id) || spec.instanceId !== fixtureId(run.id, `${spec.id}:instance`)) throw new Error('Manifest fixture identity mismatch');
}
function fileReader(settings) {
  return async (session, spec) => {
    const result = Object.fromEntries(Object.keys(spec.files).map(p => [p, { state: 'unavailable' }]));
    if (!session.workspace?.id || session.workspace.root !== '/vercel/sandbox' ||
      !settings.credentials.token || !settings.credentials.teamId || !settings.credentials.projectId) return result;
    try {
      const { Sandbox } = createRequire(path.join(settings.apiRoot, 'package.json'))('@vercel/sandbox');
      const vm = await Sandbox.get({ name: session.workspace.id, resume: false, ...settings.credentials, signal: AbortSignal.timeout(15000) });
      if (vm.tags?.harnessSession !== session.id || vm.status !== 'running') return result;
      for (const p of Object.keys(spec.files)) {
        // Fixed test paths only; no paths from model output or arbitrary shell execution. Persist hashes, never content.
        if (!/^\.harness-e2e\/[a-z0-9-]{8,80}\/[a-z.]+$/.test(p)) continue;
        const stream = await vm.readFile({ path: `/vercel/sandbox/${p}` }, { signal: AbortSignal.timeout(10000) });
        if (!stream) { result[p] = { state: 'missing' }; continue; }
        const hash = createHash('sha256'); let bytes = 0;
        try {
          for await (const chunk of stream) {
            bytes += Buffer.byteLength(chunk); if (bytes > 8192) { stream.destroy(); throw new Error('File too large'); }
            hash.update(chunk);
          }
          result[p] = { state: 'read', sha256: hash.digest('hex'), bytes };
        } catch { result[p] = { state: 'unavailable' }; }
      }
    } catch { /* No resume, command dispatch, stop, provider retry or raw error logging. */ }
    return result;
  };
}
module.exports = { root, config, connect, paths, write, lock, assertRun, fileReader };