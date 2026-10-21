/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, migration } from './isolated-postgres'
import { enforcementIds as i, installEnforcementFixture, restrictEnforcementMember } from './location-enforcement-fixture'

const describePg = postgresAvailable ? describe : describe.skip
describePg('location ownership privilege boundary', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installEnforcementFixture(pg)
    pg.db(`ALTER TABLE site_ownership ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON site_ownership TO authenticated;
      CREATE POLICY existing_read ON site_ownership FOR SELECT TO authenticated USING(true);
      CREATE POLICY existing_insert ON site_ownership FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
      CREATE POLICY existing_update ON site_ownership FOR UPDATE TO authenticated USING(user_id=auth.uid());`)
  })

  it('reproduces the legacy self-elevation and rejects the same insert after correction', () => {
    restrictEnforcementMember(pg)
    expect(pg.call(`SELECT current_user_site_role('${i.site}')`, i.member)).toBe('collaborator')
    const attempt = `INSERT INTO site_ownership(site_id,user_id) VALUES('${i.site}','${i.member}')`
    pg.call(attempt, i.member)
    expect(pg.call(`SELECT current_user_site_role('${i.site}')`, i.member)).toBe('owner')
    pg.db(`DELETE FROM site_ownership WHERE user_id='${i.member}'`)
    pg.db(migration('20261021010000_location_acl_ownership_boundary.sql'))
    expect(() => pg.call(attempt, i.member)).toThrow(/row-level security/)
    expect(pg.call('SELECT current_user_has_location_restrictions()', i.member)).toBe('t')
    expect(pg.call(`SELECT count(*) FROM deals WHERE id='${i.denied}'`, i.member)).toBe('0')
  })

  it('prevents reassigning owned rows into another site but retains primary-owner provisioning', () => {
    pg.db(`INSERT INTO site_ownership(site_id,user_id) VALUES('${i.otherSite}','${i.member}')`)
    pg.db(migration('20261021010000_location_acl_ownership_boundary.sql'))
    expect(pg.call(`UPDATE site_ownership SET site_id='${i.site}' WHERE user_id='${i.member}' RETURNING site_id`, i.member)).toBe('')
    expect(pg.call(`SELECT site_id FROM site_ownership WHERE user_id='${i.member}'`, i.member)).toBe(i.otherSite)
    expect(() => pg.call(`INSERT INTO site_ownership VALUES('${i.site}','${i.owner}')`, i.owner)).not.toThrow()
    expect(() => pg.call(`INSERT INTO site_ownership VALUES('${i.site}','${i.admin}')`, i.admin)).toThrow(/row-level security/)
  })
})