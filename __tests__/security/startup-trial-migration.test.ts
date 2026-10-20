/** @jest-environment node */
import { licenseActor, licensePostgresAvailable, licenseUuid } from './site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable, trialMigrationSql } from './startup-trial-postgres'

describe('Startup trial SQL contracts', () => {
  it('uses a separate finite bucket, permanent owner claim and dynamic RLS', () => {
    expect(trialMigrationSql).toContain('primary_owner_id uuid PRIMARY KEY')
    expect(trialMigrationSql).toContain("interval '360 hours'")
    expect(trialMigrationSql).toContain('trial_spent numeric NOT NULL DEFAULT 0')
    expect(trialMigrationSql).toContain('public.site_member_has_effective_license(sm.id)')
    expect(trialMigrationSql).not.toContain('INSERT INTO public.payments')
  })
})

const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
live('Startup trials in disposable socket-only PostgreSQL', () => {
  const pg = startupTrialPostgres()
  beforeAll(() => { pg.start(); pg.install() }, 60000)
  afterAll(() => pg.stop())

  it('starts only explicitly, returns a stable DTO and consumes trial first without touching protected money', () => {
    const { site, actor } = pg.seed(101)
    expect(pg.rpc('get_site_startup_trial', `'${site}'`).state).toBe('eligible')
    const before = pg.row(site)
    const result = pg.startTrial(site, actor)
    expect(result).toMatchObject({ success: true, state: 'active', outcome: 'started', credits_remaining: 50, effective_plan: 'foundry' })
    expect(new Date(result.ends_at).getTime() - new Date(result.started_at).getTime()).toBe(15 * 86400000)
    expect(pg.row(site).plan).toBe('commission')
    expect(pg.rpc('deduct_credits', `'${site}',12.123456789,'usage','Trial test','{}'`).success).toBe(true)
    const after = pg.row(site)
    expect(Number(after.trial_credits_available)).toBeCloseTo(37.876543211, 9)
    for (const field of ['plan_credits_available', 'purchased_credits_available', 'legacy_credits_available', 'account_balance', 'plan_credits_used'])
      expect(after[field]).toBe(before[field])
    expect(pg.startTrial(site, actor).outcome).toBe('already_started')
  })

  it('serializes concurrent duplicate activation and once-per-owner claims across projects', async () => {
    const a = pg.seed(102); const b = pg.seed(103, 1102)
    const results = await Promise.all([a.site, a.site, b.site].map(site => pg.concurrent(
      `SELECT start_site_startup_trial('${site}','${a.actor}')->>'outcome';`)))
    expect(results.filter(result => result === 'started')).toHaveLength(1)
    expect(pg.db(`SELECT count(*) FROM site_startup_trials WHERE primary_owner_id='${a.actor}';`)).toBe('1')
    expect(Number(pg.row(a.site).trial_credits_available) + Number(pg.row(b.site).trial_credits_available)).toBe(50)
  })

  it('rejects anonymous, browser writes, cross-site actors and paid/addon eligibility', () => {
    const { site, actor } = pg.seed(104)
    expect(() => pg.call(`SELECT start_site_startup_trial('${site}','${actor}');`, actor, 'anon')).toThrow()
    expect(() => pg.startTrial(site, licenseUuid(999))).toThrow('licensed site manager')
    expect(() => pg.call(`UPDATE billing SET trial_credits_available=50 WHERE site_id='${site}';`, actor)).toThrow()
    pg.db(`UPDATE billing SET addons_count=1 WHERE site_id='${site}';`)
    expect(pg.startTrial(site, actor).outcome).toBe('not_eligible')
    const paid = pg.seed(105)
    pg.db(`UPDATE billing SET stripe_subscription_id='sub_incomplete',subscription_status='incomplete' WHERE site_id='${paid.site}';`)
    expect(pg.startTrial(paid.site, paid.actor).outcome).toBe('not_eligible')
  })

  it('expires under wall clock within an old transaction; members lose RLS access without reconciliation', () => {
    const { site, actor } = pg.seed(106); pg.startTrial(site, actor)
    const member = licenseUuid(2206)
    pg.db(`INSERT INTO site_members(site_id,user_id,role,status,email) VALUES('${site}','${member}','admin','active','trial@example.test');`)
    expect(pg.call(`SELECT current_user_site_role('${site}');`, member)).toBe('admin')
    expect(pg.db(`SELECT site_user_has_effective_access('${site}','${member}');`)).toBe('t')
    // Trusted test setup shortens only the clock position, keeping exact duration.
    pg.db(`UPDATE site_startup_trials SET started_at=date_trunc('second',clock_timestamp())-interval '359 hours 59 minutes 59 seconds',
      ends_at=date_trunc('second',clock_timestamp())+interval '1 second' WHERE site_id='${site}';
      UPDATE billing SET trial_started_at=t.started_at,trial_ends_at=t.ends_at FROM site_startup_trials t WHERE billing.site_id=t.site_id AND t.site_id='${site}';`)
    const result = pg.db(`BEGIN; SELECT pg_sleep(1.1);
      ${licenseActor(`SELECT coalesce(current_user_site_role('${site}'),'denied'); SELECT count(*) FROM sites WHERE id='${site}';`, member)} COMMIT;`)
    expect(result).toContain('denied\n0')
    expect(pg.db(`SELECT license_suspended FROM site_members WHERE user_id='${member}';`)).toBe('f')
    expect(pg.rpc('get_site_startup_trial', `'${site}'`)).toMatchObject({ state: 'expired', credits_remaining: 0, effective_plan: 'commission' })
    expect(pg.db(`SELECT site_user_has_effective_access('${site}','${member}');`)).toBe('f')
    expect(pg.db(`SELECT site_user_has_effective_access('${site}','${actor}');`)).toBe('t')
    expect(pg.call(`SELECT current_user_site_role('${site}');`, actor)).toBe('owner')
    pg.rpc('renew_site_plan_credits', `'${site}'`)
    expect(Number(pg.row(site).trial_credits_available)).toBe(0)
  })

  it('uses dynamic resource quotas at expiry rather than stale raw flags', () => {
    const { site, actor } = pg.seed(107); pg.startTrial(site, actor)
    pg.db(`UPDATE settings SET social_media='[{"id":"social1","isActive":true},{"id":"social2","isActive":true}]',
      channels='{"connections":[{"id":"agent1","status":"connected"}]}' WHERE site_id='${site}';`)
    expect(pg.rpc('get_site_licensed_resources', `'${site}'`).channels.connections[0].status).toBe('connected')
    pg.expire(site)
    const resources = pg.rpc('get_site_licensed_resources', `'${site}'`)
    expect(resources.social_media.map((item: { isActive: boolean }) => item.isActive)).toEqual([true, false])
    expect(resources.channels.connections[0].status).toBe('license_suspended')
  })

  it('purchase and renew writers preserve the trial and original included allowance', () => {
    const { site, actor } = pg.seed(108); pg.startTrial(site, actor)
    pg.rpc('grant_purchased_site_credits', `'${site}',5,'purchase_trial_108','{}'`)
    pg.rpc('renew_site_plan_credits', `'${site}'`)
    const row = pg.row(site)
    expect(Number(row.trial_credits_available)).toBe(50)
    expect(Number(row.purchased_credits_available)).toBe(45)
    expect(Number(row.plan_credits_available)).toBe(1)
    expect(Number(row.credits_available)).toBe(103)
  })

  it('preserves verified Stripe settlement and expires the overlay once; cancellation cannot revive it', () => {
    const { site, actor } = pg.seed(109); pg.startTrial(site, actor)
    const session = licenseUuid(3109); const event = licenseUuid(4109)
    pg.db(`INSERT INTO harness_sessions VALUES('${session}');`)
    pg.rpc('hold_harness_model_credits', `'${session}','${site}','${event}',10,NULL`)
    pg.db(`UPDATE billing SET stripe_customer_id='cus_trial109',stripe_subscription_id='sub_trial109',subscription_status='active' WHERE site_id='${site}';`)
    expect(pg.rpc('get_site_startup_trial', `'${site}'`).state).toBe('active')
    const dates = JSON.parse(pg.db(`SELECT json_build_object('start',now()-interval '1 day','end',now()+interval '29 days','now',now());`))
    const invoice = JSON.stringify({ site_id: site, customer_id: 'cus_trial109', subscription_id: 'sub_trial109',
      invoice_id: 'in_trial109', status: 'paid', amount: 99, currency: 'USD', plan: 'foundry', addons_count: 0,
      billing_interval: 'month', billing_reason: 'subscription_create', current_subscription_status: 'active',
      period_start: dates.start, period_end: dates.end, paid_at: dates.now, coverage_verified: true })
    expect(pg.rpc('settle_stripe_subscription_invoice', `'${invoice}'`).outcome).toBe('settled')
    expect(pg.rpc('get_site_startup_trial', `'${site}'`).state).toBe('converted')
    const row = pg.row(site)
    expect(row.plan).toBe('foundry'); expect(row.paid_subscription_invoice_id).toBe('in_trial109')
    expect(Number(row.plan_credits_available)).toBe(100); expect(Number(row.trial_credits_available)).toBe(0)
    expect([row.purchased_credits_available, row.legacy_credits_available, row.account_balance]).toEqual([40, 7, 17.42])
    expect(pg.rpc('settle_stripe_subscription_invoice', `'${invoice}'`).outcome).toBe('duplicate')
    expect(pg.db(`SELECT count(*) FROM credit_transactions WHERE site_id='${site}' AND transaction_type='startup_trial_expiry';`)).toBe('1')
    pg.rpc('cancel_harness_model_reservation', `'${session}','${event}','predispatch'`)
    expect(Number(pg.row(site).plan_credits_available)).toBe(100)
    expect(Number(pg.row(site).trial_credits_available)).toBe(0)
    pg.db(`UPDATE billing SET subscription_status='canceled' WHERE site_id='${site}';`)
    expect(pg.rpc('get_site_startup_trial', `'${site}'`).effective_plan).toBe('commission')
    expect(pg.row(site).trial_converted_at).not.toBeNull()
  })

  it('denies a legacy active Stripe admin without coverage and restores access after verified settlement', () => {
    const { site, actor } = pg.seed(117)
    const member = licenseUuid(2217)
    pg.db(`UPDATE billing SET plan='foundry' WHERE site_id='${site}';
      INSERT INTO site_members(site_id,user_id,role,status,email)
        VALUES('${site}','${member}','admin','active','legacy-admin@example.test');`)
    expect(pg.call(`SELECT current_user_site_role('${site}');`, member)).toBe('admin')
    // A lifecycle status is not paid service proof. Like a legacy deployment,
    // the suspension mirror remains false until a reconciliation runs.
    pg.db(`UPDATE billing SET stripe_customer_id='cus_legacy117',
      stripe_subscription_id='sub_legacy117',subscription_status='active' WHERE site_id='${site}';`)
    expect(pg.row(site)).toMatchObject({ plan: 'foundry', paid_subscription_invoice_id: null })
    expect(pg.db(`SELECT license_suspended,manually_disabled,status FROM site_members WHERE user_id='${member}';`))
      .toBe('f|f|active')
    expect(pg.db(`SELECT effective_site_plan('${site}');`)).toBe('commission')
    expect(pg.call(`SELECT coalesce(current_user_site_role('${site}'),'denied');`, member)).toBe('denied')
    expect(pg.call(`SELECT count(*) FROM sites WHERE id='${site}';`, member)).toBe('0')
    expect(pg.call(`SELECT current_user_site_role('${site}');`, actor)).toBe('owner')

    const dates = JSON.parse(pg.db(`SELECT json_build_object('start',now()-interval '1 day',
      'end',now()+interval '29 days','now',now());`))
    const invoice = JSON.stringify({ site_id: site, customer_id: 'cus_legacy117', subscription_id: 'sub_legacy117',
      invoice_id: 'in_legacy117', status: 'paid', amount: 99, currency: 'USD', plan: 'foundry', addons_count: 0,
      billing_interval: 'month', billing_reason: 'subscription_cycle', current_subscription_status: 'active',
      period_start: dates.start, period_end: dates.end, paid_at: dates.now, coverage_verified: true })
    const before = pg.row(site)
    expect(pg.rpc('settle_stripe_subscription_invoice', `'${invoice}'`).outcome).toBe('settled')
    expect(pg.db(`SELECT effective_site_plan('${site}');`)).toBe('foundry')
    expect(pg.call(`SELECT current_user_site_role('${site}');`, member)).toBe('admin')
    expect(pg.call(`SELECT count(*) FROM sites WHERE id='${site}';`, member)).toBe('1')
    const recovered = pg.row(site)
    for (const field of ['purchased_credits_available', 'legacy_credits_available', 'account_balance', 'trial_credits_available'])
      expect(recovered[field]).toBe(before[field])
    expect(pg.rpc('settle_stripe_subscription_invoice', `'${invoice}'`).outcome).toBe('duplicate')
    expect(pg.row(site)).toEqual(recovered)
  })

  it('actual-cost reservations debit trial first and refund only the original unexpired trial', () => {
    const { site, actor } = pg.seed(110); pg.startTrial(site, actor)
    const session = licenseUuid(3110); const event = licenseUuid(4110)
    pg.db(`INSERT INTO harness_sessions VALUES('${session}');`)
    expect(pg.rpc('hold_harness_model_credits', `'${session}','${site}','${event}',10,NULL`).state).toBe('reserved')
    expect(Number(pg.row(site).trial_credits_available)).toBe(40)
    pg.rpc('dispatch_harness_model_reservation', `'${session}','${event}'`)
    expect(pg.rpc('settle_harness_model_reservation', `'${session}','${event}',2,'generation110','model'`).charged).toBe(2.5)
    expect(Number(pg.row(site).trial_credits_available)).toBe(47.5)
    expect(pg.db(`SELECT trial_spent FROM harness_model_credit_reservations WHERE session_id='${session}';`)).toBe('10')
    expect(pg.rpc('settle_harness_model_reservation', `'${session}','${event}',2,'generation110','model'`).charged).toBe(2.5)
    const next = licenseUuid(4111)
    pg.rpc('hold_harness_model_credits', `'${session}','${site}','${next}',50,NULL`)
    pg.expire(site)
    pg.rpc('cancel_harness_model_reservation', `'${session}','${next}','predispatch'`)
    const row = pg.row(site)
    expect(Number(row.trial_credits_available)).toBe(0)
    expect([row.purchased_credits_available, row.legacy_credits_available, row.account_balance]).toEqual([40, 7, 17.42])
    expect(Number(row.plan_credits_available)).toBe(1)
  })

  it('does not recreate trial eligibility when a site is deleted or its primary ownership changes', () => {
    const { site, actor } = pg.seed(111); pg.startTrial(site, actor)
    pg.db(`UPDATE sites SET user_id='${licenseUuid(9991)}' WHERE id='${site}';`)
    const other = pg.seed(112, 1111)
    expect(pg.startTrial(other.site, actor).outcome).toBe('already_used')
    pg.db(`DELETE FROM settings WHERE site_id='${site}'; DELETE FROM payments WHERE site_id='${site}';
      DELETE FROM credit_transactions WHERE site_id='${site}'; DELETE FROM billing WHERE site_id='${site}';
      DELETE FROM sites WHERE id='${site}';`)
    expect(pg.startTrial(other.site, actor).outcome).toBe('already_used')
  })

  it('rejects a queued debit after the expiry boundary even when it began before expiry', async () => {
    const { site, actor } = pg.seed(113); pg.startTrial(site, actor)
    pg.db(`UPDATE billing SET purchased_credits_available=0,legacy_credits_available=0,credits_available=plan_credits_available+trial_credits_available WHERE site_id='${site}';`)
    const lock = pg.concurrent(`BEGIN; SELECT 1 FROM billing WHERE site_id='${site}' FOR UPDATE;
      UPDATE site_startup_trials SET started_at=statement_timestamp()-interval '359 hours 59 minutes 59 seconds',
        ends_at=statement_timestamp()+interval '1 second' WHERE site_id='${site}';
      UPDATE billing SET trial_started_at=t.started_at,trial_ends_at=t.ends_at FROM site_startup_trials t WHERE billing.site_id=t.site_id AND t.site_id='${site}';
      SELECT pg_sleep(1.5); COMMIT;`)
    await new Promise(resolve => setTimeout(resolve, 150))
    const debit = pg.concurrent(`SELECT deduct_credits('${site}',10,'usage','Queued expired debit','{}')->>'success';`)
    await lock
    expect(await debit).toBe('false')
    expect(Number(pg.row(site).trial_credits_available)).toBe(0)
  })

  it('cleans fully consumed expired trials and keeps disabled members disabled on an upgrade', () => {
    const { site, actor } = pg.seed(114); pg.startTrial(site, actor)
    const member = licenseUuid(2214)
    pg.db(`INSERT INTO site_members(site_id,user_id,role,status,email) VALUES('${site}','${member}','admin','active','disabled@example.test');
      UPDATE site_members SET manually_disabled=true,license_suspended=true WHERE user_id='${member}';`)
    expect(pg.call(`SELECT coalesce(current_user_site_role('${site}'),'denied');`, member)).toBe('denied')
    pg.rpc('deduct_credits', `'${site}',50,'usage','Entire trial spent','{}'`)
    // Advance only the ledger/projection time. Fully consumed grants must still
    // reconcile mirrors on GET and never refill the same grant.
    pg.expire(site)
    expect(pg.rpc('get_site_startup_trial', `'${site}'`).state).toBe('expired')
    expect(Number(pg.row(site).trial_credits_available)).toBe(0)
    pg.db(`UPDATE billing SET plan='foundry' WHERE site_id='${site}';`)
    expect(pg.call(`SELECT coalesce(current_user_site_role('${site}'),'denied');`, member)).toBe('denied')
  })

  it('enforces a finite exact 360-hour grant across DST and rejects malformed projections', () => {
    const { site, actor } = pg.seed(115); pg.startTrial(site, actor)
    expect(pg.db(`SET TIME ZONE 'America/New_York'; SELECT extract(epoch FROM (ends_at-started_at)) FROM site_startup_trials WHERE site_id='${site}';`)).toBe('1296000.000000')
    expect(() => pg.db(`UPDATE billing SET trial_ends_at=NULL WHERE site_id='${site}';`)).toThrow()
    expect(() => pg.db(`UPDATE billing SET trial_credits_available='NaN' WHERE site_id='${site}';`)).toThrow()
    expect(() => pg.db(`UPDATE billing SET credits_available=999 WHERE site_id='${site}';`)).toThrow('Aggregate-only')
    expect(pg.db(`SELECT has_function_privilege('authenticated','public.get_site_startup_trial(uuid)','EXECUTE'),
      has_function_privilege('authenticated','public.start_site_startup_trial(uuid,uuid)','EXECUTE'),
      has_table_privilege('authenticated','public.site_startup_trials','INSERT');`)).toBe('f|f|f')
  })

  it('does not admit full remaining-trial exhaustion when the final guard crosses exact expiry', () => {
    const { site, actor } = pg.seed(116); pg.startTrial(site, actor)
    // Artificial local trigger models work between admission and the final guard;
    // it is never part of the migration or a remote database.
    pg.db(`CREATE FUNCTION test_trial_debit_delay() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.site_id='${site}' AND NEW.credits_used>OLD.credits_used THEN PERFORM pg_sleep(0.5); END IF; RETURN NEW; END; $$;
      CREATE TRIGGER a_test_trial_debit_delay BEFORE UPDATE ON billing FOR EACH ROW EXECUTE FUNCTION test_trial_debit_delay();
      UPDATE site_startup_trials SET started_at=statement_timestamp()-interval '359 hours 59 minutes 59.7 seconds',
        ends_at=statement_timestamp()+interval '0.3 second' WHERE site_id='${site}';
      UPDATE billing SET trial_started_at=t.started_at,trial_ends_at=t.ends_at FROM site_startup_trials t
        WHERE billing.site_id=t.site_id AND t.site_id='${site}';`)
    expect(() => pg.rpc('deduct_credits', `'${site}',50,'usage','Exact exhausted stale trial','{}'`)).toThrow('Trial expired')
    pg.db('DROP TRIGGER a_test_trial_debit_delay ON billing; DROP FUNCTION test_trial_debit_delay();')
    const row = pg.row(site)
    expect(Number(row.credits_used)).toBe(0)
    pg.rpc('get_site_startup_trial', `'${site}'`)
    expect(Number(pg.row(site).trial_credits_available)).toBe(0)
  })
})