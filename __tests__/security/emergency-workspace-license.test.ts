/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { licenseActor, licensePostgresAvailable, licenseUuid } from './site-license-postgres'
import { installBillingLocationPredicate } from './billing-location-prerequisite'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from './startup-trial-postgres'

const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
const migration = (name: string) => readFileSync(path.resolve(__dirname, '../../supabase/migrations', name), 'utf8')

live('emergency workspace license in disposable PostgreSQL', () => {
  const pg = startupTrialPostgres()
  let nextId = 810
  beforeAll(() => {
    pg.start()
    pg.install()
    installBillingLocationPredicate(pg)
    pg.db(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT current_setting('request.jwt.claims',true)::jsonb; $$;`)
    for (const name of [
      '20261020002000_manual_agent_channel_activation.sql',
      '20261021001000_reconcile_paid_coverage_licenses.sql',
      '20261125200000_stripe_late_renewal_access.sql',
      '20261125213000_individual_late_payment_access_month.sql',
      '20261125220000_automatic_late_payment_access_month.sql',
      '20261126210000_opt_in_late_payment_workspace_license.sql',
      '20261126211000_project_temporary_workspace_license.sql',
      '20261126220000_emergency_workspace_license.sql',
    ]) pg.db(migration(name))
  }, 60000)
  afterAll(() => pg.stop())

  const seed = () => {
    const n = nextId++
    const { site, actor } = pg.seed(n)
    const customer = `cus_grace${n}`
    const subscription = `sub_grace${n}`
    const invoice = `in_priorgrace${n}`
    const member = licenseUuid(n + 2000)
    const manuallyDisabled = licenseUuid(n + 3000)
    // Seed a previously applied, trusted monthly settlement with an expired
    // service period. The current cycle has not been paid.
    pg.db(`BEGIN;
      UPDATE billing SET plan='foundry' WHERE site_id='${site}';
      INSERT INTO site_members(site_id,user_id,role,status,email,manually_disabled) VALUES
        ('${site}','${member}','admin','active','member@example.test',false),
        ('${site}','${manuallyDisabled}','admin','active','disabled@example.test',true);
      INSERT INTO site_ownership(site_id,user_id) VALUES ('${site}','${member}');
      UPDATE settings SET channels='{"connections":[{"type":"chat","id":"active","status":"connected"},
        {"type":"chat","id":"manual","status":"disconnected","enabled":false}]}' WHERE site_id='${site}';
      UPDATE billing SET stripe_customer_id='${customer}',stripe_subscription_id='${subscription}',
        subscription_status='active' WHERE site_id='${site}';
      INSERT INTO payments(site_id,transaction_id,transaction_type,amount,currency,status)
        VALUES('${site}','stripe_invoice_${invoice}','subscription',99,'USD','completed');
      INSERT INTO stripe_subscription_invoice_settlements(invoice_id,payment_id,site_id,customer_id,subscription_id,amount,currency,
          credits_granted,credit_coverage_applied,verified_credit_coverage)
        SELECT '${invoice}',id,'${site}','${customer}','${subscription}',99,'USD',0,true,
          jsonb_build_object('plan','foundry','billing_interval','month','coverage_verified',true,
            'period_start',now()-interval '38 days','period_end',now()-interval '8 days','paid_at',now()-interval '38 days')
        FROM payments WHERE transaction_id='stripe_invoice_${invoice}';
      UPDATE billing SET paid_subscription_invoice_id='${invoice}',paid_subscription_plan='foundry',
        paid_subscription_addons_count=0,paid_subscription_period_start=now()-interval '38 days',
        paid_subscription_period_end=now()-interval '8 days',paid_subscription_paid_at=now()-interval '38 days'
        WHERE site_id='${site}';
      SELECT sync_stripe_subscription_state('${site}','${customer}','${subscription}','${subscription}',
        'past_due',now()+interval '22 days');
      COMMIT;`)
    const sql = `SELECT public.grant_emergency_grace('${site}');`
    const projection = `SELECT public.temporary_workspace_license(b) FROM
      jsonb_populate_record(NULL::public.billing,'{"site_id":"${site}","plan":"enterprise"}') b;`
    return { site, actor, customer, subscription, invoice, member, manuallyDisabled, sql, projection,
      grant: (user = actor) => JSON.parse(pg.call(sql, user)),
      effective: () => pg.db(`SELECT effective_site_plan('${site}');`),
      read: (user = actor) => JSON.parse(pg.call(projection, user) || 'null'),
      snapshot: () => pg.db(`SELECT row_to_json(b),
        (SELECT json_agg(p ORDER BY id) FROM payments p WHERE p.site_id=b.site_id),
        (SELECT json_agg(i ORDER BY invoice_id) FROM stripe_subscription_invoice_settlements i WHERE i.site_id=b.site_id),
        (SELECT json_agg(c ORDER BY id) FROM credit_transactions c WHERE c.site_id=b.site_id),
        (SELECT count(*) FROM site_startup_trials t WHERE t.site_id=b.site_id)
        FROM billing b WHERE site_id='${site}';`),
    }
  }

  it('grants only to the primary owner, restores the verified base tier and leaves financial state untouched', () => {
    const x = seed()
    const before = x.snapshot()
    expect(x.effective()).toBe('commission')
    expect(x.grant(x.member)).toEqual({ outcome: 'forbidden' })
    expect(x.grant(licenseUuid(2))).toEqual({ outcome: 'forbidden' })
    expect(pg.db(`SET ROLE authenticated; SET request.jwt.claims='{"sub":"${x.actor}","is_anonymous":true}'; ${x.sql}`))
      .toBe('{"outcome": "forbidden"}')
    for (const role of ['anon', 'service_role']) {
      expect(() => pg.call(x.sql, x.actor, role)).toThrow(/permission denied/)
    }
    expect(() => pg.call('SELECT * FROM site_emergency_workspace_licenses;', x.actor)).toThrow(/permission denied/)
    const grant = x.grant()
    expect(grant).toMatchObject({ outcome: 'granted', plan: 'foundry' })
    expect(x.effective()).toBe('foundry')
    expect(x.read()).toEqual({ kind: 'emergency_grace', plan: 'foundry', ends_at: grant.ends_at })
    expect(x.read(x.member)).toEqual(x.read())
    expect(x.read(x.manuallyDisabled)).toBeNull()
    expect(x.read(licenseUuid(3))).toBeNull()
    expect(pg.db(`SET ROLE authenticated; SET request.jwt.claims='{"sub":"${x.actor}","is_anonymous":true}'; ${x.projection}`))
      .toBe('')
    expect(pg.db(`SELECT ends_at-granted_at=interval '120 hours' FROM site_emergency_workspace_licenses
      WHERE site_id='${x.site}';`)).toBe('t')
    expect(x.snapshot()).toBe(before)
    expect(x.grant()).toEqual({ ...grant, outcome: 'already_granted' })
    const channels = pg.call(`SELECT get_site_licensed_resources('${x.site}')->'channels'->'connections';`, x.actor, 'service_role')
    expect(JSON.parse(channels).map((channel: { status: string }) => channel.status)).toEqual(['connected', 'disconnected'])
  })

  it('serializes concurrent requests and expires authoritatively without freeing the cycle', async () => {
    const x = seed()
    const results = await Promise.all([pg.concurrent(licenseActor(x.sql, x.actor)), pg.concurrent(licenseActor(x.sql, x.actor))])
    expect(results.map(result => JSON.parse(result).outcome).sort()).toEqual(['already_granted', 'granted'])
    expect(pg.db(`SELECT count(*) FROM site_emergency_workspace_licenses WHERE site_id='${x.site}';`)).toBe('1')
    pg.db(`UPDATE site_emergency_workspace_licenses SET granted_at=granted_at-interval '6 days',ends_at=ends_at-interval '6 days'
      WHERE site_id='${x.site}';`)
    expect(x.effective()).toBe('commission')
    expect(x.read()).toBeNull()
    expect(x.read(x.member)).toBeNull()
    expect(x.grant()).toEqual({ outcome: 'ineligible' })
    expect(pg.call(`SELECT get_site_licensed_resources('${x.site}')->>'effective_plan';`, x.actor, 'service_role')).toBe('commission')
  })

  it('does not expose a license through a fabricated billing argument to a location-restricted viewer', () => {
    const x = seed()
    expect(x.grant().outcome).toBe('granted')
    const viewer = licenseUuid(999191)
    pg.db(`INSERT INTO site_members(site_id,user_id,role,status,email) VALUES
      ('${x.site}','${viewer}','view','active','restricted@example.test');`)
    expect(x.read(viewer)?.plan).toBe('foundry')
    pg.db(`INSERT INTO site_member_location_restrictions(site_id,site_member_id)
      SELECT site_id,id FROM site_members WHERE site_id='${x.site}' AND user_id='${viewer}';`)
    expect(x.read(viewer)).toBeNull()
    expect(x.read(x.actor)?.plan).toBe('foundry')
  })

  it('caps expiry at cycle end and does not reuse an overlapping cycle after a binding change', () => {
    const x = seed()
    // Move the verified boundary and its adjacent current window together, so
    // the latter has less than five days left without fabricating a short month.
    pg.db(`BEGIN;
      UPDATE billing SET
        paid_subscription_period_start=paid_subscription_period_start-interval '20 days',
        paid_subscription_period_end=paid_subscription_period_end-interval '20 days',
        paid_subscription_paid_at=paid_subscription_paid_at-interval '20 days',
        subscription_current_period_end=subscription_current_period_end-interval '20 days'
      WHERE site_id='${x.site}';
      UPDATE stripe_subscription_invoice_settlements i SET verified_credit_coverage=i.verified_credit_coverage
        || jsonb_build_object('period_start',b.paid_subscription_period_start,'period_end',b.paid_subscription_period_end,
          'paid_at',b.paid_subscription_paid_at) FROM billing b WHERE b.site_id=i.site_id AND b.site_id='${x.site}';
      COMMIT;`)
    expect(x.grant().outcome).toBe('granted')
    expect(pg.db(`SELECT ends_at=cycle_end AND ends_at-granted_at<interval '120 hours'
      FROM site_emergency_workspace_licenses WHERE site_id='${x.site}';`)).toBe('t')
    pg.db(`UPDATE site_emergency_workspace_licenses SET subscription_id='sub_previous',
      cycle_start=cycle_start-interval '1 day',cycle_end=cycle_end-interval '1 day',ends_at=ends_at-interval '1 day'
      WHERE site_id='${x.site}';`)
    expect(x.effective()).toBe('commission')
    expect(x.grant()).toEqual({ outcome: 'ineligible' })
  })

  it('applies the rolling per-site cap across subscription IDs and excludes grants older than 12 UTC months', () => {
    const x = seed()
    pg.db(`INSERT INTO site_emergency_workspace_licenses
      SELECT b.site_id,b.id,b.stripe_customer_id,'sub_history'||i,b.paid_subscription_invoice_id,'${x.actor}',
        'foundry', t,t+interval '30 days',t,t+interval '120 hours'
      FROM billing b CROSS JOIN generate_series(1,3) i
      CROSS JOIN LATERAL (SELECT b.paid_subscription_period_end-i*interval '75 days' AS t) w WHERE b.site_id='${x.site}';`)
    expect(x.grant()).toEqual({ outcome: 'limit_reached' })
    expect(seed().grant().outcome).toBe('granted')
    pg.db(`UPDATE site_emergency_workspace_licenses SET
      cycle_start=cycle_start-interval '180 days',cycle_end=cycle_end-interval '180 days',
      granted_at=granted_at-interval '180 days',ends_at=ends_at-interval '180 days'
      WHERE site_id='${x.site}' AND subscription_id='sub_history3';`)
    expect(x.grant().outcome).toBe('granted')
  })

  const payCurrent = (x: ReturnType<typeof seed>) => pg.db(`SELECT settle_stripe_subscription_invoice(jsonb_build_object(
    'site_id',site_id,'customer_id',stripe_customer_id,'subscription_id',stripe_subscription_id,
    'invoice_id','in_paidgrace','status','paid','amount',99,'currency','USD','plan','foundry','addons_count',0,
    'billing_reason','subscription_cycle','billing_interval','month','current_subscription_status','past_due',
    'paid_at',now(),'period_start',paid_subscription_period_end,'period_end',subscription_current_period_end))
    FROM billing WHERE site_id='${x.site}';`)

  it('rejects a current payment even before credit coverage applies; an observed payment ends active grace', () => {
    const x = seed()
    expect(x.grant().outcome).toBe('granted')
    expect(JSON.parse(payCurrent(x))).toMatchObject({ outcome: 'settled', credits_granted: 0 })
    expect(x.effective()).toBe('commission')
    expect(x.read()).toBeNull()
    expect(x.grant()).toEqual({ outcome: 'ineligible' })
  })

  it('fences a simultaneous settlement and grant on the same billing row', async () => {
    const x = seed()
    const settle = `SELECT settle_stripe_subscription_invoice(jsonb_build_object(
      'site_id',site_id,'customer_id',stripe_customer_id,'subscription_id',stripe_subscription_id,
      'invoice_id','in_racegrace','status','paid','amount',99,'currency','USD','plan','foundry','addons_count',0,
      'billing_reason','subscription_cycle','billing_interval','month','current_subscription_status','past_due',
      'paid_at',now(),'period_start',paid_subscription_period_end,'period_end',subscription_current_period_end))
      FROM billing WHERE site_id='${x.site}';`
    const [settlement, grant] = await Promise.all([pg.concurrent(settle), pg.concurrent(licenseActor(x.sql, x.actor))])
    expect(JSON.parse(settlement).outcome).toBe('settled')
    expect(['granted', 'ineligible']).toContain(JSON.parse(grant).outcome)
    expect(x.effective()).toBe('commission')
    expect(x.grant()).toEqual({ outcome: 'ineligible' })
  })

  it.each([
    "UPDATE billing SET billing_interval='year' WHERE site_id=:site",
    "UPDATE billing SET subscription_status='trialing' WHERE site_id=:site",
    "UPDATE billing SET subscription_status='paused' WHERE site_id=:site",
    "UPDATE billing SET subscription_status='canceled' WHERE site_id=:site",
    "UPDATE billing SET subscription_current_period_end=NULL WHERE site_id=:site",
    "UPDATE billing SET subscription_current_period_end=subscription_current_period_end+interval '30 days' WHERE site_id=:site",
    "UPDATE stripe_subscription_invoice_settlements SET customer_id='cus_wrong' WHERE site_id=:site",
    "UPDATE stripe_subscription_invoice_settlements SET credit_coverage_applied=false WHERE site_id=:site",
  ])('fails closed without eligible lifecycle and binding: %s', statement => {
    const x = seed()
    pg.db(statement.replace(':site', `'${x.site}'`))
    expect(x.grant()).toEqual({ outcome: 'ineligible' })
  })

  it('binds a live grant to the original subscription and archive status', () => {
    const x = seed()
    expect(x.grant().outcome).toBe('granted')
    pg.db(`UPDATE billing SET stripe_subscription_id='sub_replacement' WHERE site_id='${x.site}';`)
    expect(x.effective()).toBe('commission')
    expect(x.read()).toBeNull()
    const y = seed()
    expect(y.grant().outcome).toBe('granted')
    pg.db(`UPDATE sites SET archived_at=clock_timestamp() WHERE id='${y.site}';`)
    expect(y.effective()).toBe('commission')
    expect(y.read()).toBeNull()
    expect(y.grant()).toEqual({ outcome: 'forbidden' })
  })
})