/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { accessSql, finalizeSql, id, insertAttempt, installConnectorFixture, sqlSource } from './connector-postgres-fixture'

const pg = isolatedPostgres()
const describeWithPostgres = postgresAvailable ? describe : describe.skip
const manage = (operation: string, revision: number, connector = id.connector, name = 'NULL') =>
  `SELECT public.connector_manage_account('${id.site}', '${connector}', ${revision}, '${operation}', ${name})`

describeWithPostgres('connector account management with an authenticated actor', () => {
  beforeAll(pg.start, 30000)
  afterAll(pg.stop)
  beforeEach(() => {
    installConnectorFixture(pg.db)
    pg.db(sqlSource('20261126000000_connector_account_management.sql'))
  }, 30000)

  it('removes all member grants and inheritance without removing agents or granting managers use', () => {
    insertAttempt(pg.db)
    const account = JSON.parse(pg.call(finalizeSql(), id.owner, 'service_role'))
    expect(account.access_mode).toBe('workspace')
    const visible = `SELECT public.connector_visible('${id.site}', '${account.id}')`
    expect(pg.call(visible, id.member)).toBe('t')
    pg.call(accessSql([{ user_id: id.admin, can_view: true, can_use: true }], [{ agent_id: id.agent, enabled: true }], 1, id.owner, account.id), id.owner, 'service_role')
    const receipt = JSON.parse(pg.call(manage('remove_members', 2, account.id), id.admin))
    expect(receipt).toEqual({ connector_id: account.id, revision: 3, operation: 'remove_members', display_name: null })
    expect(pg.call(visible, id.member)).toBe('f')
    expect(pg.call(visible, id.viewer)).toBe('f')
    expect(pg.call(visible, id.owner)).toBe('t')
    expect(pg.db(`SELECT access_mode FROM connectors WHERE id='${account.id}'`)).toBe('explicit')
    expect(pg.db(`SELECT count(*) FROM connector_members WHERE connector_id='${account.id}'`)).toBe('0')
    expect(pg.db(`SELECT enabled FROM connector_agents WHERE connector_id='${account.id}'`)).toBe('t')
    expect(() => pg.call(manage('remove_agents', 2, account.id), id.admin)).toThrow(/revision conflict/)
    expect(() => pg.db(`UPDATE connectors SET access_mode='workspace' WHERE id='${account.id}'`)).toThrow(/immutable/)
    pg.call(accessSql([{ user_id: id.member, can_view: true, can_use: true }], [], 3, id.owner, account.id), id.owner, 'service_role')
    expect(pg.call(visible, id.member)).toBe('t')
  })

  it('removes agents only on the named account and preserves member and other-account grants', () => {
    const members = [{ user_id: id.member, can_view: true, can_use: true }]
    const agents = [{ agent_id: id.agent, enabled: true }]
    for (const account of [id.connector, id.hidden]) pg.call(accessSql(members, agents, 1, id.owner, account), id.owner, 'service_role')
    expect(JSON.parse(pg.call(manage('remove_agents', 2), id.owner))).toMatchObject({ revision: 3, operation: 'remove_agents' })
    expect(pg.db(`SELECT connector_id FROM connector_agents`)).toBe(id.hidden)
    expect(pg.db(`SELECT count(*) FROM connector_members WHERE can_use`)).toBe('2')
    expect(pg.db(`SELECT event_type FROM connector_audit_events WHERE connector_id='${id.connector}' AND revision=3`)).toBe('access_updated')
  })

  it('renames safe display metadata only; rejects invalid names, unauthorized actors and foreign accounts', () => {
    const rename = manage('rename', 1, id.connector, "' Sales mailbox '")
    expect(() => pg.call(rename, id.owner, 'anon')).toThrow(/permission denied/)
    expect(() => pg.call(rename, id.owner, 'service_role')).toThrow(/permission denied/)
    expect(() => pg.call(rename, id.member)).toThrow(/management denied/)
    expect(() => pg.call(manage('remove_members', 1, id.foreignConnector), id.owner)).toThrow(/management denied/)
    expect(() => pg.call(manage('rename', 1, id.connector, "E'a\\nb'"), id.admin)).toThrow(/Invalid connector/)
    expect(JSON.parse(pg.call(rename, id.admin))).toEqual({ connector_id: id.connector, revision: 2, operation: 'rename', display_name: 'Sales mailbox' })
    expect(pg.db(`SELECT display_name, provider_account_id FROM connectors WHERE id='${id.connector}'`)).toBe('Sales mailbox|account-a')
    expect(pg.db(`SELECT event_type FROM connector_audit_events WHERE revision=2`)).toBe('connection_renamed')
  })
})