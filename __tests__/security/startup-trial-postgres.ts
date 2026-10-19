import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { licensePostgres, licenseUuid } from './site-license-postgres'

const root = path.resolve(__dirname, '../..')
const api = path.resolve(root, '../API/supabase/migrations')
const read = (file: string) => readFileSync(file, 'utf8')
export const trialMigrations = [
  '20261019220000_startup_trial_schema.sql',
  '20261019220001_startup_trial_credit_writers.sql',
  '20261019220002_startup_trial_model_reservations.sql',
  '20261019220003_startup_trial_licensing.sql',
  '20261019220004_startup_trial_resource_projection.sql',
  '20261019233000_preserve_trial_renewal_rpc_contract.sql',
  '20261019233001_license_legacy_voice_statuses.sql',
]
export const trialMigrationSql = trialMigrations.map(name => read(path.join(root, 'supabase/migrations', name))).join('\n')

// Exact shared financial migrations, not the older simplified licensing fixture.
// This suite requires the coordinated sibling API checkout, never credentials.
const prerequisites = [
  '20261003230000_credit_buckets_and_monthly_reset.sql',
  '20261003230001_stripe_plan_credit_reset.sql',
  '20261003230002_classified_credit_operations.sql',
  '20261005230000_exact_credit_accounting_precision.sql',
  '20261007003000_remove_signup_credit_bonus.sql',
  '20261007180000_annual_subscription_credit_periods.sql',
  '20261008210000_preserve_canceled_subscription_credit_usage.sql',
  '20261009040000_one_monthly_credit_per_addon.sql',
  '20261009070000_preserve_paid_addon_credit_windows.sql',
  '20261014230000_openrouter_actual_cost_ledger.sql',
  '20261014230001_agent_actual_cost_settlement.sql',
]
const prerequisitePaths = prerequisites.map(name => path.join(api, name))
export const startupTrialPrerequisitesAvailable = prerequisitePaths.every(file => existsSync(file))

export function startupTrialPostgres() {
  const pg = licensePostgres()
  const install = () => {
    if (!startupTrialPrerequisitesAvailable) {
      throw new Error('Startup trial PostgreSQL integration requires the sibling API migration checkout')
    }
    pg.db(read(path.join(root, '__tests__/fixtures/startup-trial-bootstrap.sql')))
    for (const file of prerequisitePaths) pg.db(read(file))
    pg.db(read(path.join(root, 'supabase/migrations/20261007220000_site_license_enforcement.sql')))
    pg.db(read(path.join(root, 'supabase/migrations/20261007220001_atomic_partner_license.sql')))
    pg.db(read(path.join(root, 'supabase/migrations/20261007223500_manual_member_deactivation.sql')))
    pg.db(read(path.join(root, 'supabase/migrations/20261009080000_free_plan_paid_addons.sql')))
    for (const name of trialMigrations) pg.db(read(path.join(root, 'supabase/migrations', name)))
  }
  const seed = (id: number, owner = id + 1000) => {
    const site = licenseUuid(id); const actor = licenseUuid(owner)
    pg.db(`INSERT INTO sites(id,user_id) VALUES('${site}','${actor}');
      SELECT initialize_site_billing('${site}'); INSERT INTO settings(site_id) VALUES('${site}');
      UPDATE billing SET purchased_credits_available=40,legacy_credits_available=7,
        credits_available=plan_credits_available+47,account_balance=17.42 WHERE site_id='${site}';`)
    return { site, actor }
  }
  const rpc = (name: string, args: string) => JSON.parse(pg.db(`SELECT public.${name}(${args});`))
  const startTrial = (site: string, actor: string) => rpc('start_site_startup_trial', `'${site}','${actor}'`)
  const row = (site: string) => JSON.parse(pg.db(`SELECT row_to_json(billing) FROM billing WHERE site_id='${site}';`))
  const expire = (site: string) => pg.db(`UPDATE site_startup_trials SET started_at=statement_timestamp()-interval '360 hours 1 second',
    ends_at=statement_timestamp()-interval '1 second' WHERE site_id='${site}';
    UPDATE billing SET trial_started_at=t.started_at,trial_ends_at=t.ends_at FROM site_startup_trials t WHERE billing.site_id=t.site_id AND t.site_id='${site}';`)
  return { ...pg, install, seed, rpc, startTrial, row, expire }
}