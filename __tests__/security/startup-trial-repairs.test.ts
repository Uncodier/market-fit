/** @jest-environment node */
import { licensePostgresAvailable } from './site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from './startup-trial-postgres'
import { existsSync } from 'node:fs'
import path from 'node:path'

const workerPath = path.resolve(__dirname, '../../../Workflows/src/temporal/services/supabase-impl/billing.ts')
const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable && existsSync(workerPath) ? describe : describe.skip
live('Startup review repairs in disposable PostgreSQL', () => {
  const pg = startupTrialPostgres()
  beforeAll(() => { pg.start(); pg.install() }, 60_000)
  afterAll(() => pg.stop())

  const renewThroughWorker = async (site: string) => {
    const result = pg.rpc('renew_site_plan_credits', `'${site}'`)
    const { renewSitePlanCredits } = jest.requireActual<{
      renewSitePlanCredits: (client: { rpc: ReturnType<typeof jest.fn> }, siteId: string) => Promise<unknown>
    }>(workerPath)
    const client = { rpc: jest.fn().mockResolvedValue({ data: result, error: null }) }
    expect(await renewSitePlanCredits(client, site)).toEqual(result)
    return result
  }

  it('preserves the actual Temporal RPC contract without a trial and inside an active trial', async () => {
    const { site, actor } = pg.seed(601)
    expect(await renewThroughWorker(site)).toMatchObject({ outcome: 'not_due', credits_granted: 0, credits_available: 48 })
    pg.startTrial(site, actor)
    pg.rpc('deduct_credits', `'${site}',12,'usage','Trial contract regression','{}'`)
    expect(await renewThroughWorker(site)).toMatchObject({ outcome: 'not_due', credits_granted: 0, credits_available: 86 })
    pg.db(`UPDATE billing SET plan_credit_period_start=now()-interval '2 months',
      plan_credit_period_end=now()-interval '1 month' WHERE site_id='${site}';`)
    expect(await renewThroughWorker(site)).toMatchObject({ outcome: 'reset', credits_granted: 1, credits_available: 86 })
    expect(Number(pg.row(site).trial_credits_available)).toBe(38)
  })

  it('expires unused trial credits without breaking the renewal contract or purchased money', async () => {
    const { site, actor } = pg.seed(602)
    pg.startTrial(site, actor)
    pg.expire(site)
    expect(await renewThroughWorker(site)).toMatchObject({ outcome: 'not_due', credits_granted: 0, credits_available: 48 })
    expect(pg.row(site)).toMatchObject({ purchased_credits_available: 40, legacy_credits_available: 7, account_balance: 17.42 })
  })

  it.each(['active', 'synced'])('counts legacy Voice status %s against Foundry quotas and suspends it after expiry', status => {
    const { site, actor } = pg.seed(status === 'active' ? 603 : 604)
    pg.startTrial(site, actor)
    const connections = [1, 2, 3, 4].map(id => ({ id: `voice-${id}`, type: 'voice', status, zavu_sender_id: `sender-${id}` }))
    pg.db(`UPDATE settings SET channels='${JSON.stringify({ connections })}' WHERE site_id='${site}';`)
    const live = pg.rpc('get_site_licensed_resources', `'${site}'`).channels.connections
    expect(live.map((row: { status: string }) => row.status)).toEqual([status, status, status, 'license_suspended'])
    expect(live.map((row: { license_suspended: boolean }) => row.license_suspended)).toEqual([false, false, false, true])
    pg.expire(site)
    expect(pg.rpc('get_site_licensed_resources', `'${site}'`).channels.connections.every(
      (row: { status: string; license_suspended: boolean }) => row.status === 'license_suspended' && row.license_suspended,
    )).toBe(true)
    pg.db(`UPDATE billing SET plan='foundry' WHERE site_id='${site}';`)
    expect(pg.rpc('get_site_licensed_resources', `'${site}'`).channels.connections.map(
      (row: { status: string }) => row.status,
    )).toEqual([status, status, status, 'license_suspended'])
  })

  it('does not license active/synced statuses on unrelated channel types', () => {
    const { site, actor } = pg.seed(605)
    pg.startTrial(site, actor)
    const connections = [{ id: 'voice', type: 'voice', status: 'active' },
      { id: 'telegram', type: 'telegram', status: 'active' }, { id: 'email', type: 'email', status: 'synced' }]
    pg.db(`UPDATE settings SET channels='${JSON.stringify({ connections })}' WHERE site_id='${site}';`)
    expect(pg.rpc('get_site_licensed_resources', `'${site}'`).channels.connections.map(
      (row: { status: string }) => row.status,
    )).toEqual(['active', 'active', 'synced'])
    expect(pg.db(`SELECT has_function_privilege('authenticated','public.get_site_licensed_resources(uuid)','EXECUTE');`)).toBe('f')
  })
})