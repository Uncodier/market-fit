/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { licensePostgresAvailable, licenseUuid } from './site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from './startup-trial-postgres'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const audit = read('scripts/audit-late-invoice-plan-credits.sql')
const literal = (value: object) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`

test('the operator SQL takes explicit IDs and runs entirely in a read-only snapshot', () => {
  expect(audit).toContain('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;')
  expect(audit).toContain(":'site_id'::uuid")
  expect(audit).toContain(":'invoice_id'::text")
  expect(audit.trimEnd()).toMatch(/ROLLBACK;$/)
})

const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
live('late-paid plan credit recovery audit on disposable PostgreSQL', () => {
  const pg = startupTrialPostgres()
  let nextId = 890

  beforeAll(() => {
    pg.start()
    pg.install()
    for (const file of ['20261020002000_manual_agent_channel_activation.sql',
      '20261021001000_reconcile_paid_coverage_licenses.sql', '20261125200000_stripe_late_renewal_access.sql',
      '20261125213000_individual_late_payment_access_month.sql']) {
      pg.db(read(`supabase/migrations/${file}`))
    }
    for (const file of ['20261022000000_image_generation_credit_reservations.sql',
      '20261118230000_withdrawable_credit_consumption.sql', '20261118230001_withdrawable_credit_reservations.sql']) {
      pg.db(read(`../API/supabase/migrations/${file}`))
    }
  }, 60000)
  afterAll(() => pg.stop())

  const seed = () => {
    const n = nextId++
    const { site } = pg.seed(n)
    const evidence = {
      site_id: site, customer_id: `cus_audit${n}`, subscription_id: `sub_audit${n}`,
      invoice_id: `in_audit${n}`, charge_id: `ch_audit${n}`, payment_intent_id: `pi_audit${n}`,
      plan: 'foundry', addons_count: 0, billing_interval: 'month', cancellation_reason: 'payment_failed',
      amount_paid: 9900, currency: 'USD', ...JSON.parse(pg.db(`SET TIME ZONE 'UTC';
      WITH w AS (SELECT date_trunc('second',now())-interval '5 days' AS s)
      SELECT jsonb_build_object('period_start',s,'period_end',s+interval '1 month',
        'ended_at',s+interval '1 hour','paid_at',s+interval '1 day',
        'credit_end',s+interval '1 month'-interval '14 hours 31 minutes 29 seconds') FROM w;`)) as
        { period_start: string; period_end: string; ended_at: string; paid_at: string; credit_end: string },
    }
    const { customer_id, subscription_id, period_start, period_end, credit_end, ended_at, invoice_id } = evidence
    pg.db(`UPDATE billing SET stripe_customer_id='${customer_id}',stripe_subscription_id='${subscription_id}',
        subscription_status='past_due',purchased_credits_available=0,legacy_credits_available=0,account_balance=47.39
        WHERE site_id='${site}';
      SELECT sync_stripe_subscription_state('${site}','${customer_id}','${subscription_id}','${subscription_id}',
        'canceled','${period_end}',NULL,'${ended_at}',false);
      UPDATE billing SET plan_credit_period_start='${period_start}',plan_credit_period_end='${credit_end}',
        plan_credit_source='workflow',plan_credit_anchor='${period_start}' WHERE site_id='${site}';
      DELETE FROM credit_transactions WHERE site_id='${site}';
      INSERT INTO credit_transactions(site_id,amount,transaction_type,metadata,created_at) VALUES
        ('${site}',-52.230963,'plan_credit_expiry','{"credit_bucket":"plan"}','${period_start}'::timestamptz+interval '1 day'),
        ('${site}',0,'plan_credit_reset',jsonb_build_object('credit_bucket','plan','source','workflow','allowance',1,
          'expired_credits',1,'period_start','${period_start}','period_end','${credit_end}'),now()-interval '1 hour');`)
    const operation = 'a'.repeat(64), hash = 'b'.repeat(64), token = licenseUuid(n)
    expect(pg.rpc('hold_image_generation_credits', `'${site}','${operation}','${hash}','${token}',1`)).toMatchObject({ success: true })
    pg.db(`SELECT public.dispatch_image_generation_reservation('${site}','${operation}','${token}');`)
    expect(pg.rpc('settle_image_generation_reservation', `'${site}','${operation}','${token}',1,'test-${n}','test'`)).toMatchObject({ state: 'settled' })
    const settle = () => pg.rpc('settle_stripe_subscription_invoice', literal({ ...evidence,
      status: 'paid', amount: 99, billing_reason: 'subscription_cycle', current_subscription_status: 'canceled', coverage_verified: true }))
    expect(settle()).toMatchObject({ outcome: 'settled', credits_granted: 0 })
    expect(pg.db(`SELECT public.record_stripe_late_renewal_access(${literal(evidence)});`)).toBe('granted')
    pg.db(`INSERT INTO public.late_payment_access_months(invoice_id) VALUES ('${invoice_id}');
      SELECT deduct_credits('${site}',1.164,'audio_transcription','test','{}');
      SELECT deduct_credits('${site}',1.216,'audio_transcription','test','{}');`)
    return { evidence, site, invoice_id, settle }
  }

  const report = (site: string, invoiceId: string) =>
    pg.db(`\\set site_id '${site}'\n\\set invoice_id '${invoiceId}'\n${audit}`).split('\n')[0].split('|')
  const snapshot = (site: string) => pg.db(`SELECT jsonb_build_array(
    (SELECT to_jsonb(b) FROM billing b WHERE site_id='${site}'),
    (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM credit_transactions t WHERE site_id='${site}'));`)

  it('reconciles the 99 unused plan credits once per snapshot without restoring wallet or replaying the invoice', () => {
    const { site, invoice_id, settle, evidence } = seed()
    const before = snapshot(site)
    const result = report(site, invoice_id)
    expect(result.slice(2, 3)).toEqual(['reconciled_no_safe_existing_writer'])
    expect(Date.parse(result[5])).toBe(Date.parse(evidence.period_end))
    expect(result.slice(18, 27).map(Number)).toEqual([45.91, 0, 100, 99, 1, 0, 0, 0, 1.48])
    expect(report(site, invoice_id)).toEqual(result)
    expect(snapshot(site)).toBe(before)
    expect(settle()).toMatchObject({ credits_granted: 0 })
    expect(snapshot(site)).toBe(before)
  })

  it('blocks missing or unbound evidence, ambiguous ledger, and reversals', () => {
    const { site, invoice_id, evidence } = seed()
    expect(report(licenseUuid(998), invoice_id)[2]).toBe('blocked_missing_bound_proof')
    pg.db(`INSERT INTO credit_transactions(site_id,amount,transaction_type,metadata)
      VALUES ('${site}',-0.2,'unclassified_usage','{}');`)
    expect(report(site, invoice_id)[2]).toBe('blocked_ledger_review')
    pg.db(`SELECT public.revoke_stripe_late_renewal_access('${evidence.charge_id}');`)
    expect(report(site, invoice_id)[2]).toBe('blocked_reversed')
  })

  it('blocks at the invoice service deadline even while the separate workspace extension is valid', () => {
    const { site, invoice_id } = seed()
    // Simulate a historical snapshot after the boundary without a wall-clock sleep.
    pg.db(`WITH expired AS (
      UPDATE public.stripe_late_renewal_access SET period_end=now()-interval '1 second'
      WHERE invoice_id='${invoice_id}' RETURNING invoice_id,period_end
    ) UPDATE public.stripe_subscription_invoice_settlements s
      SET verified_credit_coverage=jsonb_set(s.verified_credit_coverage,'{period_end}',to_jsonb(e.period_end))
      FROM expired e WHERE s.invoice_id=e.invoice_id;`)
    expect(pg.db(`SELECT public.late_payment_access_end(a)>clock_timestamp()
      FROM public.stripe_late_renewal_access a WHERE invoice_id='${invoice_id}';`)).toBe('t')
    expect(report(site, invoice_id)[2]).toBe('blocked_outside_paid_service')
  })

  it.each(['anon', 'authenticated', 'service_role'])('cannot audit protected evidence as %s', (role) => {
    expect(() => pg.db(`SET ROLE ${role};\n\\set site_id '${licenseUuid(998)}'\n\\set invoice_id 'in_unknown'\n${audit}`))
      .toThrow(/permission denied/)
  })

  it('proves the reset RPC and terminal allowance guard cannot safely recover the same window', () => {
    const { site, evidence } = seed()
    const before = snapshot(site)
    expect(pg.rpc('reset_site_plan_credit_period', `'${site}','${evidence.period_start}',
      '${evidence.period_end}',100,'stripe_invoice:${evidence.invoice_id}'`)).toMatchObject({ outcome: 'not_due', credits_granted: 0 })
    expect(snapshot(site)).toBe(before)
    // Even an operator's allowance update is pinned to one by the actual BEFORE trigger.
    expect(Number(pg.db(`UPDATE billing SET plan_credit_allowance=100 WHERE site_id='${site}' RETURNING plan_credit_allowance;`))).toBe(1)
  })
})