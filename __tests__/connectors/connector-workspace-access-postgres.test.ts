/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { accessSql, finalizeSql, id, insertAttempt, installConnectorFixture } from './connector-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip
suite('workspace connector visibility in disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  const visibleSql = (user: string, connector?: string, site = id.site) =>
    `SELECT id,access_mode FROM public.connector_list_visible('${site}','${user}'${connector ? `,'${connector}'` : ''}) ORDER BY id`
  const readRls = (user: string, site = id.site) => pg.call(
    `SELECT id,access_mode FROM public.connectors WHERE site_id='${site}' ORDER BY id`, user)
  const assertVisibility = (user: string, expected: string, connector?: string) => {
    const rls = connector ? pg.call(`SELECT id,access_mode FROM public.connectors
      WHERE site_id='${id.site}' AND id='${connector}'`, user) : readRls(user)
    expect(rls).toBe(expected)
    expect(service(visibleSql(user, connector))).toBe(expected)
  }
  let workspace: string
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installConnectorFixture(db)
    insertAttempt(db)
    workspace = JSON.parse(service(finalizeSql())).id
  })

  it('only inherits missing rows in workspace mode, leaving explicit visibility grants unchanged', () => {
    assertVisibility(id.member, `${workspace}|workspace`)
    assertVisibility(id.member, '', id.connector)
    assertVisibility(id.member, '', id.hidden)
    service(accessSql([{ user_id: id.member, can_view: true, can_use: false }]))
    assertVisibility(id.member, `${id.connector}|explicit\n${workspace}|workspace`)
    assertVisibility(id.member, `${workspace}|workspace`, workspace)
    expect(pg.call(`SELECT public.connector_visible('${id.site}',NULL)`, id.member)).toBe('f')
  })

  it.each([
    { can_view: false, can_use: false },
    { can_view: true, can_use: true, revoked_at: '2000-01-01T00:00:00Z' },
    { can_view: true, can_use: true, expires_at: '2000-01-01T00:00:00Z' },
  ])('lets a present exception deny rather than fall back to inheritance (%j)', (exception) => {
    service(accessSql([{ user_id: id.member, ...exception }], [], 1, id.owner, workspace))
    assertVisibility(id.member, '')
    assertVisibility(id.member, '', workspace)
    assertVisibility(id.viewer, `${workspace}|workspace`)
  })

  it('lets eligible managers browse despite an exception and lets an ordinary view-only exception browse', () => {
    service(accessSql([{ user_id: id.admin, can_view: false, can_use: false },
      { user_id: id.member, can_view: true, can_use: false, expires_at: '2099-01-01T00:00:00Z' }],
    [], 1, id.owner, workspace))
    assertVisibility(id.admin, `${workspace}|workspace`, workspace)
    assertVisibility(id.member, `${workspace}|workspace`, workspace)
    expect(pg.call(`SELECT can_use FROM connector_members WHERE connector_id='${workspace}'`, id.member)).toBe('f')
    expect(pg.call(`SELECT count(*) FROM connector_policies WHERE connector_id='${workspace}'`, id.member)).toBe('0')
  })

  it('re-evaluates current site eligibility and denies cross-site IDs, departed members and archived sites', () => {
    for (const user of [id.foreign, id.pending, id.blocked, id.restricted, id.disabled]) {
      assertVisibility(user, '', workspace)
    }
    assertVisibility(id.owner, '', id.foreignConnector)
    expect(service(visibleSql(id.member, workspace, id.otherSite))).toBe('')
    service(accessSql([{ user_id: id.member, can_view: true, can_use: true }], [], 1, id.owner, workspace))
    db(`DELETE FROM public.site_members WHERE user_id='${id.member}' AND site_id='${id.site}'`)
    assertVisibility(id.member, '', workspace)
    db(`UPDATE public.sites SET archived_at=now() WHERE id='${id.site}'`)
    assertVisibility(id.owner, '', workspace)
  })

  it('does not expose the internal resolver, actor-explicit listing or private identifiers to browsers', () => {
    expect(() => pg.call(visibleSql(id.owner), id.member)).toThrow('permission denied')
    expect(() => pg.call(visibleSql(id.member), id.member, 'anon')).toThrow('permission denied')
    expect(() => pg.call(`SELECT public.connector_effective_visible('${id.site}','${id.owner}',NULL)`, id.member))
      .toThrow('permission denied')
    expect(() => pg.call(`SELECT provider_account_id FROM public.connectors WHERE id='${workspace}'`, id.member))
      .toThrow('permission denied')
    expect(() => pg.call(`UPDATE public.connectors SET access_mode='explicit' WHERE id='${workspace}'`, id.owner))
      .toThrow('permission denied')
  })
})