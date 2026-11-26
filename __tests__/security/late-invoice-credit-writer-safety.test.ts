/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { licensePostgresAvailable, licenseUuid } from './site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from './startup-trial-postgres'

const root = path.resolve(__dirname, '../..')
const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

live('unsafe isolated late-invoice credit repairs in disposable PostgreSQL', () => {
  const pg = startupTrialPostgres()
  let next = 980
  beforeAll(() => {
    pg.start()
    pg.install()
    for (const file of [
      '20261020002000_manual_agent_channel_activation.sql',
      '20261021001000_reconcile_paid_coverage_licenses.sql',
      '20261125200000_stripe_late_renewal_access.sql',
    ]) pg.db(read(`supabase/migrations/${file}`))
    for (const file of [
      '20261022000000_image_generation_credit_reservations.sql',
      '20261118230000_withdrawable_credit_consumption.sql',
      '20261118230001_withdrawable_credit_reservations.sql',
    ]) pg.db(read(`../API/supabase/migrations/${file}`))
  }, 60_000)
  afterAll(() => pg.stop())

  const seed = () => {
    const n = next++
    const { site } = pg.seed(n)
    const charge = `ch_safety${n}`
    const invoice = `in_safety${n}`
    const outputs = pg.db(`BEGIN; SET LOCAL TIME ZONE 'UTC';
      UPDATE billing SET stripe_customer_id='cus_safety${n}',stripe_subscription_id='sub_safety${n}',
        subscription_status='past_due' WHERE site_id='${site}';
      SELECT sync_stripe_subscription_state('${site}','cus_safety${n}','sub_safety${n}','sub_safety${n}',
        'canceled',now()-interval '5 days'+interval '1 month',NULL,now()-interval '4 days',false);
      UPDATE billing SET plan_credit_period_start=now()-interval '5 days',plan_credit_period_end=now()+interval '1 day',
        plan_credit_anchor=now()-interval '5 days',plan_credit_source='workflow',
        plan_credits_available=0,plan_credits_used=1,monthly_credits_used=2.48,account_balance=45.91 WHERE site_id='${site}';
      WITH evidence AS (SELECT jsonb_build_object('site_id','${site}', 'customer_id','cus_safety${n}',
        'subscription_id','sub_safety${n}','invoice_id','${invoice}','charge_id','${charge}',
        'payment_intent_id','pi_safety${n}','plan','foundry','addons_count',0,'billing_interval','month',
        'currency','USD','amount_paid',9900,'cancellation_reason','payment_failed','status','paid','amount',99,
        'billing_reason','subscription_cycle','current_subscription_status','canceled','coverage_verified',true,
        'period_start',now()-interval '5 days','period_end',now()-interval '5 days'+interval '1 month',
        'ended_at',now()-interval '4 days','paid_at',now()-interval '3 days') AS data)
      SELECT settle_stripe_subscription_invoice(data) FROM evidence;
      SELECT record_stripe_late_renewal_access(jsonb_build_object('site_id','${site}', 'customer_id','cus_safety${n}',
        'subscription_id','sub_safety${n}','invoice_id','${invoice}','charge_id','${charge}',
        'payment_intent_id','pi_safety${n}','plan','foundry','addons_count',0,'billing_interval','month',
        'currency','USD','amount_paid',9900,'cancellation_reason','payment_failed',
        'period_start',now()-interval '5 days','period_end',now()-interval '5 days'+interval '1 month',
        'ended_at',now()-interval '4 days','paid_at',now()-interval '3 days'));
      COMMIT;`)
    expect(outputs.split('\n')).toEqual([expect.stringContaining('synced'), expect.stringContaining('settled'), 'granted'])
    const unsafeAdjust = () => pg.db(`UPDATE billing SET plan_credits_available=99,plan_credit_allowance=100
      WHERE site_id='${site}';`)
    const plan = () => pg.db(`SELECT plan_credit_allowance,plan_credits_available,plan_credits_used
      FROM billing WHERE site_id='${site}';`).split('|').map(Number)
    const protectedBalances = () => pg.db(`SELECT legacy_credits_available,purchased_credits_available,
      trial_credits_available,account_balance FROM billing WHERE site_id='${site}';`).split('|').map(Number)
    return { site, charge, invoice, unsafeAdjust, plan, protectedBalances, token: licenseUuid(n) }
  }

  const operation = 'a'.repeat(64)
  const request = 'b'.repeat(64)
  const hold = (x: ReturnType<typeof seed>) => pg.rpc('hold_image_generation_credits',
    `'${x.site}','${operation}','${request}','${x.token}',1`)
  const release = (x: ReturnType<typeof seed>) => pg.rpc('release_image_generation_reservation',
    `'${x.site}','${operation}','${x.token}','not_dispatched'`)

  it('a balance-only patch passes the debit check but terminal writes pin the allowance and lose a valid same-period refund', () => {
    const x = seed()
    x.unsafeAdjust()
    pg.db(`UPDATE billing SET updated_at=clock_timestamp() WHERE site_id='${x.site}';`)
    expect(x.plan()).toEqual([1, 99, 1])
    expect(hold(x)).toMatchObject({ success: true, created: true })
    expect(x.plan()).toEqual([1, 98.9, 1.1])
    expect(release(x)).toMatchObject({ success: true, state: 'released' })
    expect(x.plan()).toEqual([1, 98.9, 1])
    expect(x.protectedBalances()).toEqual([7, 40, 0, 45.91])
  })

  it('the reversal tombstone disables the verified access proof but cannot claw back an untracked billing balance', () => {
    const x = seed()
    x.unsafeAdjust()
    expect(pg.db(`SELECT revoke_stripe_late_renewal_access('${x.charge}');`)).toBe('revoked')
    expect(pg.db(`SELECT count(*) FROM stripe_late_renewal_reversals WHERE charge_id='${x.charge}';`)).toBe('1')
    expect(pg.rpc('deduct_credits', `'${x.site}',1,'audio_transcription','synthetic test','{}'`))
      .toMatchObject({ success: true })
    expect(x.plan()).toEqual([1, 98, 2])
    expect(x.protectedBalances()).toEqual([7, 40, 0, 45.91])
  })

  it('ordinary terminal renewal replaces the untracked balance when the ordinary window ends before verified service', () => {
    const x = seed()
    x.unsafeAdjust()
    pg.db(`UPDATE billing SET plan_credit_period_start=now()-interval '40 days',
      plan_credit_period_end=now()-interval '1 second' WHERE site_id='${x.site}';`)
    expect(pg.db(`SELECT period_end>clock_timestamp() FROM stripe_late_renewal_access WHERE invoice_id='${x.invoice}';`)).toBe('t')
    expect(pg.rpc('renew_site_plan_credits', `'${x.site}'`)).toMatchObject({ outcome: 'reset' })
    expect(x.plan()).toEqual([1, 1, 0])
  })

  it('the image reservation refund checks the billing window, not the verified invoice expiry or charge reversal', () => {
    const x = seed()
    pg.db(`UPDATE billing SET plan_credits_available=1,plan_credits_used=0 WHERE site_id='${x.site}';`)
    expect(hold(x)).toMatchObject({ success: true, created: true })
    // In the disposable fixture, advance just the entitlement deadline. The
    // unexpired billing window now represents an incorrectly extended patch.
    pg.db(`UPDATE stripe_late_renewal_access SET period_end=clock_timestamp()-interval '1 second'
      WHERE invoice_id='${x.invoice}';
      SELECT revoke_stripe_late_renewal_access('${x.charge}');`)
    expect(x.plan()).toEqual([1, 0.9, 0.1])
    expect(release(x)).toMatchObject({ success: true, state: 'released' })
    expect(x.plan()).toEqual([1, 1, 0])
  })
})