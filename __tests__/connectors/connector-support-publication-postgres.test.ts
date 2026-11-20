/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { finalizeSql, id, insertAttempt, installConnectorFixture, jsonSql, policySql, sqlSource } from './connector-postgres-fixture'

const migration = '20261120050000_connector_support_publication.sql'
const read = 'SELECT support_publication FROM public.connector_policies'
const publication = { audience: 'anonymous', label_id: 'Label_123' }
const save = (value: unknown, revision = 1, actor = id.owner, connector = id.connector) =>
  `SELECT public.connector_update_policy('${id.site}','${connector}','${actor}',${revision},
    '{}',ARRAY['assistant'],false,true,'all',${jsonSql(value)})`

;(postgresAvailable ? describe : describe.skip)('published support titles policy', () => {
  const pg = isolatedPostgres(), service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installConnectorFixture(pg.db))

  it('preserves legacy rows, defaults new connections to private and clears publication on an older client save', () => {
    service(policySql()); pg.db(sqlSource(migration))
    insertAttempt(pg.db); service(finalizeSql())
    expect(pg.db(`SELECT count(*) FROM connector_policies WHERE support_publication IS NULL`)).toBe('2')
    expect(JSON.parse(service(save(publication, 2)))).toMatchObject({ revision: 3, policy_revision: 2 })
    expect(() => service(save({ ...publication, audience: 'verified' }, 2))).toThrow(/revision conflict/)
    expect(JSON.parse(pg.db(`${read} WHERE connector_id='${id.connector}'`))).toEqual(publication)
    service(policySql(3)); expect(pg.db(`SELECT count(*) FROM connector_policies WHERE support_publication IS NOT NULL`)).toBe('0')
  })

  it('allows only same-site managers to publish, and only managers to inspect the label', () => {
    pg.db(sqlSource(migration))
    for (const role of ['anon', 'authenticated']) expect(() => pg.call(save(publication), id.owner, role)).toThrow(/permission denied/)
    expect(() => service(save(publication, 1, id.member))).toThrow(/management denied/)
    expect(() => service(save(publication, 1, id.owner, id.foreignConnector))).toThrow(/management denied/)
    service(save({ ...publication, audience: 'verified' }, 1, id.admin))
    expect(pg.call(read, id.member)).toBe(''); expect(pg.call(read, id.foreign)).toBe('')
    expect(() => pg.call(read, id.owner, 'anon')).toThrow(/permission denied/)
    expect(JSON.parse(pg.call(read, id.admin))).toEqual({ ...publication, audience: 'verified' })
  })

  it('rejects arbitrary tools, labels, queries and audiences without recording a revision', () => {
    pg.db(sqlSource(migration))
    for (const invalid of [{}, { ...publication, audience: null }, { ...publication, audience: 'member' },
      { ...publication, label_id: 'INBOX' }, { ...publication, label_id: 5 }, { ...publication, query: '*' }]) {
      expect(() => service(save(invalid))).toThrow(/check constraint/)
    }
    insertAttempt(pg.db, 'completing', 'other-account', 'hubspot')
    const connector = JSON.parse(service(finalizeSql({ toolkit: 'hubspot', account: 'other-account' }))).id
    expect(() => service(save(publication, 1, id.owner, connector))).toThrow(/Unsupported publication toolkit/)
    expect(pg.db(`SELECT count(*) FROM connector_audit_events WHERE event_type='policy_updated'`)).toBe('0')
  })

  it('filters exact audience and effective agent access before pagination', () => {
    pg.db(sqlSource(migration)); insertAttempt(pg.db)
    const workspace = JSON.parse(service(finalizeSql())).id
    pg.db(`UPDATE connectors SET granted_scopes=ARRAY['https://www.googleapis.com/auth/gmail.readonly']`)
    service(save(publication)); service(save({ ...publication, audience: 'verified' }, 1, id.owner, workspace))
    const page = (audience: string, agent = id.agent, after = 'NULL', exact = 'NULL') =>
      `SELECT connector_id FROM connector_support_publication_page('${id.site}','${agent}','${audience}',${after},${exact})`
    const exact = (account: string) => page('verified', id.agent, 'NULL', `'${account}'`)
    expect(service(exact(workspace))).toBe(workspace); expect(service(exact(id.connector))).toBe('')
    expect(service(page('anonymous'))).toBe(''); expect(service(page('verified'))).toBe(workspace)
    expect(service(page('verified', id.inactiveAgent))).toBe(''); expect(service(page('verified', id.otherAgent))).toBe('')
    expect(service(page('verified', id.agent, `'${workspace}'`))).toBe('')
    const grants = `INSERT INTO connector_agents(site_id,connector_id,agent_id,enabled,granted_by) VALUES`
    pg.db(`${grants} ('${id.site}','${workspace}','${id.agent}',false,'${id.owner}'),
      ('${id.site}','${id.connector}','${id.agent}',true,'${id.owner}')`)
    expect(service(page('verified'))).toBe(id.connector); expect(service(page('anonymous'))).toBe(id.connector)
    expect(service(exact(workspace))).toBe(''); expect(service(exact(id.connector))).toBe(id.connector)
    pg.db(`UPDATE sites SET archived_at = now() WHERE id='${id.site}'`)
    expect(service(exact(id.connector))).toBe('')
    pg.db(`UPDATE sites SET archived_at = NULL WHERE id='${id.site}'`)
    expect(service(page('member'))).toBe(''); expect(() => pg.call(page('verified'), id.owner)).toThrow(/permission denied/)
    pg.db(`UPDATE connector_agents SET expires_at = now() WHERE connector_id='${id.connector}'`)
    expect(service(page('verified'))).toBe('')
  })
})

test('migration copies match the canonical schema', () => {
  for (const repo of ['API', 'makinari-db-scheme']) expect(sqlSource(migration, repo)).toBe(sqlSource(migration))
})