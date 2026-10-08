/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  licenseActor, licenseIds as ids, licensePostgres, licensePostgresAvailable,
  licenseUuid as uuid, partnerLicenseMigration,
} from './site-license-postgres'

const migration = readFileSync(path.join(__dirname, '../../supabase/migrations/20261007223500_manual_member_deactivation.sql'), 'utf8')
const suite = licensePostgresAvailable ? describe : describe.skip
suite('manual member deactivation in disposable PostgreSQL', () => {
  const pg = licensePostgres()
  const plan = (value: string) => pg.db(`UPDATE billing SET plan='${value}' WHERE site_id='${ids.site}'`)
  const add = (id: number, status = 'active', role = 'collaborator', user: string | null = uuid(id + 100)) => pg.db(`
    INSERT INTO site_members(id,site_id,user_id,email,role,status,created_at)
    VALUES ('${uuid(id)}','${ids.site}',${user ? `'${user}'` : 'NULL'},'member${id}@example.test',
      '${role}','${status}','2026-01-01'::date+${id}*interval '1 minute')`)
  const toggleSql = (id: number, enabled: boolean, site = ids.site) =>
    `SELECT set_site_member_enabled('${site}','${uuid(id)}',${enabled})`
  const toggle = (id: number, enabled: boolean) => JSON.parse(pg.call(toggleSql(id, enabled), ids.owner, 'service_role'))
  const row = (id: number) => JSON.parse(pg.db(`SELECT to_jsonb(sm) FROM site_members sm WHERE id='${uuid(id)}'`))
  const license = () => JSON.parse(pg.call(`SELECT get_site_member_license('${ids.site}')`, ids.owner, 'service_role'))
  const install = (legacy = '') => {
    pg.install(legacy)
    pg.db(partnerLicenseMigration)
    pg.db(migration)
  }
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => install())

  it('installs after existing migrations, defaults legacy members to enabled, and preserves financial guards', () => {
    install(`INSERT INTO site_members(id,site_id,user_id,role,status)
      VALUES ('${uuid(20)}','${ids.site}','${ids.member}','admin','active')`)
    expect(row(20)).toMatchObject({ manually_disabled: false, license_suspended: false, status: 'active' })
    expect(pg.db(`SELECT is_nullable,column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='site_members' AND column_name='manually_disabled'`)).toBe('NO|false')
    expect(pg.db("SELECT count(*) FROM pg_trigger WHERE tgname='guard_billing_credit_buckets' AND tgenabled='O'")).toBe('1')
    expect(() => pg.call(`UPDATE billing SET plan='engine' WHERE site_id='${ids.site}'`)).toThrow('Protected billing fields')
    expect(migration.trim().startsWith('BEGIN;')).toBe(true)
    expect(migration.trim().endsWith('COMMIT;')).toBe(true)
  })

  it('grants the actual JSON RPC only to service_role, not browser roles or PUBLIC', () => {
    add(20)
    const signature = 'public.set_site_member_enabled(uuid,uuid,boolean)'
    expect(pg.db(`SELECT prorettype::regtype,prosecdef,proconfig FROM pg_proc WHERE oid='${signature}'::regprocedure`))
      .toBe('jsonb|t|{"search_path=public, pg_temp"}')
    expect(pg.db(`SELECT count(*) FROM pg_proc p, LATERAL aclexplode(p.proacl) a
      WHERE p.oid='${signature}'::regprocedure AND a.grantee=0`)).toBe('0')
    for (const role of ['anon', 'authenticated']) {
      expect(pg.db(`SELECT has_function_privilege('${role}','${signature}','EXECUTE')`)).toBe('f')
      expect(() => pg.call(toggleSql(20, false), ids.owner, role)).toThrow('permission denied')
    }
    expect(pg.db(`SELECT has_function_privilege('service_role','${signature}','EXECUTE')`)).toBe('t')
    expect(toggle(20, false)).toMatchObject({ id: uuid(20), manually_disabled: true, license_suspended: true })
    for (const fn of ['lock_site_license', 'reconcile_site_member_license']) {
      expect(() => pg.call(`SELECT ${fn}('${ids.site}')`, ids.owner, 'service_role')).toThrow('permission denied')
    }
  })

  it.each(['active', 'pending'])('toggles %s without deleting or rewriting member identity, role, status or history', status => {
    add(20, status, 'admin')
    pg.db(`UPDATE site_members SET name='Retained',position='Manager',added_by='${ids.owner}',
      blocked_screens=ARRAY['billing'],restrict_to_assigned_only=true WHERE id='${uuid(20)}';
      CREATE TABLE member_history(id integer PRIMARY KEY,member_id uuid REFERENCES site_members(id),note text);
      INSERT INTO member_history VALUES (1,'${uuid(20)}','Retain assignment history');`)
    const original = row(20)
    expect(toggle(20, false)).toEqual({ ...original, manually_disabled: true, license_suspended: true })
    expect(toggle(20, false)).toEqual(row(20))
    expect(pg.db('SELECT count(*) FROM site_members')).toBe('1')
    expect(pg.db('SELECT note FROM member_history')).toBe('Retain assignment history')
    expect(toggle(20, true)).toEqual(original)
    expect(toggle(20, true)).toEqual(original)
  })

  it('counts only eligible demand and enabled seats, including a reserved primary owner without a row', () => {
    for (let id = 20; id <= 25; id++) add(id, id === 21 ? 'pending' : 'active')
    add(26, 'rejected')
    plan('engine')
    expect(license()).toMatchObject({ current: 5, total: 7, limit: 5, requiredPlan: 'foundry' })
    toggle(24, false); toggle(25, false)
    expect(license()).toMatchObject({ current: 5, total: 5 })
    toggle(20, false)
    expect(license()).toMatchObject({ current: 4, total: 4, requiredPlan: 'engine' })
    add(27, 'active', 'owner', ids.owner)
    expect(license()).toMatchObject({ current: 4, total: 4 })
    expect(JSON.parse(pg.call(`SELECT get_site_member_license('${ids.site}','${uuid(21)}')`, ids.owner, 'service_role')))
      .toMatchObject({ current: 3, total: 4 })
  })

  it('refills a disabled seat in age order without restoring disabled members on upgrade, freed seats or ordinary saves', () => {
    for (let id = 20; id <= 26; id++) add(id, id === 20 ? 'pending' : 'active')
    const original = row(20)
    plan('engine'); toggle(20, false)
    expect(row(24).license_suspended).toBe(false)
    expect(row(25).license_suspended).toBe(true)
    expect(row(20)).toEqual({ ...original, manually_disabled: true, license_suspended: true })
    pg.call(`UPDATE site_members SET name='Saved',status=status WHERE id='${uuid(20)}'`)
    pg.db(`DELETE FROM site_members WHERE id='${uuid(21)}'`)
    expect(row(25).license_suspended).toBe(false)
    pg.db(`UPDATE site_members SET status='rejected' WHERE id='${uuid(22)}'`)
    expect(row(26).license_suspended).toBe(false)
    plan('foundry'); plan('enterprise')
    expect(row(20)).toEqual({ ...original, name: 'Saved', manually_disabled: true, license_suspended: true })
    expect(license()).toMatchObject({ current: 5, total: 5 })
    pg.db(`UPDATE site_members SET status='rejected' WHERE id='${uuid(20)}'`)
    expect(row(20)).toMatchObject({ manually_disabled: true, license_suspended: true, status: 'rejected' })
  })

  it.each(['active', 'pending'])('denies all shared access and automation exposure to disabled %s members', status => {
    add(20, status, 'admin', ids.member)
    pg.db(`INSERT INTO site_ownership(site_id,user_id) VALUES ('${ids.site}','${ids.member}')`)
    toggle(20, false)
    expect(row(20).status).toBe(status)
    expect(pg.call(`SELECT current_user_site_role('${ids.site}') IS NULL`, ids.member)).toBe('t')
    expect(pg.call(`SELECT user_can('${ids.site}','select')`, ids.member)).toBe('f')
    expect(pg.call('SELECT count(*) FROM get_my_accessible_sites()', ids.member)).toBe('0')
    for (const table of ['sites', 'site_members', 'settings']) {
      expect(pg.call(`SELECT count(*) FROM ${table}`, ids.member)).toBe('0')
    }
    expect(pg.db(`SELECT team_members FROM settings WHERE site_id='${ids.site}'`)).toBe('[]')
    pg.call(`UPDATE settings SET team_members='[{"email":"member20@example.test","role":"admin"}]' WHERE site_id='${ids.site}'`)
    expect(pg.db(`SELECT team_members FROM settings WHERE site_id='${ids.site}'`)).toBe('[]')
    expect(pg.call(`SELECT current_user_site_role('${ids.site}')`)).toBe('owner')
    toggle(20, true)
    expect(pg.call(`SELECT user_can('${ids.site}','select')`, ids.member)).toBe(status === 'active' ? 't' : 'f')
  })

  it('blocks direct client flag writes and spoofed service claims while preserving ordinary saves', () => {
    add(20)
    expect(() => pg.call(`UPDATE site_members SET manually_disabled=true WHERE id='${uuid(20)}'`)).toThrow('server managed')
    expect(() => pg.call(`INSERT INTO site_members(site_id,role,manually_disabled)
      VALUES ('${ids.site}','admin',true)`)).toThrow('server managed')
    expect(() => pg.call(`SET request.jwt.claims='{"role":"service_role","sub":"${ids.owner}"}';
      UPDATE site_members SET manually_disabled=true WHERE id='${uuid(20)}'`)).toThrow('server managed')
    toggle(20, false)
    expect(() => pg.call(`UPDATE site_members SET manually_disabled=false WHERE id='${uuid(20)}'`)).toThrow('server managed')
    expect(() => pg.call(`UPDATE site_members SET license_suspended=false WHERE id='${uuid(20)}'`)).toThrow('server managed')
    pg.call(`UPDATE site_members SET name='Ordinary save',manually_disabled=manually_disabled WHERE id='${uuid(20)}'`)
    // Even privileged writes cannot leave manually disabled membership unsuspended.
    pg.call(`UPDATE site_members SET license_suspended=false WHERE id='${uuid(20)}'`, ids.owner, 'service_role')
    expect(row(20)).toMatchObject({ name: 'Ordinary save', manually_disabled: true, license_suspended: true })
  })

  it('preserves immutable identity/time guards and authenticated invitation identity constraints', () => {
    add(20, 'pending', 'admin', null)
    toggle(20, false)
    for (const assignment of [`id='${uuid(999)}'`, `site_id='${ids.other}'`, "created_at='2000-01-01'"]) {
      expect(() => pg.call(`UPDATE site_members SET ${assignment} WHERE id='${uuid(20)}'`)).toThrow('immutable')
    }
    expect(() => pg.call(`UPDATE site_members SET user_id='${ids.member}',status='active' WHERE id='${uuid(20)}'`))
      .toThrow('Invitation identity must match authenticated user')
    pg.call(`UPDATE site_members SET user_id='${ids.member}',status='active' WHERE id='${uuid(20)}'`, ids.owner, 'service_role')
    expect(row(20)).toMatchObject({ user_id: ids.member, status: 'active', manually_disabled: true, license_suspended: true })
    expect(() => pg.call(`UPDATE site_members SET user_id='${uuid(999)}' WHERE id='${uuid(20)}'`, ids.owner, 'service_role')).toThrow('immutable')
    pg.call(`INSERT INTO site_members(id,site_id,user_id,role,status,created_at)
      VALUES ('${uuid(21)}','${ids.site}','${uuid(888)}','marketing','active','2000-01-01')`)
    expect(pg.db(`SELECT created_at > now()-interval '1 minute' FROM site_members WHERE id='${uuid(21)}'`)).toBe('t')
  })

  it('rejects reactivation at capacity atomically, including automatic suspension, without displacing another member', () => {
    for (let id = 20; id <= 25; id++) add(id)
    plan('engine'); toggle(20, false)
    const before = pg.db('SELECT jsonb_agg(to_jsonb(sm) ORDER BY id) FROM site_members sm')
    for (const id of [20, 25]) {
      expect(() => toggle(id, true)).toThrow('MEMBER_LIMIT')
      expect(() => toggle(id, true)).toThrow('"requiredPlan": "foundry"')
    }
    expect(pg.db('SELECT jsonb_agg(to_jsonb(sm) ORDER BY id) FROM site_members sm')).toBe(before)
    expect(toggle(21, true)).toEqual(row(21)) // Already enabled at capacity is idempotent.
    expect(license()).toMatchObject({ current: 5, total: 6 })
    plan('foundry')
    expect(toggle(20, true)).toMatchObject({ manually_disabled: false, license_suspended: false })
    expect(license()).toMatchObject({ current: 7, total: 7 })
  })

  it('admits a requested reactivation into a free seat without immediately reranking it out', () => {
    for (let id = 20; id <= 24; id++) add(id)
    toggle(24, false); plan('engine')
    // Model a trusted automatic suspension with a free seat and an older waiting row.
    pg.call(`UPDATE site_members SET license_suspended=true WHERE id='${uuid(20)}'`, ids.owner, 'service_role')
    expect(license().current).toBe(4)
    expect(toggle(24, true)).toMatchObject({ manually_disabled: false, license_suspended: false })
    expect(row(20).license_suspended).toBe(true)
    expect(row(24).license_suspended).toBe(false)
    expect(license()).toMatchObject({ current: 5, total: 6 })
    plan('foundry')
    expect(row(20).license_suspended).toBe(false)
  })

  it('rejects unavailable/cross-site/missing/rejected/null targets and both kinds of owner without mutations', () => {
    add(20); add(21, 'rejected'); add(22, 'active', 'owner'); add(23, 'active', 'admin', ids.owner)
    pg.db(`INSERT INTO site_members(id,site_id,role,status) VALUES ('${uuid(24)}','${ids.site}','admin',NULL)`)
    const before = pg.db('SELECT jsonb_agg(to_jsonb(sm) ORDER BY id) FROM site_members sm')
    for (const enabled of [false, true]) {
      expect(() => pg.call(toggleSql(20, enabled, ids.other), ids.owner, 'service_role')).toThrow('Member does not belong to site')
      expect(() => toggle(999, enabled)).toThrow('Member does not belong to site')
      expect(() => pg.call(toggleSql(20, enabled, uuid(999)), ids.owner, 'service_role')).toThrow('Site is unavailable')
      for (const id of [21, 24]) expect(() => toggle(id, enabled)).toThrow('Only active or pending members')
      for (const id of [22, 23]) expect(() => toggle(id, enabled)).toThrow('Site owners cannot be disabled')
    }
    for (const args of [`NULL,'${uuid(20)}',false`, `'${ids.site}',NULL,false`, `'${ids.site}','${uuid(20)}',NULL`]) {
      expect(() => pg.call(`SELECT set_site_member_enabled(${args})`, ids.owner, 'service_role')).toThrow('Member enabled inputs are required')
    }
    pg.db(`UPDATE sites SET archived_at=now() WHERE id='${ids.site}'`)
    expect(() => toggle(20, false)).toThrow('Site is unavailable')
    expect(() => toggle(20, true)).toThrow('Site is unavailable')
    expect(pg.db('SELECT jsonb_agg(to_jsonb(sm) ORDER BY id) FROM site_members sm')).toBe(before)
  })

  it.each([false, true])('clears manual suspension on primary owner transfer (archived=%s)', archived => {
    add(20, 'active', 'owner', ids.owner); add(21, 'active', 'admin', ids.member)
    toggle(21, false); plan('commission')
    if (archived) pg.db(`UPDATE sites SET archived_at=now() WHERE id='${ids.site}'`)
    pg.db(`UPDATE sites SET user_id='${ids.member}' WHERE id='${ids.site}'`)
    expect(row(21)).toMatchObject({ manually_disabled: false, license_suspended: false, role: 'admin', status: 'active' })
    pg.db(`UPDATE sites SET archived_at=NULL WHERE id='${ids.site}'`)
    expect(row(20)).toMatchObject({ manually_disabled: false, license_suspended: true, role: 'owner' })
    expect(pg.call(`SELECT current_user_site_role('${ids.site}')`, ids.member)).toBe('owner')
    expect(() => toggle(21, false)).toThrow('Site owners cannot be disabled')
    expect(license()).toMatchObject({ current: 1, total: 2 })
  })

  it.each(['toggle', 'invitation'])('serializes a last-seat race against another %s', async competitor => {
    for (let id = 20; id <= 24; id++) add(id)
    toggle(23, false); toggle(24, false); plan('engine')
    const competingSql = competitor === 'toggle' ? toggleSql(24, true) : `INSERT INTO site_members(id,site_id,user_id,role,status)
      VALUES ('${uuid(25)}','${ids.site}','${uuid(125)}','collaborator','pending')`
    const results = await Promise.allSettled([
      pg.concurrent(`BEGIN; ${licenseActor(toggleSql(23, true), ids.owner, 'service_role')}; SELECT pg_sleep(0.25); COMMIT;`),
      pg.concurrent(`BEGIN; ${licenseActor(competingSql, ids.owner, 'service_role')}; COMMIT;`),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    expect(failures).toHaveLength(1)
    expect(failures[0].reason.message).toContain('MEMBER_LIMIT')
    expect(license()).toMatchObject({ current: 5, total: 5 })
    expect(pg.db("SELECT count(*) FROM site_members WHERE manually_disabled AND NOT license_suspended")).toBe('0')
    expect(pg.db("SELECT count(*) FROM site_members WHERE status NOT IN ('active','pending')")).toBe('0')
  })

  it('fails closed under repeatable read and rolls back the forward migration as a unit', () => {
    add(20); toggle(20, false)
    expect(() => pg.call(`BEGIN ISOLATION LEVEL REPEATABLE READ; ${toggleSql(20, true)}; COMMIT;`, ids.owner, 'service_role'))
      .toThrow('READ COMMITTED')
    expect(row(20)).toMatchObject({ manually_disabled: true, license_suspended: true })
    pg.install(); pg.db(partnerLicenseMigration)
    const before = pg.db("SELECT pg_get_functiondef('public.guard_member_license()'::regprocedure)")
    const failing = migration.replace("NOTIFY pgrst, 'reload schema';", () => "DO $$ BEGIN RAISE EXCEPTION 'Injected manual migration failure'; END; $$;")
    expect(() => pg.db(failing)).toThrow('Injected manual migration failure')
    expect(pg.db("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='site_members' AND column_name='manually_disabled'")).toBe('0')
    expect(pg.db("SELECT to_regprocedure('public.set_site_member_enabled(uuid,uuid,boolean)') IS NULL")).toBe('t')
    expect(pg.db("SELECT pg_get_functiondef('public.guard_member_license()'::regprocedure)")).toBe(before)
  })
})