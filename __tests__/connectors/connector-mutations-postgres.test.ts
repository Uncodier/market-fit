/** @jest-environment node */
import { actorSql, isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { accessSql, id, installConnectorFixture, policySql } from './connector-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip
suite('connector atomic grants and policy in disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  const member = { user_id: id.member, can_view: true, can_use: true }
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installConnectorFixture(db))

  it('upserts only named grants and leaves account/provider state untouched', () => {
    const before = db(`SELECT provider_status,enabled,provider_account_id FROM connectors WHERE id='${id.connector}'`)
    expect(JSON.parse(service(accessSql([member, { user_id: id.viewer, can_view: true, can_use: false }],
      [{ agent_id: id.agent, enabled: true }])))).toEqual({ connector_id: id.connector, revision: 2 })
    service(accessSql([{ ...member, can_use: false }], [], 2))
    expect(db(`SELECT count(*) FROM connector_members WHERE connector_id='${id.connector}'`)).toBe('2')
    expect(db('SELECT enabled FROM connector_agents')).toBe('t')
    expect(db(`SELECT can_view,can_use FROM connector_members WHERE user_id='${id.viewer}'`)).toBe('t|f')
    expect(db(`SELECT provider_status,enabled,provider_account_id FROM connectors WHERE id='${id.connector}'`)).toBe(before)
    expect(db('SELECT count(*) FROM connector_audit_events')).toBe('2')
    expect(db(`SELECT count(*) FROM connector_members WHERE connector_id='${id.hidden}'`)).toBe('0')
  })

  it('allows explicit owner/co-owner use grants but never grants these implicitly', () => {
    service(accessSql([{ ...member, user_id: id.owner }, { ...member, user_id: id.coowner }]))
    expect(db('SELECT count(*) FROM connector_members')).toBe('2')
  })

  it.each([id.member, id.foreign, id.disabled, id.pending])('rejects manager actor %s', actor => {
    expect(() => service(accessSql([member], [], 1, actor))).toThrow('management denied')
    expect(db('SELECT count(*) FROM connector_members')).toBe('0')
  })

  it.each([id.foreign, id.disabled, id.pending, id.blocked, id.restricted])('rejects ineligible member target %s', user => {
    expect(() => service(accessSql([{ ...member, user_id: user }]))).toThrow('member target denied')
    expect(db(`SELECT revision FROM connectors WHERE id='${id.connector}'`)).toBe('1')
  })

  it.each([id.otherAgent, id.inactiveAgent])('rejects foreign or inactive agent %s and rolls back earlier grants', agent => {
    expect(() => service(accessSql([member], [{ agent_id: agent, enabled: true }]))).toThrow('agent target denied')
    expect(db('SELECT count(*) FROM connector_members')).toBe('0')
    expect(db('SELECT count(*) FROM connector_audit_events')).toBe('0')
  })

  it.each([
    [{ ...member, can_view: false }], [member, member], [{ ...member, enabled: true }],
    [{ ...member, user_id: 'not-a-uuid' }], [{ ...member, can_use: 'true' }],
    [{ ...member, expires_at: 'infinity' }], [{ ...member, revoked_at: '2999-01-01T00:00:00Z' }],
  ].map(patch => ({ patch })))('rejects malformed member patch %# atomically', ({ patch }) => {
    expect(() => service(accessSql(patch))).toThrow()
    expect(db('SELECT count(*) FROM connector_members')).toBe('0')
  })

  it('rejects duplicate agents, empty patches and bounded patch overflow', () => {
    const agent = { agent_id: id.agent, enabled: true }
    expect(() => service(accessSql([], [agent, agent]))).toThrow('Duplicate connector agent')
    expect(() => service(accessSql([], []))).toThrow('patch size')
    expect(() => service(accessSql(Array(101).fill(member)))).toThrow('patch size')
    expect(() => service(accessSql([member], [], 1, id.owner, id.connector, id.otherSite))).toThrow('management denied')
  })

  it('revokes retained grants after a user leaves without permitting a new foreign grant', () => {
    service(accessSql([member]))
    db(`DELETE FROM site_members WHERE user_id='${id.member}'`)
    service(accessSql([{ ...member, can_view: false, can_use: false, revoked_at: new Date().toISOString() }], [], 2))
    expect(db('SELECT revoked_at IS NOT NULL FROM connector_members')).toBe('t')
    expect(() => service(accessSql([{ ...member, user_id: id.foreign, can_view: false, can_use: false }], [], 3)))
      .toThrow('member site mismatch')
  })

  it('serializes concurrent access and policy writes using the shared connector revision', async () => {
    const results = await Promise.allSettled([
      pg.concurrent(actorSql(`BEGIN; ${accessSql([member])}; SELECT pg_sleep(0.15); COMMIT`, id.owner, 'service_role')),
      pg.concurrent(actorSql(policySql(), id.owner, 'service_role')),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult
    expect(failure.reason.message).toContain('revision conflict')
    expect(db(`SELECT revision FROM connectors WHERE id='${id.connector}'`)).toBe('2')
    expect(db('SELECT count(*) FROM connector_audit_events')).toBe('1')
  })

  it('updates reviewed policy and optional enable state together without modifying grants', () => {
    service(accessSql([member]))
    const result = JSON.parse(service(policySql(2, "ARRAY['GMAIL_LIST_EMAILS']", "ARRAY['assistant']", 'true')))
    expect(result).toEqual({ connector_id: id.connector, revision: 3, policy_revision: 1 })
    expect(db(`SELECT enabled FROM connectors WHERE id='${id.connector}'`)).toBe('t')
    service(policySql(3, "'{}'::text[]", "'{}'::text[]", 'false'))
    expect(db('SELECT cardinality(allowed_tools),cardinality(allowed_hosts),revision FROM connector_policies')).toBe('0|0|2')
    expect(db('SELECT count(*) FROM connector_members')).toBe('1')
    expect(db(`SELECT enabled FROM connectors WHERE id='${id.connector}'`)).toBe('f')
  })

  it.each(["ARRAY['workflow']", "ARRAY['assistant','assistant']", 'NULL::text[]'])('rejects unsupported policy hosts %s', hosts => {
    expect(() => service(policySql(1, "ARRAY['GMAIL_LIST_EMAILS']", hosts))).toThrow('Invalid connector policy')
    expect(db('SELECT count(*) FROM connector_policies')).toBe('0')
  })

  it.each(["ARRAY['*']", "ARRAY['GMAIL_LIST_EMAILS','GMAIL_LIST_EMAILS']", 'NULL::text[]'])('rejects malformed tools %s', tools => {
    expect(() => service(policySql(1, tools))).toThrow('Invalid connector policy')
  })

  it.each(['revocation', 'provider disabled', 'unverified', 'account inactive'])('refuses enable after %s', state => {
    if (state === 'revocation') db(`UPDATE connectors SET revocation_pending=true WHERE id='${id.connector}'`)
    if (state === 'provider disabled') db(`UPDATE site_connector_providers SET status='disabled' WHERE id='${id.provider}'`)
    if (state === 'unverified') db(`UPDATE connectors SET verified_at=NULL WHERE id='${id.connector}'`)
    if (state === 'account inactive') db(`UPDATE connectors SET provider_status='REVOKED' WHERE id='${id.connector}'`)
    expect(() => service(policySql(1, "'{}'::text[]", "'{}'::text[]", 'true'))).toThrow('not ready')
    expect(db('SELECT count(*) FROM connector_policies')).toBe('0')
  })

  it('forces an enabled account off when provider state or revocation changes', () => {
    service(policySql(1, "'{}'::text[]", "'{}'::text[]", 'true'))
    service(`UPDATE connectors SET revocation_pending=true WHERE id='${id.connector}'`)
    expect(db(`SELECT enabled FROM connectors WHERE id='${id.connector}'`)).toBe('f')
  })

  it('enforces same-site connector/policy/agent relationships below the API', () => {
    expect(() => db(`INSERT INTO connector_policies(site_id,connector_id) VALUES ('${id.otherSite}','${id.connector}')`))
      .toThrow('foreign key constraint')
    expect(() => db(`INSERT INTO connector_agents(site_id,connector_id,agent_id,granted_by)
      VALUES ('${id.site}','${id.connector}','${id.otherAgent}','${id.owner}')`)).toThrow('foreign key constraint')
    expect(() => service(`UPDATE connectors SET site_id='${id.otherSite}' WHERE id='${id.connector}'`)).toThrow('immutable')
    expect(() => service(`UPDATE site_connector_providers SET project_id='another-project' WHERE id='${id.provider}'`))
      .toThrow('immutable')
  })
})