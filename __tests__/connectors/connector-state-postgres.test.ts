/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { id, installConnectorFixture } from './connector-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip
suite('connector provider state admission in disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const state = (revision = 1, status = 'ACTIVE', pending = false, verified = true, actor = id.owner) =>
    `SELECT connector_set_provider_state('${id.site}','${id.connector}','${actor}',${revision},'${status}',${pending},${verified},ARRAY['mail.read'],'rev-1')`
  const service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installConnectorFixture(db))

  it('blocks local dispatch before remote revocation, preserves intent through sync', () => {
    service(`UPDATE connectors SET enabled=true WHERE id='${id.connector}'`)
    const pending = JSON.parse(service(state(1, 'ACTIVE', true, false)))
    expect(pending).toMatchObject({ enabled: false, revocation_pending: true, revision: 2, verified_at: null })
    expect(() => service(state(2, 'ACTIVE', false, true))).toThrow('revocation is not confirmed')
    const synced = JSON.parse(service(state(2, 'ACTIVE', true, true)))
    expect(synced).toMatchObject({ enabled: false, revocation_pending: true, revision: 3 })
    const revoked = JSON.parse(service(state(3, 'REVOKED', false, true)))
    expect(revoked).toMatchObject({ enabled: false, revocation_pending: false, provider_status: 'REVOKED', revision: 4 })
    expect(() => service(state(4, 'ACTIVE', false, true))).toThrow('cannot be restored')
  })

  it('never re-enables disabled accounts and disables inactive ones', () => {
    expect(JSON.parse(service(state())).enabled).toBe(false)
    service(`UPDATE connectors SET enabled=true WHERE id='${id.connector}'`)
    expect(JSON.parse(service(state(2, 'EXPIRED'))).enabled).toBe(false)
  })

  it('rejects stale revisions, nonmanagers and direct browser use', () => {
    expect(() => service(state(2))).toThrow('revision conflict')
    expect(() => service(state(1, 'ACTIVE', false, true, id.member))).toThrow('management denied')
    expect(() => pg.call(state(), id.owner)).toThrow('permission denied')
    expect(db('SELECT count(*) FROM connector_audit_events')).toBe('0')
  })

  it('records only committed revision outcomes', () => {
    service(state())
    expect(db('SELECT event_type,revision FROM connector_audit_events')).toBe('provider_state_updated|2')
    expect(() => service(state())).toThrow('revision conflict')
    expect(db('SELECT count(*) FROM connector_audit_events')).toBe('1')
  })

  it('claims remote revocation exactly once after a durable local disable', () => {
    service(state(1, 'ACTIVE', true, false))
    expect(db(`SELECT revocation_dispatched FROM connectors WHERE id='${id.connector}'`)).toBe('f')
    const claim = `SELECT connector_claim_revocation('${id.site}','${id.connector}','${id.owner}',2,'rev-1')`
    expect(JSON.parse(service(claim))).toMatchObject({ revision: 3, enabled: false, revocation_pending: true, revocation_dispatched: true })
    expect(() => service(claim)).toThrow('revision conflict')
    expect(() => service(`SELECT connector_claim_revocation('${id.site}','${id.connector}','${id.owner}',3,'rev-1')`)).toThrow('cannot be dispatched')
    expect(() => pg.call(claim,id.owner)).toThrow('permission denied')
  })

  it('requires the current provider credential revision for verified state', () => {
    service(`UPDATE site_connector_providers SET credential_revision='rev-2' WHERE id='${id.provider}'`)
    expect(() => service(state())).toThrow('credentials changed')
    expect(JSON.parse(service(state(1, 'ACTIVE', true, false))).enabled).toBe(false)
  })

  it('holds manager authority stable until a state mutation commits', async () => {
    const mutation = pg.concurrent(`SET application_name='connector-manager-mutation'; BEGIN;
      SET ROLE service_role; ${state(1,'ACTIVE',false,true,id.admin)}; SELECT pg_sleep(1.2); COMMIT;`)
    for (let attempt=0; attempt<100; attempt++) {
      if (db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='connector-manager-mutation' AND wait_event='PgSleep'`) === '1') break
      await new Promise(resolve => setTimeout(resolve, 15))
    }
    expect(db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='connector-manager-mutation' AND wait_event='PgSleep'`)).toBe('1')
    const revoke = pg.concurrent(`SET application_name='connector-manager-removal'; UPDATE site_members SET status='inactive' WHERE site_id='${id.site}' AND user_id='${id.admin}'`)
    for (let attempt=0; attempt<60; attempt++) {
      if (db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='connector-manager-removal' AND wait_event_type='Lock'`) === '1') break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='connector-manager-removal' AND wait_event_type='Lock'`)).toBe('1')
    await Promise.all([mutation,revoke])
    expect(() => service(state(2,'ACTIVE',false,true,id.admin))).toThrow('management denied')
  })

  it('returns only eligible same-site manager access options', () => {
    const options = JSON.parse(service(`SELECT connector_access_options('${id.site}','${id.owner}')`))
    expect(options.member_options.map((row: { id: string }) => row.id)).toEqual(expect.arrayContaining([id.owner,id.admin,id.member,id.coowner]))
    expect(options.member_options.map((row: { id: string }) => row.id)).not.toEqual(expect.arrayContaining([id.foreign,id.blocked,id.restricted]))
    expect(options.agent_options.map((row: { id: string }) => row.id)).toEqual([id.agent])
    expect(() => service(`SELECT connector_access_options('${id.site}','${id.member}')`)).toThrow('management denied')
    expect(() => pg.call(`SELECT connector_access_options('${id.site}','${id.owner}')`,id.owner)).toThrow('permission denied')
  })
})