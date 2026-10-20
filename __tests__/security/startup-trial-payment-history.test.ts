/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { licensePostgresAvailable } from './site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from './startup-trial-postgres'

const migration = readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261020003000_startup_trial_payment_history.sql'), 'utf8')
it('keeps payment history private and shares server eligibility with activation', () => {
  expect(migration).toContain('SET search_path = public, pg_temp SET row_security = off')
  expect(migration).toContain("p.transaction_type IN ('subscription','credits_purchase')")
  expect(migration).toContain('OR public.site_owner_has_platform_payment(p_site_id)')
  expect(migration).toContain("'offer_eligible',v_state='eligible'")
})

const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
live('Trial offer payment history in disposable PostgreSQL', () => {
  const pg = startupTrialPostgres()
  beforeAll(() => { pg.start(); pg.install(); pg.db(migration) }, 60_000)
  afterAll(() => pg.stop())

  const payment = (site: string, type: string, status: string, amount: number) =>
    pg.db(`INSERT INTO payments(site_id,transaction_type,status,amount) VALUES('${site}','${type}','${status}',${amount});`)

  it('offers and starts a free never-paying owner trial only on explicit activation', () => {
    const { site, actor } = pg.seed(701)
    expect(pg.rpc('get_site_startup_trial', `'${site}'`)).toMatchObject({ state: 'eligible', offer_eligible: true })
    expect(pg.db(`SELECT count(*) FROM site_startup_trials WHERE site_id='${site}';`)).toBe('0')
    expect(pg.startTrial(site, actor)).toMatchObject({ state: 'active', outcome: 'started', offer_eligible: false })
  })

  it.each(['subscription', 'credits_purchase'])('hides and denies a former %s customer even on Toolbox', type => {
    const { site, actor } = pg.seed(type === 'subscription' ? 702 : 703)
    payment(site, type, 'completed', 10)
    expect(pg.rpc('get_site_startup_trial', `'${site}'`)).toMatchObject({ state: 'unavailable', offer_eligible: false })
    expect(pg.startTrial(site, actor).outcome).toBe('not_eligible')
    expect(Number(pg.row(site).trial_credits_available)).toBe(0)
  })

  it('checks the primary owner across archived projects but not another owner', () => {
    const previous = pg.seed(704)
    const selected = pg.seed(705, 1704)
    const foreign = pg.seed(706)
    payment(previous.site, 'subscription', 'refunded', 99)
    pg.db(`UPDATE sites SET archived_at=now() WHERE id='${previous.site}';`)
    expect(pg.rpc('get_site_startup_trial', `'${selected.site}'`).offer_eligible).toBe(false)
    expect(pg.startTrial(selected.site, previous.actor).outcome).toBe('not_eligible')
    expect(pg.rpc('get_site_startup_trial', `'${foreign.site}'`).offer_eligible).toBe(true)
  })

  it('does not count failed payments, free invoices or commerce sales as platform purchases', () => {
    const { site } = pg.seed(707)
    payment(site, 'subscription', 'failed', 99)
    payment(site, 'credits_purchase', 'completed', 0)
    payment(site, 'sale', 'completed', 25)
    expect(pg.rpc('get_site_startup_trial', `'${site}'`).offer_eligible).toBe(true)
  })

  it('recognizes immutable positive invoice settlement proof even if the payment status changed', () => {
    const { site } = pg.seed(708)
    payment(site, 'subscription', 'pending', 99)
    pg.db(`INSERT INTO stripe_subscription_invoice_settlements(invoice_id,site_id,payment_id,customer_id,subscription_id,amount,currency)
      SELECT 'in_history708','${site}',id,'cus_history708','sub_history708',99,'USD' FROM payments
        WHERE site_id='${site}' AND transaction_type='subscription' AND status='pending';`)
    expect(pg.rpc('get_site_startup_trial', `'${site}'`).offer_eligible).toBe(false)
  })

  it('rechecks history when a payment completes after the widget was shown', () => {
    const { site, actor } = pg.seed(709)
    expect(pg.rpc('get_site_startup_trial', `'${site}'`).offer_eligible).toBe(true)
    payment(site, 'credits_purchase', 'completed', 1)
    expect(pg.startTrial(site, actor).outcome).toBe('not_eligible')
  })

  it('does not revoke an already active trial after a subsequent credit purchase', () => {
    const { site, actor } = pg.seed(710)
    pg.startTrial(site, actor)
    payment(site, 'credits_purchase', 'completed', 10)
    expect(pg.rpc('get_site_startup_trial', `'${site}'`)).toMatchObject({ state: 'active', offer_eligible: false, credits_remaining: 50 })
  })

  it('keeps browser roles away from cross-project payment history', () => {
    expect(pg.db(`SELECT has_function_privilege('authenticated','public.site_owner_has_platform_payment(uuid)','EXECUTE'),
      has_function_privilege('anon','public.site_owner_has_platform_payment(uuid)','EXECUTE');`)).toBe('f|f')
  })
})