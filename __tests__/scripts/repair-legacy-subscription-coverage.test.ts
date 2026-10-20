/** @jest-environment node */
import * as repair from '../../scripts/repair-legacy-subscription-coverage.cjs'
import { licensePostgresAvailable, licenseUuid } from '../security/site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from '../security/startup-trial-postgres'

const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
live('operator legacy coverage repair in disposable PostgreSQL', () => {
  const pg = startupTrialPostgres()
  const site = licenseUuid(501)
  const member = licenseUuid(2501)
  const invoice = 'in_legacy501'
  let evidence: Record<string, unknown>
  beforeAll(() => { pg.start(); pg.install() }, 60000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    pg.db(`DELETE FROM stripe_subscription_invoice_settlements WHERE site_id='${site}';
      DELETE FROM payments WHERE site_id='${site}'; DELETE FROM credit_transactions WHERE site_id='${site}';
      DELETE FROM site_members WHERE site_id='${site}'; DELETE FROM settings WHERE site_id='${site}';
      DELETE FROM billing WHERE site_id='${site}'; DELETE FROM sites WHERE id='${site}';`)
    pg.seed(501)
    pg.db(`UPDATE billing SET plan='foundry' WHERE site_id='${site}';
      INSERT INTO site_members(site_id,user_id,role,status,email)
        VALUES('${site}','${member}','admin','active','legacy@example.test');
      UPDATE billing SET stripe_customer_id='cus_legacy501',stripe_subscription_id='sub_legacy501',
        subscription_status='active' WHERE site_id='${site}';
      UPDATE billing SET plan_credits_available=63.530963,plan_credits_used=36.469037,monthly_credits_used=27.935037,
        plan_credit_allowance=100,plan_credit_period_start=now()-interval '1 day',plan_credit_period_end=now()+interval '29 days',
        plan_credit_source='stripe_legacy',credits_available=110.530963 WHERE site_id='${site}';
      INSERT INTO payments(site_id,transaction_id,transaction_type,amount,currency,status,credits)
        VALUES('${site}','stripe_invoice_${invoice}','subscription',99,'USD','completed',100);
      INSERT INTO stripe_subscription_invoice_settlements(invoice_id,site_id,payment_id,customer_id,subscription_id,amount,currency,credits_granted)
        SELECT '${invoice}',site_id,id,'cus_legacy501','sub_legacy501',99,'USD',100 FROM payments
        WHERE site_id='${site}' AND transaction_id='stripe_invoice_${invoice}';
      INSERT INTO credit_transactions(site_id,amount,transaction_type,metadata)
        SELECT site_id,100,'stripe_subscription_invoice',jsonb_build_object('stripe_invoice_id','${invoice}','payment_id',id)
        FROM payments WHERE site_id='${site}' AND transaction_id='stripe_invoice_${invoice}';`)
    const b = pg.row(site)
    evidence = { site_id: site, invoice_id: invoice, customer_id: 'cus_legacy501', subscription_id: 'sub_legacy501',
      plan: 'foundry', addons_count: 0, billing_interval: 'month', billing_reason: 'subscription_cycle',
      period_start: b.plan_credit_period_start, period_end: b.plan_credit_period_end, paid_at: new Date().toISOString(),
      verified_at: new Date().toISOString(), coverage_verified: true, amount: 99, currency: 'USD',
      current_subscription_status: 'active', current_service: { plan: 'foundry', addons_count: 0, billing_interval: 'month' } }
  })
  const snapshot = () => ({
    billing: pg.row(site), evidence,
    settlement: JSON.parse(pg.db(`SELECT row_to_json(s) FROM stripe_subscription_invoice_settlements s WHERE site_id='${site}';`)),
    payment: JSON.parse(pg.db(`SELECT row_to_json(p) FROM payments p WHERE site_id='${site}' AND transaction_id='stripe_invoice_${invoice}';`)),
    ledger: JSON.parse(pg.db(`SELECT json_agg(c) FROM credit_transactions c WHERE site_id='${site}' AND amount>0 AND metadata->>'stripe_invoice_id'='${invoice}';`)),
  })
  // The production tool uses PostgREST. This tiny adapter executes its exact
  // scoped filters and updates against real local SQL, including all triggers.
  const literal = (v: unknown) => `'${String(typeof v === 'object' ? JSON.stringify(v) : v).replace(/'/g, "''")}'`
  const column = (key: string) => key.includes('->>') ? key.replace('->>', "->>'") + "'" : key
  const supabase = { from(table: string) {
    const filters: string[] = []
    let patch: Record<string, unknown> | null = null
    let projection = '*'
    const execute = (single: boolean) => {
      try {
        const where = filters.join(' AND ')
        const sql = patch ? `WITH changed AS (UPDATE ${table} SET ${Object.entries(patch)
          .map(([key, value]) => `${key}=${literal(value)}`).join(',')} WHERE ${where} RETURNING *)
          SELECT coalesce(json_agg(projected),'[]') FROM (SELECT ${projection} FROM changed) projected` :
          `SELECT coalesce(json_agg(projected),'[]') FROM (SELECT ${projection} FROM ${table} WHERE ${where}) projected`
        const rows = JSON.parse(pg.db(sql))
        return { data: single ? rows.length === 1 ? rows[0] : null : rows, error: null }
      } catch { return { data: null, error: { message: 'SQL failed' } } }
    }
    const query = {
      select: (value = '*') => {
        projection = value.replace(/(_exact_\w+):(\w+)::text/g, '$2::text AS $1')
        return query
      },
      update: (value: Record<string, unknown>) => { patch = value; return query },
      eq: (key: string, value: unknown) => { filters.push(`${column(key)}=${literal(value)}`); return query },
      is: (key: string) => { filters.push(`${key} IS NULL`); return query },
      gt: (key: string, value: unknown) => { filters.push(`${key}>${literal(value)}`); return query },
      single: async () => execute(true),
      then: (resolve: (value: unknown) => void) => resolve(execute(false)),
    }
    return query
  } }

  it('defaults to preview with no database mutation', async () => {
    const before = snapshot()
    expect(await repair.runRepair({ supabase, evidence })).toMatchObject({ status: 'preview', credits_granted: 0 })
    expect(snapshot()).toEqual(before)
  })
  it('restores RLS without extra credits, marks proof applied and is idempotent', async () => {
    const before = snapshot()
    expect(pg.call(`SELECT count(*) FROM sites WHERE id='${site}';`, member)).toBe('0')
    expect(await repair.runRepair({ supabase, evidence, apply: true })).toMatchObject({ status: 'repaired', credits_granted: 0 })
    const after = snapshot()
    for (const field of repair.FINANCIAL_FIELDS) expect(after.billing[field]).toEqual(before.billing[field])
    expect(after.payment).toEqual(before.payment)
    expect(after.ledger).toEqual(before.ledger)
    expect(after.settlement.credit_coverage_applied).toBe(true)
    expect(after.settlement.credits_granted).toBe(100)
    expect(pg.call(`SELECT current_user_site_role('${site}');`, member)).toBe('admin')
    expect(pg.call(`SELECT count(*) FROM sites WHERE id='${site}';`, member)).toBe('1')
    expect(await repair.runRepair({ supabase, evidence, apply: true })).toMatchObject({ credits_granted: 0 })
    expect(snapshot()).toEqual(after)
  })
  it('resumes a coverage-only interruption without granting credits', async () => {
    const patch = repair.validateRepair(snapshot())
    pg.db(`UPDATE billing SET ${Object.entries(patch).map(([key, value]) => `${key}=${literal(value)}`).join(',')} WHERE site_id='${site}';`)
    const before = pg.row(site)
    await repair.runRepair({ supabase, evidence, apply: true })
    expect(pg.row(site)).toEqual(before)
    expect(snapshot().settlement.credit_coverage_applied).toBe(true)
  })
  it('preserves numeric precision beyond JavaScript numbers in CAS and verification', async () => {
    pg.db(`UPDATE billing SET plan_credits_available=63.530963000000000034,
      plan_credits_used=36.469036999999999966,monthly_credits_used=27.935036999999999966,
      credits_available=110.530963000000000034 WHERE site_id='${site}';`)
    const exact = () => pg.db(`SELECT plan_credits_available::text,plan_credits_used::text,
      monthly_credits_used::text,credits_available::text FROM billing WHERE site_id='${site}';`)
    const before = exact()
    await repair.runRepair({ supabase, evidence, apply: true })
    expect(exact()).toEqual(before)
    expect(snapshot().settlement.credit_coverage_applied).toBe(true)
  })
  it('rejects stale evidence, foreign identity, different windows and ambiguous grants', () => {
    const before = snapshot()
    for (const change of [
      { evidence: { ...evidence, verified_at: new Date(Date.now() - 16 * 60000).toISOString() } },
      { evidence: { ...evidence, site_id: licenseUuid(999) } },
      { evidence: { ...evidence, period_end: new Date(Date.now() + 86400000).toISOString() } },
      { evidence: { ...evidence, coverage_verified: false } },
      { evidence: { ...evidence, current_subscription_status: 'canceled' } },
      { ledger: [...before.ledger, ...before.ledger] },
      { settlement: { ...before.settlement, credits_granted: 101 } },
      { settlement: { ...before.settlement, verified_credit_coverage: { coverage_verified: true } } },
    ]) expect(() => repair.validateRepair({ ...before, ...change })).toThrow()
    expect(snapshot()).toEqual(before)
  })
})