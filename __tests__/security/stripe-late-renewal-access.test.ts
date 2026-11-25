/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { licensePostgresAvailable, licenseUuid } from './site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from './startup-trial-postgres'

const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
const readMigration = (name: string) => readFileSync(path.resolve(__dirname, '../../supabase/migrations', name), 'utf8')
const accessMigration = readMigration('20261125200000_stripe_late_renewal_access.sql')
const literal = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`

live('terminal Stripe late-renewal access in disposable PostgreSQL', () => {
  const pg = startupTrialPostgres()
  let baseLicensing: string
  const licensingDefinitions = () => pg.db(`SELECT pg_get_functiondef(oid) FROM pg_proc WHERE oid IN (
    'public.effective_site_plan(uuid)'::regprocedure,'public.site_member_has_effective_license(uuid)'::regprocedure,
    'public.get_site_member_license(uuid,uuid)'::regprocedure,'public.reconcile_site_member_license(uuid)'::regprocedure,
    'public.enforce_settings_license()'::regprocedure) ORDER BY proname;`)
  let nextId = 700
  beforeAll(() => {
    pg.start()
    pg.install()
    pg.db(readMigration('20261020002000_manual_agent_channel_activation.sql'))
    pg.db(readMigration('20261021001000_reconcile_paid_coverage_licenses.sql'))
    baseLicensing = licensingDefinitions()
    pg.db(accessMigration)
    pg.db(readMigration('20261125213000_individual_late_payment_access_month.sql'))
  }, 60000)
  afterAll(() => pg.stop())

  const seed = (untilExpiry?: number, plan = 'foundry', memberCount = 1, trial = false) => {
    const n = nextId++
    const { site, actor } = pg.seed(n)
    const members = Array.from({ length: memberCount }, (_, i) => licenseUuid(n * 100 + i + 3000))
    const [member] = members
    const customer_id = `cus_late${n}`
    const subscription_id = `sub_late${n}`
    const windowSql = untilExpiry === undefined
      ? `SELECT t AS s,t+interval '1 month' AS e FROM (SELECT date_trunc('second',clock_timestamp())-interval '3 days' AS t) t`
      : `SELECT t-interval '1 month' AS s,t AS e FROM (SELECT date_trunc('second',clock_timestamp())+interval '${untilExpiry} seconds' AS t) t`
    const window = JSON.parse(pg.db(`SET timezone='UTC'; WITH w AS (${windowSql})
    SELECT json_build_object('period_start',s,'period_end',e,
      'ended_at',s+interval '10 minutes','paid_at',s+interval '1 hour') FROM w;`)) as {
      period_start: string; period_end: string; ended_at: string; paid_at: string
    }
    if (trial) expect(pg.startTrial(site, actor)).toMatchObject({ success: true })
    else pg.db(`UPDATE billing SET plan='foundry' WHERE site_id='${site}';`)
    pg.db(`INSERT INTO site_members(site_id,user_id,role,status,email,created_at) VALUES
      ${members.map((user, i) => `('${site}','${user}','admin','active','${user}@example.test',
        '${window.ended_at}'::timestamptz - interval '${memberCount - i} minutes')`).join(',')};
      UPDATE billing SET stripe_customer_id='${customer_id}',stripe_subscription_id='${subscription_id}',
        subscription_status='past_due' WHERE site_id='${site}';
      SELECT sync_stripe_subscription_state('${site}','${customer_id}','${subscription_id}','${subscription_id}',
        'canceled','${window.period_end}',NULL,'${window.ended_at}',false);`)
    const evidence = {
      site_id: site, customer_id, subscription_id, invoice_id: `in_late${n}`, charge_id: `ch_late${n}`,
      payment_intent_id: `pi_late${n}`, plan, addons_count: 0, billing_interval: 'month',
      cancellation_reason: 'payment_failed', amount_paid: 9900, currency: 'USD', ...window,
    }
    const settle = (change: Record<string, unknown> = {}) => pg.rpc('settle_stripe_subscription_invoice', literal({
      ...evidence, status: 'paid', amount: 99, billing_reason: 'subscription_cycle',
      current_subscription_status: 'canceled', coverage_verified: true, ...change,
    }))
    return { site, actor, member, members, evidence, settle }
  }

  const recordSql = (proof: object) => `SELECT record_stripe_late_renewal_access(${literal(proof)});`
  const revokeSql = (charge: string) => `SELECT revoke_stripe_late_renewal_access('${charge}');`
  const record = (proof: object) => pg.call(recordSql(proof), undefined, 'service_role')
  const revoke = (charge: string) => pg.call(revokeSql(charge), undefined, 'service_role')
  const effective = (site: string) => pg.db(`SELECT effective_site_plan('${site}');`)
  const sitesVisible = (site: string, member: string) => pg.call(`SELECT count(*) FROM sites WHERE id='${site}';`, member)
  const primarySelector = (member: string) => pg.call('SELECT id FROM get_my_accessible_sites() ORDER BY id;', member)
  const bearerAccess = (site: string, member: string) => pg.call(
    `SELECT site_user_has_effective_access('${site}','${member}');`, undefined, 'service_role',
  )
  const selector = (member: string) => pg.call(`SELECT site_id FROM list_effective_selector_memberships('${member}') ORDER BY id;`, undefined, 'service_role')
  const paidThrough = ({ site_id, customer_id, subscription_id }: ReturnType<typeof seed>['evidence']) => pg.call(
    `SELECT stripe_late_renewal_paid_through('${site_id}','${customer_id}','${subscription_id}');`, undefined, 'service_role',
  )

  it('extends only an approved workspace beyond invoice expiry and preserves the reversal fence', async () => {
    const a = seed(5), b = seed()
    for (const x of [a, b]) { x.settle(); expect(record(x.evidence)).toBe('granted') }
    pg.db(`INSERT INTO public.late_payment_access_months(invoice_id) VALUES ('${a.evidence.invoice_id}');`)
    const expected = pg.db(`SELECT ('${a.evidence.paid_at}'::timestamptz AT TIME ZONE 'UTC' + interval '1 month') AT TIME ZONE 'UTC';`)
    expect(Date.parse(paidThrough(a.evidence))).toBe(Date.parse(expected))
    expect(Date.parse(paidThrough(b.evidence))).toBe(Date.parse(b.evidence.period_end))
    await pg.concurrent(`SELECT pg_sleep(${Math.max(0, (Date.parse(a.evidence.period_end) - Date.now()) / 1000) + 0.1});`)
    expect(primarySelector(a.member)).toBe(a.site)
    expect(revoke(a.evidence.charge_id)).toBe('revoked')
    expect(primarySelector(a.member)).toBe('')
    expect(paidThrough(a.evidence)).toBe('')
  })

  it('restores the same member and only their site after an uncredited terminal settlement', () => {
    const { site, actor, member, evidence, settle } = seed()
    const other = seed()
    expect(settle({ status: 'failed' })).toMatchObject({ outcome: 'failed_recorded', credits_granted: 0 })
    expect(settle()).toMatchObject({ outcome: 'settled', credits_granted: 0 })
    expect(effective(site)).toBe('commission')
    expect(selector(member)).toBe('')
    expect(primarySelector(member)).toBe('')
    expect(sitesVisible(site, member)).toBe('0')
    expect(sitesVisible(site, actor)).toBe('1')
    const financialState = () => pg.db(`SELECT jsonb_build_object(
      'billing',(SELECT to_jsonb(b) FROM billing b WHERE site_id='${site}'),
      'credit_transactions',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM credit_transactions c WHERE site_id='${site}'),
      'payment',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM payments p WHERE site_id='${site}'),
      'settlement',(SELECT to_jsonb(s) FROM stripe_subscription_invoice_settlements s WHERE site_id='${site}'));`)
    const before = financialState()
    expect(record(evidence)).toBe('granted')
    expect(effective(site)).toBe('commission')
    expect(selector(member)).toBe(site)
    expect(primarySelector(member)).toBe(site)
    expect(bearerAccess(site, member)).toBe('t')
    expect(pg.db(`SELECT license_suspended FROM site_members WHERE user_id='${member}';`)).toBe('t')
    expect(sitesVisible(site, member)).toBe('1')
    expect(sitesVisible(site, other.member)).toBe('0')
    expect(selector(other.member)).toBe('')
    expect(primarySelector(other.member)).toBe('')
    expect(effective(other.site)).toBe('commission')
    expect(new Date(paidThrough(evidence)).getTime()).toBe(new Date(evidence.period_end).getTime())
    expect(record(evidence)).toBe('duplicate')
    expect(settle({ status: 'failed' })).toMatchObject({ outcome: 'ignored_failure', credits_granted: 0 })
    expect(financialState()).toBe(before)
  })

  it('denies missing, weakened, or mismatched proof', () => {
    const { site, evidence, settle } = seed()
    const other = seed()
    expect(record(evidence)).toBe('rejected')
    settle()
    for (const change of [
      { site_id: other.site }, { customer_id: 'cus_wrong' }, { subscription_id: 'sub_wrong' },
      { amount_paid: 0 }, { amount_paid: 9899 }, { currency: 'EUR' }, { payment_intent_id: 'pi_wrong' },
      { plan: 'enterprise' }, { addons_count: 1 }, { billing_interval: 'year' },
      { cancellation_reason: 'cancellation_requested' }, { ended_at: evidence.period_start },
      { paid_at: evidence.period_start }, { period_end: 'infinity' }, { period_start: 'not-a-date' },
    ]) expect(record({ ...evidence, ...change })).toBe('rejected')
    expect(effective(site)).toBe('commission')
    expect(effective(other.site)).toBe('commission')
    expect(record(evidence)).toBe('granted')
    expect(record({ ...evidence, charge_id: 'ch_wrong' })).toBe('rejected')
  })

  it('does not accept a settled but ineligible invoice or a competing proof for the same termination', () => {
    const { site, evidence, settle } = seed()
    const competing = { ...evidence, invoice_id: 'in_competing', charge_id: 'ch_competing', payment_intent_id: 'pi_competing' }
    const nonCycle = { ...evidence, invoice_id: 'in_create', charge_id: 'ch_create', payment_intent_id: 'pi_create' }
    expect(settle({ ...nonCycle, billing_reason: 'subscription_create' }).outcome).toBe('settled')
    expect(record(nonCycle)).toBe('rejected')
    expect(effective(site)).toBe('commission')
    expect(settle().outcome).toBe('settled')
    expect(record(evidence)).toBe('granted')
    expect(settle(competing).outcome).toBe('settled')
    expect(record(competing)).toBe('rejected')
    expect(revoke(evidence.charge_id)).toBe('revoked')
    expect(record(competing)).toBe('rejected')
    expect(effective(site)).toBe('commission')
  })

  it('tombstones both reversal orders and does not reactivate on a stale paid retry', () => {
    const before = seed()
    const after = seed()
    before.settle()
    after.settle()
    expect(revoke(before.evidence.charge_id)).toBe('revoked')
    expect(record(before.evidence)).toBe('reversed')
    expect(record(after.evidence)).toBe('granted')
    expect(revoke(after.evidence.charge_id)).toBe('revoked')
    expect(revoke(after.evidence.charge_id)).toBe('revoked')
    expect(after.settle()).toMatchObject({ outcome: 'duplicate', credits_granted: 0 })
    expect(record(after.evidence)).toBe('reversed')
    for (const { site, member, evidence } of [before, after]) {
      expect(effective(site)).toBe('commission')
      expect(selector(member)).toBe('')
      expect(paidThrough(evidence)).toBe('')
    }
  })

  it('serializes concurrent grant, retry, and reversal', async () => {
    const { site, member, evidence, settle } = seed()
    settle()
    expect((await Promise.all([pg.concurrent(recordSql(evidence)), pg.concurrent(recordSql(evidence))])).sort())
      .toEqual(['duplicate', 'granted'])
    const next = seed()
    next.settle()
    const [, reversal] = await Promise.all([
      pg.concurrent(recordSql(next.evidence)), pg.concurrent(revokeSql(next.evidence.charge_id)),
    ])
    expect(reversal).toBe('revoked')
    expect(selector(member)).toBe(site)
    expect(selector(next.member)).toBe('')
    expect(effective(next.site)).toBe('commission')
    expect(record(next.evidence)).toBe('reversed')
  })

  it('drops access by wall clock without requiring a suspension-flag update', async () => {
    const { site, member, evidence, settle } = seed(4)
    settle()
    expect(record(evidence)).toBe('granted')
    expect(selector(member)).toBe(site)
    // Use one open transaction whose start precedes expiry.
    const seconds = Math.max(0, (Date.parse(evidence.period_end) - Date.now()) / 1000) + 0.1
    const elapsed = await pg.concurrent(`BEGIN; SELECT pg_sleep(${seconds});
      SELECT clock_timestamp() >= '${evidence.period_end}' AND now() < '${evidence.period_end}',
        site_user_has_effective_access('${site}','${member}'); COMMIT;`)
    expect(elapsed.trim()).toBe('t|f')
    expect(selector(member)).toBe('')
    expect(primarySelector(member)).toBe('')
    expect(sitesVisible(site, member)).toBe('0')
    expect(record(evidence)).toBe('rejected')
    expect(paidThrough(evidence)).not.toBe('')
  })

  it('does not transfer paid access to a replacement binding', () => {
    const { site, evidence, settle } = seed()
    settle()
    expect(record(evidence)).toBe('granted')
    pg.db(`SELECT sync_stripe_subscription_state('${site}','${evidence.customer_id}','sub_replacement',
      '${evidence.subscription_id}','trialing');`)
    expect(effective(site)).toBe('commission')
    expect(record(evidence)).toBe('rejected')
    expect(paidThrough(evidence)).toBe('')
    expect(paidThrough({ ...evidence, subscription_id: 'sub_replacement' })).toBe('')
  })

  it('preserves manual membership denial, archival and existing plan paths', () => {
    const { site, actor, member, evidence, settle } = seed()
    pg.db(`UPDATE site_members SET manually_disabled=true WHERE user_id='${member}';`)
    settle()
    expect(record(evidence)).toBe('granted')
    expect(effective(site)).toBe('commission')
    expect(selector(member)).toBe('')
    expect(primarySelector(member)).toBe('')
    expect(sitesVisible(site, member)).toBe('0')
    expect(sitesVisible(site, actor)).toBe('1')
    pg.db(`UPDATE sites SET archived_at=now() WHERE id='${site}';`)
    expect(effective(site)).toBe('commission')
    expect(paidThrough(evidence)).toBe('')
    expect(sitesVisible(site, actor)).toBe('0')
    const contract = pg.seed(nextId++)
    pg.db(`UPDATE billing SET plan='enterprise' WHERE site_id='${contract.site}';`)
    expect(effective(contract.site)).toBe('enterprise')
    const trial = pg.seed(nextId++)
    expect(pg.startTrial(trial.site, trial.actor)).toMatchObject({ success: true })
    expect(effective(trial.site)).toBe('foundry')
  })

  it('leaves admission, member and settings mirrors and resource quotas on the original plan', () => {
    expect(licensingDefinitions()).toBe(baseLicensing)
    const { site, member, evidence, settle } = seed()
    pg.db(`UPDATE settings SET channels='{"connections":[{"id":"email","type":"email","status":"connected"}]}'
      WHERE site_id='${site}';`)
    settle()
    expect(record(evidence)).toBe('granted')
    expect(primarySelector(member)).toBe(site)
    const notAdmitted = licenseUuid(998899)
    expect(() => pg.db(`INSERT INTO site_members(site_id,user_id,status,role) VALUES
      ('${site}','${notAdmitted}','active','admin');`)).toThrow(/MEMBER_LIMIT/)
    pg.db(`INSERT INTO site_members(site_id,user_id,status,role,license_suspended) VALUES
      ('${site}','${notAdmitted}','active','admin',true);
      SELECT reconcile_site_member_license('${site}');
      UPDATE settings SET channels=channels WHERE site_id='${site}';`)
    expect(primarySelector(notAdmitted)).toBe('')
    expect(selector(notAdmitted)).toBe('')
    expect(pg.db(`SELECT license_suspended FROM site_members WHERE user_id='${member}';`)).toBe('t')
    expect(pg.db(`SELECT team_members,channels->'connections'->0->>'status' FROM settings WHERE site_id='${site}';`))
      .toBe('[]|license_suspended')
    expect(pg.db(`SELECT get_site_member_license('${site}')->>'limit';`)).toBe('1')
  })

  it('does not shadow the seats from a higher active trial', () => {
    const { site, members, evidence, settle } = seed(undefined, 'engine', 6, true)
    const sixth = members[5]
    expect(primarySelector(sixth)).toBe(site)
    settle()
    expect(record(evidence)).toBe('granted')
    expect(effective(site)).toBe('foundry')
    expect(primarySelector(sixth)).toBe(site)
    expect(selector(sixth)).toBe(site)
    expect(revoke(evidence.charge_id)).toBe('revoked')
    expect(primarySelector(sixth)).toBe(site)
  })

  it('exposes no evidence tables or service RPCs to the browser', () => {
    const { evidence } = seed()
    for (const role of ['anon', 'authenticated', 'service_role']) {
      expect(pg.db(`SELECT has_table_privilege('${role}','public.stripe_late_renewal_access','SELECT, INSERT, UPDATE, DELETE'),
        has_table_privilege('${role}','public.stripe_late_renewal_reversals','SELECT, INSERT, UPDATE, DELETE');`)).toBe('f|f')
    }
    for (const role of ['anon', 'authenticated']) {
      expect(pg.db(`SELECT has_function_privilege('${role}', f, 'EXECUTE') FROM unnest(ARRAY[
        'record_stripe_late_renewal_access(jsonb)','revoke_stripe_late_renewal_access(text)',
        'stripe_late_renewal_paid_through(uuid,text,text)','list_effective_selector_memberships(uuid)',
        'effective_site_plan(uuid)']) f;`)).toBe('f\nf\nf\nf\nf')
      expect(() => pg.call(recordSql(evidence), undefined, role)).toThrow(/permission denied/)
    }
  })

  describe('automatic paid-month rollout', () => {
    it('preserves old grants and enrolls a newly verified payment once at its paid_at', () => {
      const old = seed(), individual = seed(), fresh = seed()
      for (const x of [old, individual, fresh]) x.settle()
      for (const x of [old, individual]) expect(record(x.evidence)).toBe('granted')
      pg.db(`INSERT INTO public.late_payment_access_months(invoice_id) VALUES ('${individual.evidence.invoice_id}')`)
      const previous = paidThrough(individual.evidence)
      pg.db(readMigration('20261125220000_automatic_late_payment_access_month.sql'))
      expect(record(old.evidence)).toBe('duplicate')
      expect(Date.parse(paidThrough(old.evidence))).toBe(Date.parse(old.evidence.period_end))
      expect(paidThrough(individual.evidence)).toBe(previous)
      expect(record({ ...fresh.evidence, amount_paid: 1 })).toBe('rejected')
      expect(paidThrough(fresh.evidence)).toBe('')
      expect(record(fresh.evidence)).toBe('granted')
      const deadline = paidThrough(fresh.evidence)
      const expected = pg.db(`SELECT (('${fresh.evidence.paid_at}'::timestamptz AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'`)
      expect(Date.parse(deadline)).toBe(Date.parse(expected))
      expect(Date.parse(deadline)).toBeGreaterThan(Date.parse(fresh.evidence.period_end))
      expect(record(fresh.evidence)).toBe('duplicate')
      expect(paidThrough(fresh.evidence)).toBe(deadline)
      expect(primarySelector(fresh.member)).toBe(fresh.site)
      expect(revoke(fresh.evidence.charge_id)).toBe('revoked')
      expect(paidThrough(fresh.evidence)).toBe('')
      expect(primarySelector(fresh.member)).toBe('')
    })
  })
})