/** @jest-environment node */
import { licenseActor, licenseIds as ids, licensePostgres, licensePostgresAvailable, licenseUuid as uuid, partnerLicenseMigration } from './site-license-postgres'

const suite = licensePostgresAvailable ? describe : describe.skip
suite('atomic partner license in disposable PostgreSQL', () => {
  const pg = licensePostgres()
  const key = uuid(100)
  const addLicense = (status = 'active', owner = ids.owner, plan = 'Tier 2') => pg.db(`
    INSERT INTO partner_licenses(license_key,user_id,status,plan_name) VALUES ('${key}','${owner}','${status}','${plan}')`)
  const apply = (site = ids.site, owner = ids.owner, role = 'service_role') => pg.call(`SELECT apply_site_partner_license('${key}','${site}','${owner}')`, owner, role)
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => { pg.install(); pg.db(partnerLicenseMigration) })

  it('maps owned active partner tier atomically and preserves credits, licenses and licensed resources', () => {
    pg.db(`UPDATE billing SET plan='commission',credits_available=777 WHERE site_id='${ids.site}';
      UPDATE settings SET social_media='[{"id":"oldest","isActive":true},{"id":"next","isActive":true}]' WHERE site_id='${ids.site}'`)
    addLicense()
    expect(JSON.parse(apply())).toEqual({ success: true, plan: 'foundry' })
    expect(pg.db(`SELECT credits_available FROM billing WHERE site_id='${ids.site}'`)).toBe('777')
    expect(pg.db(`SELECT subscription_status||':'||auto_renew::text FROM billing WHERE site_id='${ids.site}'`)).toBe('active:false')
    expect(pg.db(`SELECT site_id FROM partner_licenses WHERE license_key='${key}'`)).toBe(ids.site)
    expect(pg.db(`SELECT social_media->1->>'isActive' FROM settings WHERE site_id='${ids.site}'`)).toBe('true')
    expect(JSON.parse(apply())).toEqual({ success: true, plan: 'foundry' })
    pg.db(`UPDATE partner_licenses SET plan_name='Tier 1' WHERE license_key='${key}'`)
    expect(JSON.parse(apply())).toEqual({ success: true, plan: 'engine' })
  })

  it('denies browser RPC, cross-site, wrong license owner, suspended managers and inactive/unknown status', () => {
    addLicense()
    for (const role of ['anon', 'authenticated']) expect(() => apply(ids.site, ids.owner, role)).toThrow('permission denied')
    expect(() => apply(ids.other)).toThrow('site access denied')
    expect(() => apply(ids.site, ids.foreign)).toThrow('site access denied')
    pg.db(`UPDATE partner_licenses SET user_id='${ids.foreign}'`)
    expect(() => apply()).toThrow('ownership denied')
    pg.db(`UPDATE partner_licenses SET user_id='${ids.owner}'`)
    for (const status of ['inactive', 'refunded', 'deactivated', 'unknown', '']) {
      pg.db(`UPDATE partner_licenses SET status='${status}'`)
      expect(() => apply()).toThrow('not active')
    }
    pg.db(`UPDATE partner_licenses SET status='active',user_id='${ids.member}';
      INSERT INTO site_members(site_id,user_id,role,status) VALUES ('${ids.site}','${ids.member}','admin','active');
      UPDATE billing SET plan='commission' WHERE site_id='${ids.site}'`)
    expect(() => apply(ids.site, ids.member)).toThrow('site access denied')
  })

  it('does not link if billing missing, Stripe conflicts, archived site, or billing trigger fails', () => {
    addLicense()
    pg.db(`UPDATE billing SET stripe_subscription_id='sub_existing' WHERE site_id='${ids.site}'`)
    expect(() => apply()).toThrow('PARTNER_STRIPE_CONFLICT')
    expect(pg.db(`SELECT site_id IS NULL FROM partner_licenses WHERE license_key='${key}'`)).toBe('t')
    pg.db(`UPDATE billing SET stripe_subscription_id=NULL WHERE site_id='${ids.site}';
      CREATE FUNCTION fail_partner_billing() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected billing failure'; END; $$;
      CREATE TRIGGER fail_partner_billing BEFORE UPDATE ON billing FOR EACH ROW EXECUTE FUNCTION fail_partner_billing();`)
    expect(() => apply()).toThrow('Injected billing failure')
    expect(pg.db(`SELECT site_id IS NULL FROM partner_licenses WHERE license_key='${key}'`)).toBe('t')
    pg.db('DROP TRIGGER fail_partner_billing ON billing;')
    pg.db(`DELETE FROM billing WHERE site_id='${ids.site}'`)
    expect(() => apply()).toThrow('PARTNER_BILLING_MISSING')
    pg.db(`UPDATE sites SET archived_at=now() WHERE id='${ids.site}'`)
    expect(() => apply()).toThrow('site access denied')
  })

  it('serializes competing site attachments so one owned active license cannot link twice', async () => {
    pg.db(`UPDATE sites SET user_id='${ids.owner}' WHERE id='${ids.other}'`)
    addLicense()
    const call = (site: string) => licenseActor(`SELECT apply_site_partner_license('${key}','${site}','${ids.owner}')`, ids.owner, 'service_role')
    const results = await Promise.allSettled([pg.concurrent(`BEGIN; ${call(ids.site)}; SELECT pg_sleep(0.2); COMMIT;`), pg.concurrent(call(ids.other))])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    const linked = pg.db(`SELECT site_id FROM partner_licenses WHERE license_key='${key}'`)
    expect([ids.site, ids.other]).toContain(linked)
    expect(() => apply(linked === ids.site ? ids.other : ids.site)).toThrow('PARTNER_LICENSE_LINKED')
  })
})