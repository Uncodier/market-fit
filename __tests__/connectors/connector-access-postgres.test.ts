/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { accessSql, id, installConnectorFixture, memberRow, migrationNames, sqlSource } from './connector-postgres-fixture'

describe('connector migration source contracts', () => {
  it.each(migrationNames)('%s is identical in all three repositories and below 500 lines', name => {
    const sql = sqlSource(name)
    expect(sql).toBe(sqlSource(name, 'API'))
    expect(sql).toBe(sqlSource(name, 'makinari-db-scheme'))
    expect(sql.split('\n').length).toBeLessThan(500)
  })
})

const suite = postgresAvailable ? describe : describe.skip
suite('connector site guards and RLS in disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  const siteAccess = (user: string, site = id.site) => pg.call(
    `SELECT can_view,can_manage FROM public.connector_site_access('${site}','${user}')`, user)
  const grant = () => service(accessSql([{ user_id: id.member, can_view: true, can_use: true },
    { user_id: id.viewer, can_view: true, can_use: false }], [{ agent_id: id.agent, enabled: true }]))
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installConnectorFixture(db))

  it('uses one eligibility decision for view/manage, including owner and no-row co-owner', () => {
    for (const user of [id.owner, id.admin, id.coowner]) expect(siteAccess(user)).toBe('t|t')
    for (const user of [id.member, id.viewer]) expect(siteAccess(user)).toBe('t|f')
    for (const user of [id.foreign, id.pending, id.blocked, id.restricted, id.disabled]) expect(siteAccess(user)).toBe('f|f')
    expect(siteAccess(id.owner, id.otherSite)).toBe('f|f')
    db(`UPDATE sites SET archived_at=now() WHERE id='${id.site}'`)
    expect(siteAccess(id.owner)).toBe('f|f')
  })

  it('does not let a browser inspect another principal even with a forged JWT role field', () => {
    expect(pg.call(`SELECT * FROM public.connector_site_access('${id.site}','${id.owner}')`, id.member)).toBe('f|f')
    expect(db(`SET ROLE authenticated;
      SET request.jwt.claims='{"sub":"${id.member}","role":"service_role"}';
      SELECT * FROM public.connector_site_access('${id.site}','${id.owner}')`)).toBe('f|f')
    expect(service(`SELECT * FROM public.connector_site_access('${id.site}','${id.admin}')`)).toBe('t|t')
  })

  it('uses the actual license ranking helper, not stale license_suspended projections', () => {
    db(`UPDATE sites SET plan='base' WHERE id='${id.site}';
      UPDATE site_members SET license_suspended=false`)
    expect(siteAccess(id.admin)).toBe('f|f')
    expect(siteAccess(id.member)).toBe('f|f')
    expect(siteAccess(id.owner)).toBe('t|t')
    db(`UPDATE sites SET plan='enterprise' WHERE id='${id.site}';
      UPDATE site_members SET license_suspended=true`)
    expect(siteAccess(id.member)).toBe('t|f')
  })

  it('denies ambiguous or inactive memberships, including a co-owner with a disabled row', () => {
    db(`INSERT INTO site_members(id,site_id,user_id,role,status) VALUES
      (gen_random_uuid(),'${id.site}','${id.member}','admin','active'),
      (gen_random_uuid(),'${id.site}','${id.coowner}','admin','pending')`)
    expect(siteAccess(id.member)).toBe('f|f')
    expect(siteAccess(id.coowner)).toBe('f|f')
  })

  it('does not expose hidden account identities or counts within the same toolkit', () => {
    expect(pg.call('SELECT count(id) FROM connectors', id.member)).toBe('0')
    grant()
    expect(pg.call('SELECT display_name FROM connectors', id.member)).toBe('Visible account')
    expect(pg.call('SELECT count(id) FROM connectors', id.viewer)).toBe('1')
    expect(pg.call('SELECT count(id) FROM connectors', id.owner)).toBe('2')
    expect(pg.call('SELECT count(id) FROM connectors', id.foreign)).toBe('1')
    expect(() => pg.call('SELECT provider_account_id FROM connectors', id.owner)).toThrow('permission denied')
    expect(() => pg.call('SELECT * FROM site_connector_providers', id.owner)).toThrow('permission denied')
    expect(() => pg.call('SELECT * FROM site_connector_auth_attempts', id.owner)).toThrow('permission denied')
  })

  it('shows members only their own grant and managers the ACL, policy and administrative events', () => {
    grant()
    expect(pg.call('SELECT count(*) FROM connector_members', id.member)).toBe('1')
    expect(pg.call('SELECT can_use FROM connector_members', id.viewer)).toBe('f')
    expect(pg.call('SELECT count(*) FROM connector_agents', id.member)).toBe('0')
    expect(pg.call('SELECT count(*) FROM connector_audit_events', id.member)).toBe('0')
    expect(pg.call('SELECT count(*) FROM connector_members', id.owner)).toBe('2')
    expect(pg.call('SELECT count(*) FROM connector_agents', id.owner)).toBe('1')
    expect(pg.call('SELECT count(*) FROM connector_audit_events', id.owner)).toBe('1')
    // Being a manager never synthesizes a use grant.
    expect(db(`SELECT count(*) FROM connector_members WHERE user_id='${id.owner}'`)).toBe('0')
  })

  it.each(['expiry', 'revocation', 'membership removal', 'screen block', 'location restriction'])(
    'removes account visibility immediately after %s', change => {
      grant()
      if (change === 'expiry') db(`UPDATE connector_members SET expires_at=now()-interval '1 second' WHERE user_id='${id.member}'`)
      if (change === 'revocation') db(`UPDATE connector_members SET revoked_at=now() WHERE user_id='${id.member}'`)
      if (change === 'membership removal') db(`DELETE FROM site_members WHERE user_id='${id.member}'`)
      if (change === 'screen block') db(`UPDATE site_members SET blocked_screens=ARRAY['connectors'] WHERE user_id='${id.member}'`)
      if (change === 'location restriction') db(`INSERT INTO site_member_location_restrictions
        VALUES ('${id.site}','${memberRow(id.member)}',gen_random_uuid())`)
      expect(pg.call('SELECT count(id) FROM connectors', id.member)).toBe('0')
    })

  it('blocks all browser mutations, private function execution, and anonymous reads', () => {
    for (const table of ['connectors', 'site_connector_providers', 'site_connector_auth_attempts',
      'connector_members', 'connector_agents', 'connector_policies', 'connector_audit_events']) {
      for (const role of ['authenticated', 'anon']) {
        expect(db(`SELECT has_table_privilege('${role}','public.${table}','INSERT,UPDATE,DELETE,TRUNCATE')`)).toBe('f')
      }
    }
    expect(() => pg.call('SELECT id FROM connectors', id.owner, 'anon')).toThrow('permission denied')
    expect(() => pg.call(accessSql([{ user_id: id.member, can_view: true, can_use: true }]), id.owner)).toThrow('permission denied')
    expect(db(`SELECT has_function_privilege('authenticated',
      'public.connector_effective_site_access(uuid,uuid)','EXECUTE')`)).toBe('f')
    expect(db(`SELECT has_table_privilege('service_role','public.connector_members','INSERT')`)).toBe('f')
  })
})