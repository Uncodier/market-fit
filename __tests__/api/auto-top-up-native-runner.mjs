import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Disposable local socket-only PG. No configured database URL or credentials.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const api = resolve(root, '../API');
const bin = process.env.PG_BIN || execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
const dir = mkdtempSync('/tmp/topup-pg-');
const env = { PATH: process.env.PATH, LC_ALL: 'C', LANG: 'C' };
const data = join(dir, 'data');
const base = ['-X', '-h', dir, '-d', 'postgres', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'];
const psql = (sql) => execFileSync(join(bin, 'psql'), base, { input: sql, encoding: 'utf8', env }).trim();
const role = "SET request.jwt.claim.role='service_role';\n";
const rpc = sql => JSON.parse(psql(`${role}SELECT ${sql};`));
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
let started = false;
function asyncSql(sql, onReady) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(join(bin, 'psql'), base, { stdio: ['pipe','pipe','pipe'], env });
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; if (out.includes('LOCK_READY')) onReady?.(); });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolveResult(out.trim()) : reject(new Error(err)));
    child.stdin.end(sql);
  });
}
try {
  execFileSync(join(bin, 'initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale'], { stdio: 'pipe', env });
  try {
    execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-l', join(dir, 'server.log'), '-o', `-k ${dir} -h ''`, '-w', 'start'], { stdio: 'pipe', env });
  } catch { throw new Error(readFileSync(join(dir, 'server.log'), 'utf8')); }
  started = true;
  psql(readFileSync(join(api, 'src/lib/services/billing/__tests__/credit-fixture.sql'), 'utf8'));
  for (const file of ['20261003230000_credit_buckets_and_monthly_reset.sql',
    '20261003230001_stripe_plan_credit_reset.sql', '20261003230002_classified_credit_operations.sql',
    '20261005230000_exact_credit_accounting_precision.sql', '20261007003000_remove_signup_credit_bonus.sql',
    '20261007180000_annual_subscription_credit_periods.sql', '20261007180001_subscription_checkout_leases.sql',
    '20261008210000_preserve_canceled_subscription_credit_usage.sql']) {
    psql(readFileSync(join(api, 'supabase/migrations', file), 'utf8'));
  }
  for (const file of ['20261009030000_auto_top_up.sql', '20261009050000_auto_top_up_dispatch_safety.sql',
    '20261009060000_auto_top_up_setup_binding.sql', '20261009070000_auto_top_up_billing_card_default.sql']) psql(readFileSync(join(root, 'supabase/migrations', file), 'utf8'));
  const site = randomUUID(), actor = randomUUID();
  const customer = `cus_${randomUUID().replaceAll('-','')}`, method = `pm_${randomUUID().replaceAll('-','')}`;
  psql(`${role}INSERT INTO sites(id,user_id,name) VALUES(${quote(site)},${quote(actor)},'Offline dispatch concurrency');
    SELECT initialize_site_billing(${quote(site)});
    UPDATE billing SET stripe_customer_id=${quote(customer)} WHERE site_id=${quote(site)};`);
  const setup = rpc(`begin_credit_auto_top_up_setup(${quote(site)},${quote(actor)})`);
  rpc(`complete_credit_auto_top_up_setup(${quote(site)},${quote(setup.token)},${quote(customer)},${quote(method)})`);
  const config = enabled => `set_credit_auto_top_up_settings(${quote(site)},${enabled},5,20,10000,${quote(actor)})`;
  rpc(config(true));
  let claim = rpc(`begin_credit_auto_top_up_attempt(${quote(site)})`);
  const auth = () => `authorize_credit_auto_top_up_dispatch(${quote(site)},${quote(claim.attempt_id)},${quote(claim.claim_token)})`;
  let releaseReady;
  const ready = new Promise(resolveReady => { releaseReady = resolveReady; });
  const disabling = asyncSql(`${role}BEGIN; SELECT ${config(false)};\n\\echo LOCK_READY\nSELECT pg_sleep(0.4); COMMIT;`, releaseReady);
  await ready;
  const waitingDispatch = asyncSql(`${role}SELECT ${auth()};`);
  await disabling;
  assert.equal(JSON.parse(await waitingDispatch).outcome, 'not_authorized');
  assert.equal(psql(`SELECT count(*) FROM credit_auto_top_up_attempts WHERE dispatch_started_at IS NOT NULL`), '0');
  console.log('PASS disable holding billing lock prevents waiting dispatch');

  rpc(config(true));
  claim = rpc(`begin_credit_auto_top_up_attempt(${quote(site)})`);
  const replies = await Promise.all(Array.from({length: 4}, () => asyncSql(`${role}SELECT ${auth()};`)));
  assert.equal(replies.map(JSON.parse).filter(r => r.outcome === 'authorized').length, 1);
  assert.equal(psql(`SELECT count(*) FROM credit_auto_top_up_attempts WHERE dispatch_started_at IS NOT NULL`), '1');
  console.log('PASS four independent PostgreSQL connections dispatch at most once');
  rpc(config(false));
  assert.equal(rpc(`begin_credit_auto_top_up_attempt(${quote(site)})`).outcome, 'needs_reconciliation');
  assert.equal(rpc(auth()).outcome, 'not_authorized');
  assert.equal(psql(`SELECT count(*) FROM payments WHERE transaction_type='credits_purchase'`), '0');
  console.log('PASS disable after dispatch preserves unknown payment without re-dispatch');
} finally {
  if (started) execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe', env });
  rmSync(dir, { recursive: true, force: true });
}
