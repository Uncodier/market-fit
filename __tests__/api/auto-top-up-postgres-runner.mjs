import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Disposable, in-process PostgreSQL. Never read database URLs or credentials.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const api = resolve(process.argv[2] || resolve(root, '../API'));
const { PGlite } = createRequire(resolve(api, 'package.json'))('@electric-sql/pglite');
const db = new PGlite();
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const rpc = async (name, params) => (await one(
  `SELECT public.${name}(${params.map((_, i) => `$${i + 1}`).join(',')}) result`, params,
)).result;
const stripeId = prefix => `${prefix}_${randomUUID().replaceAll('-', '')}`;
const attempt = id => one('SELECT * FROM credit_auto_top_up_attempts WHERE id=$1', [id]);
const settings = site => one('SELECT * FROM credit_auto_top_up_settings WHERE site_id=$1', [site]);
const begin = account => rpc('begin_credit_auto_top_up_attempt', [account.site]);
const authorize = (account, claim) => rpc('authorize_credit_auto_top_up_dispatch',
  [account.site, claim.attempt_id, claim.claim_token]);
const candidates = async () => (await db.query('SELECT * FROM list_credit_auto_top_up_candidates(100)')).rows.map(r => r.site_id);
const expire = claim => db.query(`UPDATE credit_auto_top_up_attempts
  SET claim_expires_at=clock_timestamp()-interval '1 minute' WHERE id=$1`, [claim.attempt_id]);
const configure = (account, values = {}) => rpc('set_credit_auto_top_up_settings', [account.site,
  values.enabled ?? true, values.minimum ?? 5, values.target ?? 20, values.cap ?? 4000, account.actor,
  null, values.state ?? 'ready']);
async function account({ legacy = false, cap = 4000 } = {}) {
  const value = { site: randomUUID(), actor: randomUUID(), customer: stripeId('cus'), method: stripeId('pm') };
  await db.query("INSERT INTO sites(id,name,user_id) VALUES($1,'Synthetic dispatch safety',$2)", [value.site, value.actor]);
  await rpc('initialize_site_billing', [value.site]);
  await db.query('UPDATE billing SET stripe_customer_id=$2 WHERE site_id=$1', [value.site, value.customer]);
  await rpc('deduct_credits', [value.site, 1, 'usage', 'Synthetic consumption', {}]);
  await rpc('attach_credit_auto_top_up_payment_method', [value.site, value.method, value.customer]);
  if (legacy) await rpc('set_credit_auto_top_up_settings', [value.site, true, 5, 20, cap, null, 'ready']);
  else await configure(value, { cap });
  return value;
}
async function savedIntent(value, claim, intent = stripeId('pi')) {
  assert.equal((await rpc('record_credit_auto_top_up_intent',
    [value.site, claim.attempt_id, claim.claim_token, intent])).outcome, 'recorded');
  return intent;
}
const complete = (value, claim, intent) => rpc('complete_credit_auto_top_up_attempt',
  [value.site, claim.attempt_id, claim.claim_token, intent, value.customer, claim.amount_cents, 'usd']);
