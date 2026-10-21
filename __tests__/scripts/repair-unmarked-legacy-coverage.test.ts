/** @jest-environment node */
import * as repair from '../../scripts/repair-unmarked-legacy-coverage.cjs'
import { licensePostgresAvailable, licenseUuid } from '../security/site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from '../security/startup-trial-postgres'

const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
live('unmarked legacy coverage repair in disposable PostgreSQL', () => {
  const pg = startupTrialPostgres()
  const site = licenseUuid(701)
  const other = licenseUuid(702)
  const invoice = 'in_legacy701'
  let evidence: Record<string, unknown>
  beforeAll(() => { pg.start(); pg.install() }, 60000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    pg.db(`DELETE FROM stripe_subscription_invoice_settlements WHERE site_id IN ('${site}','${other}');
      DELETE FROM payments WHERE site_id IN ('${site}','${other}');
      DELETE FROM credit_transactions WHERE site_id IN ('${site}','${other}');
      DELETE FROM site_members WHERE site_id IN ('${site}','${other}');
      DELETE FROM settings WHERE site_id IN ('${site}','${other}');
      DELETE FROM billing WHERE site_id IN ('${site}','${other}');
      DELETE FROM sites WHERE id IN ('${site}','${other}');`)
    pg.seed(701); pg.seed(702)
    pg.db(`UPDATE billing SET plan='foundry' WHERE site_id='${site}';
      UPDATE settings SET channels='{"connections":[{"id":"voice","type":"voice","status":"connected"},
        {"id":"email","type":"email","status":"connected"},{"id":"wa","type":"whatsapp","status":"connected"}]}'
        WHERE site_id='${site}';
      UPDATE billing SET stripe_customer_id='cus_legacy701',stripe_subscription_id='sub_legacy701',
        subscription_status='active' WHERE site_id='${site}';
      UPDATE settings SET channels=channels WHERE site_id='${site}';
      UPDATE billing SET plan_credits_available=0,plan_credits_used=100,monthly_credits_used=417.558404,
        plan_credit_allowance=100,plan_credit_period_start=now()-interval '1 day',plan_credit_period_end=now()+interval '29 days',
        plan_credit_source='stripe_legacy',purchased_credits_available=217.441596,legacy_credits_available=0,
        credits_available=217.441596 WHERE site_id='${site}';
      INSERT INTO payments(site_id,transaction_id,transaction_type,amount,currency,status,credits,details)
        VALUES('${site}','stripe_invoice_${invoice}','subscription',99,'USD','completed',0,
        '{"stripe_invoice_id":"${invoice}","stripe_customer_id":"cus_legacy701","stripe_subscription_id":"sub_legacy701","stripe_payment_intent_id":"pi_legacy701"}');
      INSERT INTO credit_transactions(site_id,amount,transaction_type,metadata)
        VALUES('${site}',100,'subscription_renewal_recovery','{"stripe_invoice_id":"${invoice}","stripe_event_id":"evt_legacy701"}');`)
    const b = pg.row(site)
    evidence = { site_id: site, customer_id: 'cus_legacy701', subscription_id: 'sub_legacy701', invoice_id: invoice,
      payment_intent_id: 'pi_legacy701', plan: 'foundry', addons_count: 0, billing_interval: 'month',
      billing_reason: 'subscription_cycle', period_start: b.plan_credit_period_start, period_end: b.plan_credit_period_end,
      paid_at: new Date().toISOString(), verified_at: new Date().toISOString(), coverage_verified: true,
      amount: 99, currency: 'USD', refunds_checked: true, disputes_checked: true,
      current_subscription_status: 'active', current_service: { plan: 'foundry', addons_count: 0, billing_interval: 'month' } }
  })
  const snapshot = () => ({ billing: pg.row(site), evidence,
    payment: JSON.parse(pg.db(`SELECT row_to_json(p) FROM payments p WHERE site_id='${site}' AND transaction_id='stripe_invoice_${invoice}';`)),
    grants: JSON.parse(pg.db(`SELECT json_agg(c) FROM credit_transactions c WHERE site_id='${site}' AND amount>0 AND metadata->>'stripe_invoice_id'='${invoice}';`)),
    settlements: JSON.parse(pg.db(`SELECT coalesce(json_agg(s),'[]') FROM stripe_subscription_invoice_settlements s WHERE site_id='${site}';`)),
  })
  const literal = (v: unknown) => v === null ? 'NULL' : `'${String(typeof v === 'object' ? JSON.stringify(v) : v).replace(/'/g, "''")}'`
  const column = (key: string) => key.includes('->>') ? key.replace('->>', "->>'") + "'" : key
  const supabase = {
    rpc: async (name: string, args: { p_site_id: string }) => ({ data: pg.rpc(name, `'${args.p_site_id}'`), error: null }),
    from(table: string) {
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
        select: (value = '*') => { projection = value.replace(/(_exact_\w+):(\w+)::text/g, '$2::text AS $1'); return query },
        update: (value: Record<string, unknown>) => { patch = value; return query },
        eq: (key: string, value: unknown) => { filters.push(`${column(key)}=${literal(value)}`); return query },
        is: (key: string) => { filters.push(`${key} IS NULL`); return query },
        gt: (key: string, value: unknown) => { filters.push(`${key}>${literal(value)}`); return query },
        single: async () => execute(true),
        then: (resolve: (value: unknown) => void) => resolve(execute(false)),
      }
      return query
    },
  }
  it('previews without changes and restores all three channels without adding credits or a marker', async () => {
    const before = snapshot()
    const otherBefore = pg.row(other)
    expect(await repair.runUnmarkedRecovery({ supabase, evidence })).toMatchObject({ status: 'preview', credits_granted: 0 })
    expect(snapshot()).toEqual(before)
    const result = await repair.runUnmarkedRecovery({ supabase, evidence, apply: true })
    expect(result).toMatchObject({ status: 'repaired', credits_granted: 0, settlement_created: false, effective_plan: 'foundry' })
    expect(result.channels.map((channel: { status: string }) => channel.status)).toEqual(Array(3).fill('connected'))
    const after = snapshot()
    for (const field of ['credits_available', 'credits_used', 'plan_credits_used', 'monthly_credits_used',
      'purchased_credits_available', 'plan_credits_available', 'account_balance']) expect(after.billing[field]).toEqual(before.billing[field])
    expect(after.payment).toEqual(before.payment); expect(after.grants).toEqual(before.grants)
    expect(after.settlements).toEqual([]); expect(pg.row(other)).toEqual(otherBefore)
    await repair.runUnmarkedRecovery({ supabase, evidence, apply: true })
    expect(snapshot()).toEqual(after)
  })
  it('rejects stale, foreign, refunded/unverified or ambiguous historical evidence', () => {
    const before = snapshot()
    for (const change of [
      { evidence: { ...evidence, verified_at: new Date(Date.now() - 16 * 60000).toISOString() } },
      { evidence: { ...evidence, site_id: other } },
      { evidence: { ...evidence, period_end: new Date(Date.now() + 86400000).toISOString() } },
      { evidence: { ...evidence, refunds_checked: false } },
      { evidence: { ...evidence, coverage_verified: false } },
      { evidence: { ...evidence, current_subscription_status: 'canceled' } },
      { grants: [...before.grants, ...before.grants] },
      { payment: { ...before.payment, credits: 100 } },
      { settlements: [{ invoice_id: invoice }] },
    ]) expect(() => repair.validateUnmarkedRecovery({ ...before, ...change })).toThrow()
    expect(snapshot()).toEqual(before)
  })
})