const { spawnSync } = require('node:child_process');

// Read-only preflight, never migrations or SQL mutations. The supplied URL must
// reach the same isolated bootstrap behind TEST_SUPABASE_URL (operator contract).
const sql = `BEGIN READ ONLY;
SELECT pg_get_functiondef('public.dispatch_workflow_database_webhook()'::regprocedure);
SELECT 'QA_RLS=' || count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relrowsecurity AND c.relname IN
('sites','site_members','settings','catalog_items','content','leads','agents','campaigns','accounting_accounts');
ROLLBACK;`;

function schemaPreflight(env, run = spawnSync) {
  let result;
  if (env.QA_DATABASE_URL) {
    let url;
    try { url = new URL(env.QA_DATABASE_URL); } catch { throw new Error('Invalid QA_DATABASE_URL'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.search || url.hash) throw new Error('QA_DATABASE_URL must target loopback PostgreSQL');
    result = run('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
      encoding: 'utf8', timeout: 15000, env: { ...process.env, PGDATABASE: env.QA_DATABASE_URL, PGOPTIONS: '-c default_transaction_read_only=on' },
    });
  } else if (env.QA_DB_CONTAINER && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(env.QA_DB_CONTAINER)) {
    // Pin the local Docker socket; ignore remote DOCKER_HOST/context overrides.
    result = run('docker', ['--host', 'unix:///var/run/docker.sock', 'exec', env.QA_DB_CONTAINER,
      'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', timeout: 15000 });
  } else throw new Error('Apply requires QA_DATABASE_URL or QA_DB_CONTAINER for read-only bootstrap guard inspection');
  if (result.error || result.status !== 0) throw new Error('Read-only schema preflight failed; no provider output printed');
  const output = result.stdout || '';
  if (!output.includes('QA_RLS=9') || !output.includes('QA workflow webhook rejected: non-local destination')
    || !output.includes("webhook_url !~ '^http://(127[.]0[.]0[.]1|localhost|host[.]docker[.]internal):[0-9]+/'")) {
    throw new Error('Expected QA bootstrap RLS/webhook guard absent; mutations refused');
  }
}

module.exports = { schemaPreflight, sql };