async function noFinancialEffects(value) {
  assert.equal((await one(`SELECT count(*)::integer n FROM payments
    WHERE site_id=$1 AND transaction_type='credits_purchase'`, [value.site])).n, 0);
  assert.equal(Number((await one('SELECT purchased_credits_available n FROM billing WHERE site_id=$1', [value.site])).n), 0);
}
let passed = 0;
const test = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
try {
  await db.exec(readFileSync(resolve(api, 'src/lib/services/billing/__tests__/credit-fixture.sql'), 'utf8'));
  for (const file of [
    '20261003230000_credit_buckets_and_monthly_reset.sql',
    '20261003230001_stripe_plan_credit_reset.sql',
    '20261003230002_classified_credit_operations.sql',
    '20261005230000_exact_credit_accounting_precision.sql',
    '20261007003000_remove_signup_credit_bonus.sql',
    '20261007180000_annual_subscription_credit_periods.sql',
    '20261007180001_subscription_checkout_leases.sql',
    '20261008210000_preserve_canceled_subscription_credit_usage.sql',
  ]) await db.exec(readFileSync(resolve(api, 'supabase/migrations', file), 'utf8'));
  await db.exec("SET request.jwt.claim.role='service_role'");
  await db.exec(readFileSync(resolve(root, 'supabase/migrations/20261009030000_auto_top_up.sql'), 'utf8'));
  const old = await account({ legacy: true }), oldClaim = await begin(old);
  const oldSaved = await account({ legacy: true }), oldSavedClaim = await begin(oldSaved);
  await savedIntent(oldSaved, oldSavedClaim);
  await expire(oldSavedClaim);
  await db.exec(readFileSync(resolve(root, 'supabase/migrations/20261009050000_auto_top_up_dispatch_safety.sql'), 'utf8'));

  await test('forward rollout quarantines legacy unknown dispatches and recovers saved IDs', async () => {
    const row = await attempt(oldClaim.attempt_id);
    assert.equal(row.dispatch_started_at.toISOString(), row.created_at.toISOString());
    assert.equal((await begin(old)).outcome, 'needs_reconciliation');
    assert.equal((await authorize(old, oldClaim)).outcome, 'not_authorized');
    assert.ok(!(await candidates()).includes(old.site));
    assert.equal((await begin(oldSaved)).outcome, 'claimed');
  });

  await test('competing admission and dispatch calls authorize exactly once', async () => {
    const value = await account();
    const claims = await Promise.all(Array.from({ length: 8 }, () => begin(value)));
    assert.equal(claims.filter(c => c.outcome === 'claimed').length, 1);
    assert.equal(claims.filter(c => c.outcome === 'in_progress').length, 7);
    const claim = claims.find(c => c.outcome === 'claimed');
    const results = await Promise.all(Array.from({ length: 8 }, () => authorize(value, claim)));
    assert.equal(results.filter(r => r.outcome === 'authorized').length, 1);
    const allowed = results.find(r => r.outcome === 'authorized');
    assert.equal(allowed.amount_cents, 2000);
    assert.equal(allowed.stripe_payment_method_id, value.method);
    assert.ok(allowed.dispatch_started_at && allowed.claim_expires_at);
    assert.equal((await begin(value)).outcome, 'needs_reconciliation');
    await expire(claim);
    await db.query("UPDATE credit_auto_top_up_attempts SET created_at=now()-interval '60 days' WHERE id=$1", [claim.attempt_id]);
    assert.equal((await begin(value)).outcome, 'needs_reconciliation');
    assert.equal((await authorize(value, claim)).outcome, 'not_authorized');
    assert.ok(!(await candidates()).includes(value.site));
    assert.equal((await attempt(claim.attempt_id)).status, 'pending');
    await noFinancialEffects(value);
  });

  await test('expired and stale claims cannot dispatch, but never-dispatched lease can transfer', async () => {
    const value = await account(), claim = await begin(value);
    await assert.rejects(savedIntent(value, claim));
    await expire(claim);
    assert.equal((await authorize(value, claim)).outcome, 'not_authorized');
    const renewed = await begin(value);
    assert.equal(renewed.attempt_id, claim.attempt_id);
    assert.notEqual(renewed.claim_token, claim.claim_token);
    assert.equal((await authorize(value, claim)).outcome, 'not_authorized');
    assert.equal((await attempt(claim.attempt_id)).status, 'pending');
    assert.equal((await authorize(value, renewed)).outcome, 'authorized');
  });

  await test('disable before first dispatch safely releases only the reservation', async () => {
    const value = await account(), claim = await begin(value);
    await configure(value, { enabled: false });
    const result = await authorize(value, claim);
    assert.equal(result.outcome, 'not_authorized');
    assert.equal(result.reason, 'consent_changed');
    const row = await attempt(claim.attempt_id), config = await settings(value.site);
    assert.equal(row.status, 'failed');
    assert.equal(row.dispatch_started_at, null);
    assert.equal(row.stripe_payment_intent_id, null);
    assert.equal(config.enabled, false);
    assert.equal(config.state, 'ready');
    assert.equal((await begin(value)).outcome, 'not_eligible');
    await noFinancialEffects(value);
    const other = await account(), pending = await begin(other);
    await configure(other, { enabled: false });
    assert.equal((await begin(other)).outcome, 'not_eligible');
    assert.equal((await attempt(pending.attempt_id)).status, 'failed');
  });

  await test('settings revisions reject changed and restored consent, pricing, card and customer', async () => {
    for (const change of ['toggle', 'target', 'cap', 'minimum', 'card', 'customer', 'paused']) {
      const value = await account(), claim = await begin(value);
      if (change === 'toggle') {
        await configure(value, { enabled: false }); await configure(value);
      } else if (change === 'target') await configure(value, { target: 21 });
      else if (change === 'cap') await configure(value, { cap: 2000 });
      else if (change === 'minimum') await configure(value, { minimum: 4 });
      else if (change === 'card') await rpc('attach_credit_auto_top_up_payment_method', [value.site, stripeId('pm'), value.customer]);
      else if (change === 'customer') await db.query('UPDATE billing SET stripe_customer_id=$2 WHERE site_id=$1', [value.site, stripeId('cus')]);
      else await configure(value, { state: 'paused' });
      assert.equal((await authorize(value, claim)).outcome, 'not_authorized', change);
      assert.equal((await attempt(claim.attempt_id)).status, 'failed', change);
      await noFinancialEffects(value);
    }
  });

  await test('dispatch rechecks active account, minimum and current quoted deficit', async () => {
    for (const change of ['archived', 'inactive', 'minimum', 'deficit']) {
      const value = await account(), claim = await begin(value);
      if (change === 'archived') await db.query('UPDATE sites SET archived_at=now() WHERE id=$1', [value.site]);
      else if (change === 'inactive') await db.query("UPDATE billing SET status='inactive' WHERE site_id=$1", [value.site]);
      else await rpc('grant_purchased_site_credits', [value.site, change === 'minimum' ? 20 : 1, stripeId('test'), {}]);
      assert.equal((await authorize(value, claim)).outcome, 'not_authorized', change);
      assert.equal((await attempt(claim.attempt_id)).status, 'failed', change);
      assert.equal((await settings(value.site)).state, 'ready', change);
    }
  });

  await test('saved PI recovery and verified webhook settlement survive revoked consent', async () => {
    const value = await account(), claim = await begin(value);
    assert.equal((await authorize(value, claim)).outcome, 'authorized');
    await configure(value, { enabled: false });
    const intent = await savedIntent(value, claim);
    await expire(claim);
    assert.ok((await candidates()).includes(value.site));
    const recovered = await begin(value);
    assert.equal(recovered.outcome, 'claimed');
    assert.equal(recovered.stripe_payment_intent_id, intent);
    assert.equal((await authorize(value, recovered)).outcome, 'not_authorized');
    assert.equal((await complete(value, recovered, intent)).outcome, 'succeeded');
    assert.equal((await complete(value, recovered, intent)).outcome, 'duplicate');
    assert.equal(Number((await one('SELECT purchased_credits_available n FROM billing WHERE site_id=$1', [value.site])).n), 20);
    assert.equal((await one('SELECT count(*)::integer n FROM payments WHERE transaction_id=$1', [intent])).n, 1);
    assert.equal((await begin(value)).outcome, 'not_eligible');
  });

  await test('verified canceled intent remains fail-able after disable without releasing ambiguous work', async () => {
    const value = await account(), claim = await begin(value);
    await authorize(value, claim); await configure(value, { enabled: false });
    const intent = await savedIntent(value, claim);
    await assert.rejects(rpc('fail_credit_auto_top_up_attempt',
      [value.site, claim.attempt_id, claim.claim_token, intent, 'processing']));
    assert.equal((await attempt(claim.attempt_id)).status, 'pending');
    assert.equal((await rpc('fail_credit_auto_top_up_attempt',
      [value.site, claim.attempt_id, claim.claim_token, intent, 'canceled'])).outcome, 'failed');
    assert.equal((await settings(value.site)).state, 'paused');
    await configure(value); // A configuration save cannot unpause a payment failure.
    assert.equal((await settings(value.site)).state, 'paused');
    await noFinancialEffects(value);
  });

  await test('previous-month pending stays reserved and current settlement consumes current cap', async () => {
    const value = await account({ cap: 2000 }), claim = await begin(value);
    await db.query(`UPDATE credit_auto_top_up_attempts SET created_at=
      date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '1 day' WHERE id=$1`, [claim.attempt_id]);
    await expire(claim);
    const recovered = await begin(value);
    assert.equal(recovered.attempt_id, claim.attempt_id);
    assert.equal((await authorize(value, recovered)).outcome, 'authorized');
    const intent = await savedIntent(value, recovered);
    await complete(value, recovered, intent);
    await rpc('deduct_credits', [value.site, 20, 'usage', 'Synthetic new-month consumption', {}]);
    assert.equal((await begin(value)).reason, 'monthly_cap');
    assert.ok(!(await candidates()).includes(value.site));
    // Only a success settled outside this month no longer consumes this cap.
    await db.query("UPDATE credit_auto_top_up_attempts SET finished_at=created_at WHERE id=$1", [claim.attempt_id]);
    assert.ok((await candidates()).includes(value.site));
    assert.equal((await begin(value)).outcome, 'claimed');
  });

  await test('authorization includes old unresolved reservation when another success settles this month', async () => {
    const value = await account({ cap: 4000 }), claim = await begin(value);
    await db.query(`UPDATE credit_auto_top_up_attempts SET created_at=
      date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '1 day' WHERE id=$1`, [claim.attempt_id]);
    // Historical success enters the current month's spend while a reserved quote waits.
    await db.query(`INSERT INTO credit_auto_top_up_attempts(site_id,credits,amount_cents,status,
      stripe_customer_id,stripe_payment_method_id,claim_expires_at,created_at,finished_at)
      VALUES($1,30,3000,'succeeded',$2,$3,now(),
        date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '2 days',now())`,
    [value.site, value.customer, value.method]);
    const result = await authorize(value, claim);
    assert.equal(result.reason, 'monthly_cap');
    assert.equal(result.outcome, 'not_authorized');
    assert.equal((await attempt(claim.attempt_id)).status, 'failed');
  });

  await test('renewal expires old plan balance before evaluating threshold without touching purchases', async () => {
    const value = await account();
    await db.query(`UPDATE billing SET plan_credits_available=30,purchased_credits_available=2,
      credits_available=32,plan_credit_period_start=now()-interval '2 months',
      plan_credit_period_end=now()-interval '1 month' WHERE site_id=$1`, [value.site]);
    assert.ok((await candidates()).includes(value.site));
    const claim = await begin(value);
    assert.equal(claim.outcome, 'claimed');
    assert.equal(claim.credits, 17); // Renewed Toolbox one credit plus two purchased.
    assert.equal((await authorize(value, claim)).outcome, 'authorized');
    assert.equal(Number((await one('SELECT purchased_credits_available n FROM billing WHERE site_id=$1', [value.site])).n), 2);
  });

  await test('configuration and actor consent are atomic and logs capture exact immutable terms', async () => {
    const value = await account();
    const initial = await settings(value.site);
    const saved = await configure(value, { cap: 4500 });
    const log = await one('SELECT * FROM credit_auto_top_up_consent_log WHERE id=$1', [saved.consent_id]);
    assert.equal(log.actor_id, value.actor);
    assert.equal(log.settings_revision, initial.settings_revision + 1);
    assert.equal(log.unit_price_cents, 100);
    assert.equal(log.settings_snapshot.max_monthly_spend_cents, 4500);
    assert.equal(log.settings_snapshot.stripe_customer_id, value.customer);
    assert.equal(log.settings_snapshot.stripe_payment_method_id, value.method);
    await assert.rejects(rpc('set_credit_auto_top_up_settings', [value.site, false, 5, 20, 100, null, null, 'ready']));
    assert.equal((await settings(value.site)).enabled, true);
    assert.equal((await settings(value.site)).max_monthly_spend_cents, 4500);
    // Simulate audit storage failure after internal config mutation: the transaction rolls back both.
    await db.exec(`CREATE FUNCTION reject_synthetic_consent() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Synthetic consent storage unavailable'; END $$;
      CREATE TRIGGER reject_synthetic_consent BEFORE INSERT ON credit_auto_top_up_consent_log
      FOR EACH ROW EXECUTE FUNCTION reject_synthetic_consent()`);
    await assert.rejects(configure(value, { enabled: false }));
    assert.equal((await settings(value.site)).enabled, true);
    await db.exec('DROP TRIGGER reject_synthetic_consent ON credit_auto_top_up_consent_log; DROP FUNCTION reject_synthetic_consent()');
    await configure(value, { enabled: false });
    assert.deepEqual(await one('SELECT * FROM credit_auto_top_up_consent_log WHERE id=$1', [saved.consent_id]), log);
  });

  await test('service-only RPC and append-only consent access controls execute in PostgreSQL', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const signature of ['authorize_credit_auto_top_up_dispatch(uuid,uuid,uuid)',
        'set_credit_auto_top_up_settings(uuid,boolean,numeric,numeric,integer,uuid,text,text)',
        'record_credit_auto_top_up_consent(uuid,uuid)', 'begin_credit_auto_top_up_attempt(uuid)',
        'list_credit_auto_top_up_candidates(integer)']) {
        assert.equal((await one('SELECT has_function_privilege($1,$2,\'EXECUTE\') ok', [role, signature])).ok, false);
      }
      await db.exec(`SET ROLE ${role}; SET request.jwt.claim.role='${role}'`);
      await assert.rejects(db.query('SELECT * FROM credit_auto_top_up_consent_log'));
      await assert.rejects(rpc('authorize_credit_auto_top_up_dispatch', [randomUUID(), randomUUID(), randomUUID()]));
      await db.exec("RESET ROLE; SET request.jwt.claim.role='service_role'");
    }
    assert.equal((await one(`SELECT has_function_privilege('service_role',
      'configure_credit_auto_top_up_settings_internal(uuid,boolean,numeric,numeric,integer,text,text)','EXECUTE') ok`)).ok, false);
    await db.exec('SET ROLE service_role');
    await assert.rejects(db.query('UPDATE credit_auto_top_up_consent_log SET actor_id=$1', [randomUUID()]));
    await assert.rejects(db.query('DELETE FROM credit_auto_top_up_consent_log'));
    await assert.rejects(db.query('UPDATE credit_auto_top_up_attempts SET dispatch_started_at=NULL'));
    await db.exec('RESET ROLE');
  });
  const setupValue = await account(), setupClaim = await begin(setupValue);
  await db.exec(readFileSync(resolve(root, 'supabase/migrations/20261009060000_auto_top_up_setup_binding.sql'), 'utf8'));
  const beginSetup = value => rpc('begin_credit_auto_top_up_setup', [value.site, value.actor]);
  const finishSetup = (value, setup, method) => rpc('complete_credit_auto_top_up_setup',
    [value.site, setup.token, value.customer, method]);
  await test('setup rollout and pending replacement invalidate prior dispatch and enable consent', async () => {
    assert.equal((await settings(setupValue.site)).enabled, false);
    assert.equal((await authorize(setupValue, setupClaim)).outcome, 'not_authorized');
    await assert.rejects(configure(setupValue));
    const setup = await beginSetup(setupValue);
    assert.equal(setup.outcome, 'started');
    assert.equal((await settings(setupValue.site)).enabled, false);
    await assert.rejects(configure(setupValue));
  });
  await test('latest card setup alone attaches and remains disabled until audited opt-in', async () => {
    const first = await beginSetup(setupValue), latest = await beginSetup(setupValue);
    const method = stripeId('pm');
    assert.equal((await finishSetup(setupValue, first, stripeId('pm'))).outcome, 'obsolete');
    assert.equal((await settings(setupValue.site)).stripe_payment_method_id, setupValue.method);
    assert.equal((await finishSetup(setupValue, latest, method)).outcome, 'attached');
    assert.equal((await settings(setupValue.site)).stripe_payment_method_id, method);
    assert.equal((await settings(setupValue.site)).enabled, false);
    await configure(setupValue);
    const enabled = await settings(setupValue.site);
    assert.equal(enabled.enabled, true);
    assert.equal((await finishSetup(setupValue, latest, method)).outcome, 'duplicate');
    assert.deepEqual(await settings(setupValue.site), enabled);
    await assert.rejects(finishSetup(setupValue, latest, stripeId('pm')));
    const claim = await begin(setupValue);
    assert.equal(claim.outcome, 'claimed');
    await beginSetup(setupValue);
    assert.equal((await authorize(setupValue, claim)).outcome, 'not_authorized');
    assert.equal((await settings(setupValue.site)).enabled, false);
  });
  await test('setup binding rejects wrong customer completion and later changed-customer consent', async () => {
    const setup = await beginSetup(setupValue), method = stripeId('pm');
    await assert.rejects(rpc('complete_credit_auto_top_up_setup',
      [setupValue.site, setup.token, stripeId('cus'), method]));
    assert.equal((await finishSetup(setupValue, setup, method)).outcome, 'attached');
    await db.query('UPDATE billing SET stripe_customer_id=$2 WHERE site_id=$1', [setupValue.site, stripeId('cus')]);
    await assert.rejects(configure(setupValue));
    assert.equal((await settings(setupValue.site)).enabled, false);
    for (const role of ['anon', 'authenticated']) {
      for (const signature of ['begin_credit_auto_top_up_setup(uuid,uuid)',
        'complete_credit_auto_top_up_setup(uuid,uuid,text,text)']) {
        assert.equal((await one('SELECT has_function_privilege($1,$2,\'EXECUTE\') ok', [role, signature])).ok, false);
      }
    }
    assert.equal((await one(`SELECT has_function_privilege('service_role',
      'attach_credit_auto_top_up_payment_method_internal(uuid,text,text)','EXECUTE') ok`)).ok, false);
  });
  await db.exec(readFileSync(resolve(root, 'supabase/migrations/20261009070000_auto_top_up_billing_card_default.sql'), 'utf8'));
  await test('principal billing card is adopted with atomic consent and fences setup replacement', async () => {
    const value = {site: randomUUID(), actor: randomUUID(), customer: stripeId('cus'), method: stripeId('pm')};
    await db.query("INSERT INTO sites(id,name,user_id) VALUES($1,'Synthetic default card',$2)", [value.site,value.actor]);
    await rpc('initialize_site_billing', [value.site]);
    await db.query('UPDATE billing SET stripe_customer_id=$2 WHERE site_id=$1', [value.site,value.customer]);
    const useDefault = (expectedToken=null, method=value.method) => rpc('save_credit_auto_top_up_with_billing_card',
      [value.site,value.actor,value.customer,method,expectedToken,5,20,10000]);
    assert.equal((await useDefault()).outcome, 'saved');
    assert.equal((await settings(value.site)).enabled, true);
    const binding = await one('SELECT * FROM credit_auto_top_up_card_setups WHERE site_id=$1', [value.site]);
    assert.equal(binding.source, 'billing');
    assert.equal(binding.stripe_payment_method_id,value.method);
    assert.equal((await one('SELECT count(*)::integer n FROM credit_auto_top_up_consent_log WHERE site_id=$1', [value.site])).n,1);
    const pendingSetup = await beginSetup(value);
    await assert.rejects(useDefault(binding.token));
    assert.equal((await settings(value.site)).enabled,false);
    await finishSetup(value,pendingSetup,stripeId('pm'));
    const explicit = await one('SELECT * FROM credit_auto_top_up_card_setups WHERE site_id=$1', [value.site]);
    assert.equal(explicit.source,'top_up');
    await assert.rejects(useDefault(explicit.token));
    assert.equal((await settings(value.site)).stripe_payment_method_id,explicit.stripe_payment_method_id);
    for (const role of ['anon','authenticated']) {
      assert.equal((await one("SELECT has_function_privilege($1,'save_credit_auto_top_up_with_billing_card(uuid,uuid,text,text,uuid,numeric,numeric,integer)','EXECUTE') ok",[role])).ok,false);
    }
  });
  console.log(`PASS ${passed} real PostgreSQL auto-top-up safety cases (offline PGlite)`);
} finally {
  await db.close();
}