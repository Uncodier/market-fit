/** @jest-environment node */
import { licenseActor, licenseFixture, licenseIds as ids, licenseMigration, licensePostgres, licensePostgresAvailable, licenseUuid as uuid } from './site-license-postgres'

const suite = licensePostgresAvailable ? describe : describe.skip
suite('member licenses in disposable PostgreSQL', () => {
  const pg = licensePostgres()
  const plan = (value: string) => pg.db(`UPDATE billing SET plan='${value}' WHERE site_id='${ids.site}'`)
  const add = (id: number, status = 'active', role = 'collaborator', user = uuid(id + 100)) => pg.db(`
    INSERT INTO site_members(id,site_id,user_id,email,role,status,created_at)
    VALUES ('${uuid(id)}','${ids.site}','${user}','member${id}@example.test','${role}','${status}','2026-01-01'::date+${id}*interval '1 minute')`)
  const license = (member?: string) => JSON.parse(pg.call(`SELECT get_site_member_license('${ids.site}',${member ? `'${member}'` : 'NULL'})`, ids.owner, 'service_role'))
  const flags = () => JSON.parse(pg.db(`SELECT coalesce(jsonb_agg(jsonb_build_array(id,status,license_suspended) ORDER BY created_at,id),'[]') FROM site_members WHERE site_id='${ids.site}'`))
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => pg.install())

  it('counts primary owner without a row, excludes a reserved update, and scopes the service RPC', () => {
    expect(license()).toMatchObject({ plan: 'enterprise', current: 1, total: 1, limit: null, requiredPlan: 'engine', siteId: ids.site })
    add(20, 'active', 'owner', ids.owner); add(21, 'pending'); add(22, 'rejected')
    expect(license()).toMatchObject({ current: 2, total: 2 })
    expect(license(uuid(21))).toMatchObject({ current: 1, total: 2 })
    for (const role of ['anon', 'authenticated']) expect(() => pg.call(`SELECT get_site_member_license('${ids.site}')`, ids.owner, role)).toThrow('permission denied')
    expect(() => license(uuid(999))).toThrow('Member does not belong to site')
    expect(pg.call(`SELECT get_site_member_license('${uuid(999)}') IS NULL`, ids.owner, 'service_role')).toBe('t')
    pg.db(`UPDATE sites SET archived_at=now() WHERE id='${ids.site}'`)
    expect(pg.call(`SELECT get_site_member_license('${ids.site}') IS NULL`, ids.owner, 'service_role')).toBe('t')
  })

  it('enforces all seat limits with structured MEMBER_LIMIT and owner counted once', () => {
    plan('commission'); add(20, 'active', 'owner', ids.owner)
    expect(() => add(21, 'pending')).toThrow('MEMBER_LIMIT')
    plan('engine'); for (let id = 21; id <= 24; id++) add(id, id % 2 ? 'pending' : 'active')
    expect(license()).toMatchObject({ current: 5, limit: 5, requiredPlan: 'foundry' })
    expect(() => add(25)).toThrow('"requiredPlan": "foundry"')
    pg.db(`UPDATE site_members SET status='active' WHERE id='${uuid(21)}'`)
    pg.db(`UPDATE site_members SET name='Still allowed' WHERE id='${uuid(24)}'`)
    plan('foundry'); for (let id = 25; id <= 29; id++) add(id)
    expect(license()).toMatchObject({ current: 10, requiredPlan: 'enterprise' })
    expect(() => add(30)).toThrow('MEMBER_LIMIT')
    plan('enterprise'); for (let id = 30; id <= 45; id++) add(id)
    expect(license()).toMatchObject({ current: 26, limit: null })
  })

  it('downgrades deterministically without changing status and restores oldest on upgrade/removal/rejection', () => {
    for (let id = 20; id <= 26; id++) add(id, id === 23 ? 'pending' : 'active')
    plan('engine')
    expect(flags().map((row: [string, string, boolean]) => row[2])).toEqual([false, false, false, false, true, true, true])
    expect(license(uuid(24))).toMatchObject({ current: 5, total: 8 })
    pg.db(`UPDATE site_members SET status='rejected' WHERE id='${uuid(20)}'`)
    expect(flags().find((row: [string]) => row[0] === uuid(24))[2]).toBe(false)
    pg.db(`DELETE FROM site_members WHERE id='${uuid(21)}'`)
    expect(flags().find((row: [string]) => row[0] === uuid(25))[2]).toBe(false)
    plan('commission')
    expect(flags().filter((row: [string, string]) => row[1] !== 'rejected').every((row: [string, string, boolean]) => row[2])).toBe(true)
    plan('foundry')
    expect(flags().every((row: [string, string, boolean]) => !row[2])).toBe(true)
    expect(flags().find((row: [string]) => row[0] === uuid(23))[1]).toBe('pending')
  })

  it('rejects activation overage, suspended bypass, member identity changes and browser financial forgery', () => {
    add(20, 'rejected'); plan('commission')
    expect(() => pg.db(`UPDATE site_members SET status='active' WHERE id='${uuid(20)}'`)).toThrow('MEMBER_LIMIT')
    expect(() => pg.call(`UPDATE site_members SET license_suspended=true WHERE id='${uuid(20)}'`)).toThrow('server managed')
    expect(() => pg.call(`INSERT INTO site_members(site_id,user_id,role,license_suspended) VALUES ('${ids.site}','${uuid(99)}','admin',true)`)).toThrow('server managed')
    expect(() => pg.db(`UPDATE site_members SET site_id='${ids.other}' WHERE id='${uuid(20)}'`)).toThrow('immutable')
    expect(() => pg.call(`UPDATE billing SET plan='enterprise' WHERE site_id='${ids.site}'`)).toThrow('Protected billing fields')
    expect(pg.db(`SELECT count(*) FROM pg_trigger WHERE tgname='guard_billing_credit_buckets' AND tgenabled='O'`)).toBe('1')
  })

  it('activates a NULL-user pending invitation at exact capacity without counting it twice', () => {
    plan('engine'); for (let id = 20; id <= 22; id++) add(id)
    pg.db(`INSERT INTO site_members(id,site_id,user_id,email,role,status) VALUES ('${uuid(23)}','${ids.site}',NULL,'invited@example.test','admin','pending')`)
    expect(license(uuid(23))).toMatchObject({ current: 4, limit: 5 })
    pg.db(`UPDATE site_members SET user_id='${ids.member}',status='active' WHERE id='${uuid(23)}'`)
    expect(license()).toMatchObject({ current: 5, total: 5 })
    expect(() => pg.db(`UPDATE site_members SET user_id='${uuid(777)}' WHERE id='${uuid(23)}'`)).toThrow('immutable')
    expect(() => pg.call(`UPDATE site_members SET created_at='2000-01-01' WHERE id='${uuid(23)}'`)).toThrow('addition time is immutable')
    plan('enterprise')
    pg.call(`INSERT INTO site_members(id,site_id,user_id,role,status,created_at) VALUES ('${uuid(24)}','${ids.site}','${uuid(888)}','marketing','active','2000-01-01')`)
    expect(pg.db(`SELECT created_at > now()-interval '1 minute' FROM site_members WHERE id='${uuid(24)}'`)).toBe('t')
  })

  it('removes suspended shared access including coowner fallback but keeps primary owner', () => {
    add(20, 'active', 'admin', ids.member)
    pg.db(`INSERT INTO site_ownership(site_id,user_id) VALUES ('${ids.site}','${ids.member}')`)
    expect(pg.call(`SELECT current_user_site_role('${ids.site}')`, ids.member)).toBe('owner')
    plan('commission')
    expect(pg.call(`SELECT current_user_site_role('${ids.site}') IS NULL`, ids.member)).toBe('t')
    expect(pg.call(`SELECT user_can('${ids.site}','select')`, ids.member)).toBe('f')
    expect(pg.call('SELECT count(*) FROM get_my_accessible_sites()', ids.member)).toBe('0')
    expect(pg.call(`SELECT count(*) FROM sites WHERE id='${ids.site}'`, ids.member)).toBe('0')
    expect(pg.call(`SELECT count(*) FROM settings WHERE site_id='${ids.site}'`, ids.member)).toBe('0')
    expect(pg.call(`SELECT current_user_site_role('${ids.site}')`)).toBe('owner')
    expect(pg.call(`SELECT count(*) FROM site_members`, ids.foreign)).toBe('0')
    plan('engine')
    expect(pg.call(`SELECT current_user_site_role('${ids.site}')`, ids.member)).toBe('owner')
    pg.db(`DELETE FROM site_members WHERE id='${uuid(20)}'`)
    expect(pg.call(`SELECT current_user_site_role('${ids.site}') IS NULL`, ids.member)).toBe('t')
  })

  it('keeps suspended members out of synchronized automation settings and restricts partner license writes', () => {
    add(20, 'active', 'admin'); add(21, 'active', 'marketing'); add(22, 'active', 'collaborator'); add(23, 'pending')
    expect(JSON.parse(pg.db(`SELECT team_members FROM settings WHERE site_id='${ids.site}'`)).map((item: { role: string }) => item.role)).toEqual(['admin', 'create', 'view'])
    plan('commission')
    expect(pg.db(`SELECT team_members FROM settings WHERE site_id='${ids.site}'`)).toBe('[]')
    pg.call(`UPDATE settings SET team_members='[{"email":"forged@example.test","role":"admin"}]' WHERE site_id='${ids.site}'`)
    expect(pg.db(`SELECT team_members FROM settings WHERE site_id='${ids.site}'`)).toBe('[]')
    plan('engine')
    expect(JSON.parse(pg.db(`SELECT team_members FROM settings WHERE site_id='${ids.site}'`))).toHaveLength(3)
    pg.call(`INSERT INTO partner_licenses(user_id,status) VALUES ('${ids.owner}','active')`, ids.owner, 'service_role')
    expect(pg.call('SELECT count(*) FROM partner_licenses')).toBe('1')
    expect(pg.call('SELECT count(*) FROM partner_licenses', ids.foreign)).toBe('0')
    expect(() => pg.call(`INSERT INTO partner_licenses(user_id,status) VALUES ('${ids.owner}','active')`)).toThrow('row-level security')
    expect(pg.call(`UPDATE partner_licenses SET status='forged'; SELECT status FROM partner_licenses`)).toBe('active')
  })

  it('rolls back all new schema and backfill changes if the migration fails', () => {
    const failing = licenseMigration.replace("NOTIFY pgrst, 'reload schema';", () => "DO $$ BEGIN RAISE EXCEPTION 'Injected license migration failure'; END; $$;")
    pg.db(licenseFixture)
    expect(() => pg.db(failing)).toThrow('Injected license migration failure')
    expect(pg.db("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='site_members' AND column_name='license_suspended'")).toBe('0')
    expect(pg.db("SELECT count(*) FROM pg_trigger WHERE tgname='guard_billing_credit_buckets' AND tgenabled='O'")).toBe('1')
    expect(pg.db("SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'license_%'")).toBe('0')
  })

  it('serializes competing invitations under one parent lock and fails closed at repeatable read', async () => {
    plan('engine'); for (let id = 20; id <= 22; id++) add(id)
    const insert = (id: number) => licenseActor(`INSERT INTO site_members(id,site_id,user_id,role,status)
      VALUES ('${uuid(id)}','${ids.site}','${uuid(id + 100)}','collaborator','pending')`)
    const results = await Promise.allSettled([
      pg.concurrent(`BEGIN; ${insert(23)}; SELECT pg_sleep(0.25); COMMIT;`),
      pg.concurrent(`BEGIN; ${insert(24)}; COMMIT;`),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(license()).toMatchObject({ current: 5, total: 5 })
    expect(() => pg.db(`BEGIN ISOLATION LEVEL REPEATABLE READ; UPDATE site_members SET name='No stale snapshot'; COMMIT;`)).toThrow('READ COMMITTED')
  })

  it('backfills legacy overages atomically without rewriting statuses', () => {
    pg.install(`INSERT INTO site_members(id,site_id,user_id,role,status) SELECT gen_random_uuid(),'${ids.other}',gen_random_uuid(),'admin','pending' FROM generate_series(1,3)`)
    expect(pg.db(`SELECT count(*) FROM site_members WHERE site_id='${ids.other}' AND license_suspended AND status='pending'`)).toBe('3')
    expect(licenseMigration.trim().startsWith('BEGIN;')).toBe(true)
    expect(licenseMigration.trim().endsWith('COMMIT;')).toBe(true)
  })

  it('reconciles trigger-derived terminal plans, owner transfer and archived restoration', () => {
    add(20, 'active', 'owner', ids.owner); add(21, 'active', 'admin', ids.member)
    pg.db(`CREATE FUNCTION terminal_plan() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.subscription_status='canceled' THEN NEW.plan:='commission'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER terminal_plan BEFORE UPDATE ON billing FOR EACH ROW EXECUTE FUNCTION terminal_plan();
      UPDATE billing SET subscription_status='canceled' WHERE site_id='${ids.site}'`)
    expect(license()).toMatchObject({ plan: 'commission', current: 1, total: 2 })
    expect(flags().find((row: [string]) => row[0] === uuid(21))[2]).toBe(true)
    pg.db(`UPDATE sites SET user_id='${ids.member}' WHERE id='${ids.site}'`)
    expect(flags().find((row: [string]) => row[0] === uuid(20))[2]).toBe(true)
    expect(flags().find((row: [string]) => row[0] === uuid(21))[2]).toBe(false)
    expect(pg.call(`SELECT current_user_site_role('${ids.site}')`, ids.member)).toBe('owner')
    pg.db(`UPDATE sites SET archived_at=now() WHERE id='${ids.site}'; UPDATE billing SET subscription_status='active',plan='engine' WHERE site_id='${ids.site}';
      UPDATE sites SET archived_at=NULL WHERE id='${ids.site}'`)
    expect(flags().every((row: [string, string, boolean]) => !row[2])).toBe(true)
  })
})