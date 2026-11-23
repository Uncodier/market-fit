/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { id, sqlSource } from './connector-postgres-fixture'
import { completeOrdinaryOauth, installOrdinaryOauth } from './ordinary-oauth-fixture'
import { direct, instance, issueDirect, setSql } from './provider-direct-fixture'

const migration = '20261123165000_connector_ask_host_policy.sql'
test('all copies of the Ask host policy migration match', () => {
  for (const repo of ['API', 'makinari-db-scheme']) expect(sqlSource(migration, repo)).toBe(sqlSource(migration))
})

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Real PostgreSQL required')
;(postgresAvailable ? describe : describe.skip)('single Ask host policy on disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => db(`SET ROLE service_role; ${sql}`)
  const status = (connector: string) => JSON.parse(service(`SELECT public.connector_instance_policy_status('${id.site}','${id.owner}','${connector}')`))
  const admitted = (connector: string) => JSON.parse(service(`SELECT public.connector_direct_accounts_v2('${id.site}','${id.admin}','${instance}','${id.agent}','${connector}',NULL)`))
  const save = (connector: string, rev: number, hosts: string, actor = id.owner) => `SELECT public.connector_update_policy(
    '${id.site}','${connector}','${actor}',${rev},ARRAY[]::text[],${hosts},true,true,'all',NULL)`
  const stop = (connector: string, rev: number, epoch: number, actor = id.owner, enabled = false) => `SELECT public.connector_set_ask_policy(
    '${id.site}','${actor}','${connector}',${rev},${epoch},${enabled})`
  beforeAll(pg.start, 30_000)
  afterAll(pg.stop)
  beforeEach(() => installOrdinaryOauth(db), 30_000)

  it('moves an existing opt-out to the host policy and lets the manager turn it on without granting execution', () => {
    const unverified = completeOrdinaryOauth(db, { toolkit: 'supabase', legacy: true }).connectorId
    service(save(unverified, 1, "ARRAY['assistant','direct']"))
    service(stop(unverified, 2, 1))
    const journal = () => db('SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY connector_id,direct_revision),\'[]\') FROM connector_result_private.direct_policy_events e')
    const previous = journal()
    db(sqlSource(migration))
    expect(status(unverified)).toMatchObject({ authorization_mode: 'host_policy', assistant_allowed: false, revision: 3, enabled: false, attested: false })
    expect(db(`SELECT allowed_hosts FROM connector_policies WHERE connector_id='${unverified}'`)).toBe('{direct}')
    expect(() => service(save(unverified, 3, "ARRAY['assistant','direct']", id.member))).toThrow(/denied/)
    expect(() => service(save(unverified, 2, "ARRAY['assistant','direct']"))).toThrow(/revision conflict/i)
    service(save(unverified, 3, "ARRAY['assistant','direct']"))
    expect(status(unverified)).toMatchObject({ assistant_allowed: true, revision: 4, enabled: false, attested: false })
    expect(admitted(unverified)).toEqual([])
    expect(db(`SELECT count(*) FROM connector_result_private.ordinary_oauth_accounts WHERE connector_id='${unverified}'`)).toBe('0')
    expect(journal()).toBe(previous)
  })

  it('supports stopping offline and restoring in the normal editor without changing execution proof', () => {
    issueDirect(db)
    service(setSql(false, 2))
    const delegated = completeOrdinaryOauth(db).connectorId
    expect(admitted(delegated)).toHaveLength(1)
    db(sqlSource(migration))
    expect(admitted(direct)).toEqual([])
    expect(status(direct)).toMatchObject({ assistant_allowed: false, enabled: false, attested: true, revision: 2 })
    service(save(direct, 2, "ARRAY['assistant']"))
    expect(admitted(direct)).toHaveLength(1)
    expect(db('SELECT count(*) FROM connector_result_private.direct_enrollments')).toBe('0')
    expect(() => service(stop(delegated, 1, 1, id.member))).toThrow(/denied/)
    expect(() => service(stop(delegated, 1, 1, id.owner, true))).toThrow(/invalid_parameter_value/)
    expect(() => service(stop(delegated, 1, 2))).toThrow(/revision conflict/i)
    const receipt = JSON.parse(service(stop(delegated, 1, 1)))
    expect(receipt).toMatchObject({ connector_id: delegated, authorization_mode: 'host_policy', assistant_allowed: false, enabled: false, revision: 2, direct_revision: 2 })
    expect(admitted(delegated)).toEqual([])
    service(save(delegated, 2, "ARRAY['assistant']"))
    expect(admitted(delegated)).toHaveLength(1)
    expect(() => service(setSql(true, 3))).toThrow(/permission denied/)
  })
})