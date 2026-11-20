/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { finalizeSql, id, insertAttempt, installConnectorFixture, sqlSource, toolAccessMigration } from './connector-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip
suite('connector tool mode in socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  function save(revision: number, trailingSql: string, connector = id.connector, actor = id.owner) {
    return `SELECT connector_update_policy('${id.site}','${connector}','${actor}',${revision},
      ARRAY['CUSTOM_READ'],ARRAY['direct'],true${trailingSql})`
  }
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installConnectorFixture(db, toolAccessMigration))

  it('preserves every prior policy field and does not reinitialize a completed OAuth attempt', () => {
    insertAttempt(db)
    const connector = JSON.parse(service(finalizeSql())).id
    service(save(1, '', connector))
    service(save(1, ',NULL'))
    const snapshot = () => db(`SELECT jsonb_agg(to_jsonb(p) - 'tool_access_mode' ORDER BY connector_id) FROM connector_policies p`)
    const before = snapshot()
    db(sqlSource(toolAccessMigration))
    expect(JSON.parse(service(finalizeSql())).id).toBe(connector)
    expect(snapshot()).toBe(before)
    expect(db('SELECT DISTINCT tool_access_mode FROM connector_policies')).toBe('selected')
    expect(db(`SELECT count(*) FROM connector_policies WHERE connector_id='${id.hidden}'`)).toBe('0')
    expect(db(`INSERT INTO connector_policies(site_id,connector_id) VALUES ('${id.site}','${id.hidden}')
      RETURNING tool_access_mode`)).toBe('selected')
  })

  it.each(['', ',NULL'])('switches an existing policy atomically; legacy saves reset all to selected (%s)', trailing => {
    service(save(1, ''))
    db(sqlSource(toolAccessMigration))
    expect(JSON.parse(service(save(2, ",p_tool_access_mode => 'all'", id.connector, id.admin))))
      .toMatchObject({ revision: 3, policy_revision: 2 })
    expect(() => service(save(2, ",NULL,'selected'"))).toThrow('revision conflict')
    expect(db('SELECT tool_access_mode FROM connector_policies')).toBe('all')
    service(save(3, trailing))
    expect(db('SELECT tool_access_mode, allowed_tools, allowed_hosts, revision FROM connector_policies'))
      .toBe('selected|{CUSTOM_READ}|{direct}|3')
    expect(db("SELECT count(*) FROM connector_audit_events WHERE event_type='policy_updated'")).toBe('3')
  })

  it('lets the manager explicitly restrict a new connection without a callback reopening access', () => {
    db(sqlSource(toolAccessMigration))
    insertAttempt(db)
    const connector = JSON.parse(service(finalizeSql())).id
    service(save(1, ",NULL,'selected'", connector))
    expect(JSON.parse(service(finalizeSql())).id).toBe(connector)
    expect(db('SELECT tool_access_mode,allowed_tools,allowed_hosts,require_approval,revision FROM connector_policies'))
      .toBe('selected|{CUSTOM_READ}|{direct}|t|2')
    expect(() => db("UPDATE connector_policies SET tool_access_mode='other'")).toThrow('check constraint')
  })

  it('keeps mode writes within the service-only manager RPC and mode reads within policy RLS', () => {
    db(sqlSource(toolAccessMigration))
    const sql = save(1, ",NULL,'all'")
    for (const role of ['authenticated', 'anon'] as const) {
      expect(() => pg.call(sql, id.owner, role)).toThrow('permission denied')
    }
    for (const role of ['authenticated', 'service_role'] as const) {
      expect(() => pg.call("UPDATE connector_policies SET tool_access_mode='all'", id.owner, role)).toThrow('permission denied')
    }
    expect(() => service(save(1, ",NULL,'all'", id.connector, id.member))).toThrow('management denied')
    expect(() => service(save(1, ",NULL,'all'", id.foreignConnector))).toThrow('management denied')
    for (const mode of ["'other'", 'NULL']) expect(() => service(save(1, `,NULL,${mode}`))).toThrow('Invalid connector policy')
    expect(db('SELECT count(*) FROM connector_audit_events')).toBe('0')
    service(sql)
    expect(pg.call('SELECT tool_access_mode FROM connector_policies', id.admin)).toBe('all')
    expect(pg.call('SELECT tool_access_mode FROM connector_policies', id.member)).toBe('')
  })
})