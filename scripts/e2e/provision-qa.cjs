const fs = require('node:fs');
const path = require('node:path');
const { configuration, authorizeApply, options, localFetch } = require('./provision-qa-policy.cjs');
const { plan, environment } = require('./provision-qa-plan.cjs');
const { openStore } = require('./provision-qa-store.cjs');
const { schemaPreflight } = require('./provision-qa-schema.cjs');
const { seedRows, seedAuth, assetBucket } = require('./provision-qa-seed.cjs');
const { verify } = require('./provision-qa-verify.cjs');
const { adjustImages } = require('./provision-qa-adjust.cjs');
const root = path.resolve(__dirname, '../..');

function loadEnvironment(base = process.env, directory = root) {
  const dotenv = require('dotenv');
  const env = {};
  for (const name of ['.env', '.env.local']) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) Object.assign(env, dotenv.parse(fs.readFileSync(file)));
  }
  Object.assign(env, base);
  // Only local URL/key aliases; target, environment, expiry and permissions are
  // always explicit. No ambient production client or application server module.
  env.TEST_SUPABASE_URL ??= env.NEXT_PUBLIC_SUPABASE_URL;
  env.TEST_SUPABASE_ANON_KEY ??= env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  env.QA_SUPABASE_SERVICE_ROLE_KEY ??= env.SUPABASE_SERVICE_ROLE_KEY;
  return env;
}

async function provision(env, args = [], dependencies = {}) {
  const parsed = options(args);
  const config = configuration(env);
  if (parsed.apply) authorizeApply(env);
  const battery = plan(config);
  if (!parsed.apply) return { status: 'PLAN_ONLY', environmentId: config.id, authUsers: battery.users.length,
    rows: battery.rows.map(item => ({ table: item.table, id: item.row.id, kind: item.kind })),
    message: 'Offline plan only; no connections, files or mutations. This is not PASS.' };
  (dependencies.schemaPreflight || schemaPreflight)(env);
  const createClient = dependencies.createClient || require('@supabase/supabase-js').createClient;
  const makeClient = key => createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: localFetch(config.url, dependencies.fetch || globalThis.fetch) },
  });
  const store = (dependencies.openStore || openStore)(dependencies.root || root, config);
  // Invalidate prior success artifacts before any attempt: stale PASS is unsafe.
  let stage = 'artifacts';
  try {
    store.write('env.json', { QA_ENVIRONMENT_ID: config.id, QA_STATUS: 'INCOMPLETE' });
    store.write('summary.json', { status: 'INCOMPLETE', environmentId: config.id });
    const setup = makeClient(config.setupKey);
    stage = 'auth-setup';
    await seedAuth(setup, battery, store);
    stage = 'relational-setup';
    await adjustImages(config, battery, store, makeClient, env.QA_ALLOW_SMOKE_ADJUSTMENTS === '1');
    stage = 'relational-setup';
    await seedRows(setup, battery, store);
    stage = 'assets-prerequisite';
    await assetBucket(setup, store);
    stage = 'public-verification';
    const evidence = await verify(config, battery, store, makeClient, env.QA_ALLOW_SMOKE_ADJUSTMENTS === '1');
    stage = 'output';
    const values = environment(config, battery, store.state.credentials);
    values.QA_STATUS = 'VERIFIED';
    store.write('env.json', values);
    const summary = { status: 'VERIFIED', environmentId: config.id, expiresAt: config.expiresAt, ...evidence };
    store.write('summary.json', summary);
    return summary;
  } catch (error) {
    if (error instanceof Error) error.qaStage = stage;
    store.event('provision', 'failed-partial-state-retained');
    store.write('summary.json', { status: 'FAILED', stage, environmentId: config.id,
      message: 'Partial run-owned fixtures may remain. No cleanup or automatic retry. Inspect private journal before rerun.' });
    throw error;
  } finally { store.close(); }
}

async function main(args = process.argv.slice(2)) {
  const result = await provision(loadEnvironment(), args);
  console.log(JSON.stringify(result, null, 2));
}
if (require.main === module) main().catch(error => {
  // Never print arbitrary SQL, Auth, URL, key or SDK error payloads.
  const stages = ['artifacts', 'auth-setup', 'relational-setup', 'assets-prerequisite', 'public-verification', 'output'];
  const stage = stages.includes(error?.qaStage) ? error.qaStage : 'configuration-or-read-only-preflight';
  console.error(`QA provisioning refused or failed (${stage}). No success claimed; inspect configuration and private fixture journal.`);
  process.exitCode = 1;
});
module.exports = { loadEnvironment, provision, main };