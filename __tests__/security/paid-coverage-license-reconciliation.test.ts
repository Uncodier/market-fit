/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { licensePostgresAvailable } from './site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from './startup-trial-postgres'

const root = path.resolve(__dirname, '../..')
const migration = readFileSync(path.join(root, 'supabase/migrations/20261021001000_reconcile_paid_coverage_licenses.sql'), 'utf8')
const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip

live('paid coverage license reconciliation in disposable PostgreSQL', () => {
  const pg = startupTrialPostgres()
  let nextId = 601
  beforeAll(() => {
    pg.start()
    pg.install()
    pg.db(readFileSync(path.join(root, 'supabase/migrations/20261020002000_manual_agent_channel_activation.sql'), 'utf8'))
    pg.db(migration)
  }, 60000)
  afterAll(() => pg.stop())

  const channels = (site: string) => JSON.parse(pg.db(
    `SELECT channels->'connections' FROM settings WHERE site_id='${site}';`,
  )) as Array<{ id: string; status: string; license_suspended: boolean; _license: { order: number; manually_disabled?: boolean } }>
  const seed = () => {
    const { site, actor } = pg.seed(nextId++)
    pg.db(`UPDATE billing SET plan='foundry' WHERE site_id='${site}';
      UPDATE settings SET channels='{"connections":[
        {"id":"voice","type":"voice","status":"connected"},
        {"id":"email","type":"email","status":"connected"},
        {"id":"whatsapp","type":"whatsapp","status":"connected"}
      ]}' WHERE site_id='${site}';
      UPDATE billing SET stripe_customer_id='cus_${site}',stripe_subscription_id='sub_${site}',
        subscription_status='active' WHERE site_id='${site}';`)
    expect(channels(site).map(channel => channel.status)).toEqual(Array(3).fill('license_suspended'))
    return { site, actor }
  }
  const cover = (site: string) => pg.db(`UPDATE billing SET
    paid_subscription_invoice_id='in_${site.replace(/-/g, '')}',paid_subscription_plan='foundry',paid_subscription_addons_count=0,
    paid_subscription_period_start=now()-interval '1 day',paid_subscription_period_end=now()+interval '29 days',
    paid_subscription_paid_at=now() WHERE site_id='${site}';`)
  const financialRecords = (site: string) => pg.db(`SELECT jsonb_build_object(
    'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM payments p WHERE site_id='${site}'),
    'ledger',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM credit_transactions c WHERE site_id='${site}'));`)

  it('restores three stored channels when paid coverage arrives without changing Foundry or granting credits', () => {
    const { site } = seed()
    const other = seed()
    const before = pg.row(site)
    const recordsBefore = financialRecords(site)
    const orders = channels(site).map(channel => channel._license.order)
    const otherChannels = channels(other.site)
    cover(site)
    expect(pg.db(`SELECT effective_site_plan('${site}');`)).toBe('foundry')
    expect(channels(site).map(channel => channel.status)).toEqual(Array(3).fill('connected'))
    expect(channels(site).every(channel => !channel.license_suspended)).toBe(true)
    expect(channels(site).map(channel => channel._license.order)).toEqual(orders)
    expect(channels(other.site)).toEqual(otherChannels)
    const after = pg.row(site)
    for (const field of ['plan', 'addons_count', 'credits_available', 'credits_used', 'plan_credits_available',
      'plan_credits_used', 'monthly_credits_used', 'purchased_credits_available', 'legacy_credits_available',
      'trial_credits_available', 'account_balance']) expect(after[field]).toEqual(before[field])
    expect(financialRecords(site)).toBe(recordsBefore)
  })

  it('preserves explicit manual disable while restoring license-suspended channels', () => {
    const { site, actor } = seed()
    expect(pg.rpc('set_site_agent_channel_enabled', `'${site}','email',false,'${actor}'`).success).toBe(true)
    cover(site)
    expect(channels(site).map(channel => channel.status)).toEqual(['connected', 'disabled', 'connected'])
    expect(channels(site)[1]._license.manually_disabled).toBe(true)
  })

  it.each([
    "paid_subscription_invoice_id=NULL,paid_subscription_plan=NULL,paid_subscription_addons_count=NULL,paid_subscription_period_start=NULL,paid_subscription_period_end=NULL,paid_subscription_paid_at=NULL",
    "paid_subscription_period_start=now()+interval '1 day'",
    "paid_subscription_period_end=now()-interval '1 second',paid_subscription_period_start=now()-interval '30 days'",
    "subscription_status='canceled'",
    "status='inactive'",
  ])('suspends stored channels on coverage loss: %s', change => {
    const { site } = seed()
    cover(site)
    expect(channels(site).map(channel => channel.status)).toEqual(Array(3).fill('connected'))
    pg.db(`UPDATE billing SET ${change} WHERE site_id='${site}';`)
    expect(pg.db(`SELECT effective_site_plan('${site}');`)).toBe('commission')
    expect(channels(site).map(channel => channel.status)).toEqual(Array(3).fill('license_suspended'))
  })

  it('skips resource writes for usage-only changes and identical coverage retries', () => {
    const { site } = seed()
    cover(site)
    pg.db(`CREATE TABLE test_coverage_settings_writes(site_id uuid);
      CREATE FUNCTION test_coverage_settings_write() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN INSERT INTO test_coverage_settings_writes VALUES(NEW.site_id); RETURN NEW; END; $$;
      CREATE TRIGGER test_coverage_settings_write AFTER UPDATE ON settings
        FOR EACH ROW EXECUTE FUNCTION test_coverage_settings_write();`)
    try {
      const before = channels(site)
      expect(pg.rpc('deduct_credits', `'${site}',1,'usage','Local coverage regression','{}'`).success).toBe(true)
      pg.db(`UPDATE billing SET paid_subscription_invoice_id=paid_subscription_invoice_id,
        paid_subscription_period_start=paid_subscription_period_start,
        paid_subscription_period_end=paid_subscription_period_end WHERE site_id='${site}';`)
      expect(pg.db('SELECT count(*) FROM test_coverage_settings_writes;')).toBe('0')
      expect(channels(site)).toEqual(before)
    } finally {
      pg.db(`DROP TRIGGER test_coverage_settings_write ON settings;
        DROP FUNCTION test_coverage_settings_write(); DROP TABLE test_coverage_settings_writes;`)
    }
  })

  it('is rerunnable without backfilling accounts or changing function privileges', () => {
    const { site } = seed()
    const before = channels(site)
    const privileges = () => pg.db(`SELECT proowner,proacl,prosecdef,proconfig
      FROM pg_proc WHERE oid='public.billing_license_changed()'::regprocedure;`)
    const beforePrivileges = privileges()
    pg.db(migration)
    expect(privileges()).toBe(beforePrivileges)
    expect(channels(site)).toEqual(before)
    expect(pg.db(`SELECT effective_site_plan('${site}');`)).toBe('commission')
  })
})