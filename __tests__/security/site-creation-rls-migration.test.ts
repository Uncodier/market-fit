/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  licenseIds as ids, licensePostgres, licensePostgresAvailable, licenseUuid as uuid,
} from './site-license-postgres'

const root = path.resolve(__dirname, '../..')
const migration = readFileSync(path.join(root, 'supabase/migrations/20261019190000_fix_site_creation_returning_rls.sql'), 'utf8')
const archiveMigration = readFileSync(path.join(root, 'supabase/migrations/20260929221000_archive_sites.sql'), 'utf8')
const manualMigration = readFileSync(path.join(root, 'supabase/migrations/20261007223500_manual_member_deactivation.sql'), 'utf8')
const suite = licensePostgresAvailable ? describe : describe.skip

suite('site creation RLS in disposable PostgreSQL', () => {
  const pg = licensePostgres()
  const insert = (id: number, owner = ids.owner, returning = true) =>
    `INSERT INTO public.sites(id,user_id,name,url) VALUES ('${uuid(id)}','${owner}','New project','https://example.test')${returning ? ' RETURNING *' : ''}`
  const addMember = (status = 'active', role = 'admin') => pg.db(`
    INSERT INTO public.site_members(id,site_id,user_id,email,role,status)
    VALUES ('${uuid(20)}','${ids.site}','${ids.member}','member@example.test','${role}','${status}')`)

  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    pg.install()
    pg.db(manualMigration)
    // Core schema/policies predate this repository's bootstrap history. Mirror
    // the deployed site policies rather than the fixture's permissive shortcut.
    pg.db(`
      ALTER TABLE public.sites ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE public.sites ALTER COLUMN user_id SET NOT NULL;
      ALTER TABLE public.sites ADD COLUMN name text NOT NULL DEFAULT 'Project',
        ADD COLUMN url text, ADD COLUMN archived_by uuid, ADD COLUMN archive_snapshot jsonb;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
      DROP POLICY existing_sites ON public.sites;
      CREATE POLICY sites_insert_policy ON public.sites FOR INSERT TO authenticated
        WITH CHECK (user_id = (SELECT auth.uid()));
      CREATE POLICY sites_select_policy ON public.sites FOR SELECT TO authenticated
        USING (user_id = (SELECT auth.uid()) OR EXISTS (
          SELECT 1 FROM public.site_members sm WHERE sm.site_id = sites.id
            AND sm.user_id = (SELECT auth.uid()) AND sm.status = 'active'));
      CREATE POLICY sites_update_policy ON public.sites FOR UPDATE
        USING (user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.site_members sm WHERE sm.site_id = sites.id
            AND sm.user_id = auth.uid() AND sm.status = 'active' AND sm.role IN ('owner','admin')))
        WITH CHECK (user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.site_members sm WHERE sm.site_id = sites.id
            AND sm.user_id = auth.uid() AND sm.status = 'active' AND sm.role IN ('owner','admin')));
      CREATE POLICY service_role_full_access_sites ON public.sites FOR ALL TO service_role
        USING (true) WITH CHECK (true);
      REVOKE DELETE ON public.sites FROM authenticated;
    `)
    // Use the real archive trigger and restrictive policy without unrelated
    // domain/commerce schema dependencies from the full archival migration.
    pg.db(archiveMigration.slice(archiveMigration.indexOf('-- Lifecycle fields'), archiveMigration.indexOf('-- Lock the parent')))
    pg.db(migration)
  })

  it('reproduces the original RETURNING failure and rollback, even with no logo', () => {
    pg.db(`ALTER POLICY license_sites_access ON public.sites
      USING (public.current_user_site_role(id) IS NOT NULL)`)
    expect(() => pg.call(insert(30))).toThrow('row-level security')
    expect(pg.db(`SELECT count(*) FROM public.sites WHERE id='${uuid(30)}'`)).toBe('0')
    // Without RETURNING the INSERT check passes; a later statement sees the row.
    pg.call(insert(31, ids.owner, false))
    expect(pg.call(`SELECT current_user_site_role('${uuid(31)}')`)).toBe('owner')
    pg.db(migration)
    expect(pg.call(insert(30))).toContain(uuid(30))
  })

  it('creates and returns a first project before any membership or billing exists', () => {
    const newOwner = uuid(99)
    expect(pg.call('SELECT count(*) FROM public.sites', newOwner)).toBe('0')
    const result = JSON.parse(pg.call(`WITH created AS (
      INSERT INTO public.sites(user_id,name,url) VALUES ('${newOwner}','First project','https://example.test')
      RETURNING *
    ) SELECT row_to_json(created) FROM created`, newOwner))
    expect(result).toMatchObject({ user_id: newOwner, name: 'First project', archived_at: null })
    expect(result.id).toMatch(/^[a-f0-9-]{36}$/)
    expect(pg.db(`SELECT count(*) FROM public.site_members WHERE site_id='${result.id}'`)).toBe('0')
    expect(pg.db(`SELECT count(*) FROM public.billing WHERE site_id='${result.id}'`)).toBe('0')
    expect(pg.call(`SELECT current_user_site_role('${result.id}')`, newOwner)).toBe('owner')
    expect(pg.call(`SELECT count(*) FROM get_my_accessible_sites()`, newOwner)).toBe('1')
    pg.call(`INSERT INTO public.settings(site_id) VALUES ('${result.id}')`, newOwner)
  })

  it('keeps project creation unlimited for existing owners and suspended members', () => {
    addMember()
    pg.db(`UPDATE public.billing SET plan='commission' WHERE site_id='${ids.site}'`)
    expect(pg.call(`SELECT current_user_site_role('${ids.site}')`, ids.member)).toBe('')
    expect(pg.call(insert(30))).toContain(uuid(30))
    expect(pg.call(insert(31))).toContain(uuid(31))
    expect(pg.call(insert(32, ids.member), ids.member)).toContain(uuid(32))
    expect(pg.call(`SELECT count(*) FROM public.sites`, ids.member)).toBe('1')
  })

  it('denies anonymous, missing-identity, foreign-owner and mixed-owner inserts', () => {
    expect(() => pg.call(insert(30), ids.owner, 'anon')).toThrow('permission denied')
    expect(() => pg.db(`SET ROLE authenticated; SET request.jwt.claims='{"role":"authenticated"}'; ${insert(30)}`))
      .toThrow('row-level security')
    expect(() => pg.call(insert(30, ids.foreign))).toThrow('row-level security')
    expect(() => pg.call(`INSERT INTO public.sites(id,user_id) VALUES
      ('${uuid(30)}','${ids.owner}'),('${uuid(31)}','${ids.foreign}') RETURNING *`)).toThrow('row-level security')
    expect(pg.db(`SELECT count(*) FROM public.sites WHERE id IN ('${uuid(30)}','${uuid(31)}')`)).toBe('0')
  })

  it('preserves cross-tenant denial and does not allow taking ownership', () => {
    expect(pg.call(`SELECT count(*) FROM public.sites WHERE id='${ids.other}'`)).toBe('0')
    expect(pg.call(`UPDATE public.sites SET name='Forbidden' WHERE id='${ids.other}' RETURNING id`)).toBe('')
    expect(() => pg.call(`UPDATE public.sites SET user_id='${ids.foreign}' WHERE id='${ids.site}' RETURNING id`))
      .toThrow('row-level security')
    expect(pg.db(`SELECT user_id FROM public.sites WHERE id='${ids.site}'`)).toBe(ids.owner)
  })

  it('preserves active manager access and denies suspended/manual-disabled members', () => {
    addMember()
    expect(pg.call(`SELECT count(*) FROM public.sites`, ids.member)).toBe('1')
    expect(pg.call(`UPDATE public.sites SET name='Manager edit' WHERE id='${ids.site}' RETURNING name`, ids.member)).toBe('Manager edit')
    pg.call(`SELECT set_site_member_enabled('${ids.site}','${uuid(20)}',false)`, ids.owner, 'service_role')
    expect(pg.call(`SELECT count(*) FROM public.sites`, ids.member)).toBe('0')
    expect(pg.call(`UPDATE public.sites SET name='Forbidden' WHERE id='${ids.site}' RETURNING id`, ids.member)).toBe('')
    expect(pg.call(`SELECT count(*) FROM get_my_accessible_sites()`, ids.member)).toBe('0')
    expect(pg.call(`SELECT count(*) FROM public.sites WHERE id='${ids.site}'`)).toBe('1')
  })

  it.each(['pending', 'rejected'])('denies %s membership without allowing self-owned row spoofing', status => {
    addMember(status)
    expect(pg.call(`SELECT count(*) FROM public.sites`, ids.member)).toBe('0')
    expect(pg.call(`UPDATE public.sites SET user_id='${ids.member}' WHERE id='${ids.site}' RETURNING id`, ids.member)).toBe('')
  })

  it('retains archival protection even for the primary owner', () => {
    pg.call(`UPDATE public.sites SET archived_at=now() WHERE id='${ids.site}'`, ids.owner, 'service_role')
    expect(pg.call(`SELECT count(*) FROM public.sites WHERE id='${ids.site}'`)).toBe('0')
    expect(pg.call(`UPDATE public.sites SET archived_at=NULL WHERE id='${ids.site}' RETURNING id`)).toBe('')
    expect(() => pg.call(`INSERT INTO public.sites(id,user_id,archived_at)
      VALUES ('${uuid(30)}','${ids.owner}',now()) RETURNING *`)).toThrow('Site archival requires password verification')
    expect(() => pg.call(`INSERT INTO public.sites(id,user_id,archive_snapshot)
      VALUES ('${uuid(30)}','${ids.owner}','{}') RETURNING *`)).toThrow('Site archival requires password verification')
    expect(pg.db(`SELECT archived_at IS NOT NULL FROM public.sites WHERE id='${ids.site}'`)).toBe('t')
  })

  it('is rerunnable and changes only the restrictive row visibility expression', () => {
    const policies = () => pg.db(`SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p
      WHERE schemaname='public' AND tablename IN ('sites','settings','site_members')`)
    const before = policies()
    pg.db(migration)
    expect(policies()).toBe(before)
    expect(pg.db(`SELECT permissive,cmd,with_check FROM pg_policies WHERE policyname='license_sites_access'`))
      .toBe('RESTRICTIVE|ALL|((user_id = auth.uid()) OR (current_user_site_role(id) IS NOT NULL))')
    expect(pg.db(`SELECT count(*) FROM pg_trigger WHERE tgname IN ('guard_site_archive_state','license_site_owner_changed','guard_billing_credit_buckets')`)).toBe('3')
    expect(pg.db(`SELECT has_table_privilege('authenticated','public.sites','DELETE')`)).toBe('f')
    expect(migration.trim().startsWith('BEGIN;')).toBe(true)
    expect(migration.trim().endsWith('COMMIT;')).toBe(true)
  })
})