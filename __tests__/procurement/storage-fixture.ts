import { ids, isolatedPostgres, migration, uuid } from '../security/isolated-postgres'

export { actorSql, ids, isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
export const actors = { restricted: uuid(100), unlicensed: uuid(101), member: uuid(102) }
export const policy = { version: 1, settings: {}, rules: [] }
export const sqlJson = (document: unknown) => `'${JSON.stringify(document).replace(/'/g, "''")}'::jsonb`
export const saveSql = (revision = 0, document: unknown = policy, site = ids.site) =>
  `SELECT row_to_json(saved) FROM public.save_procurement_policy('${site}', ${revision}, ${sqlJson(document)}) saved;`

// Only existing authorization dependencies are stubbed. Every policy table,
// constraint, grant, trigger and save function comes from the actual migration.
export function installStorageFixture(pg: ReturnType<typeof isolatedPostgres>) {
  pg.db(`DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public; CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA public, auth TO postgres, anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
    $$;
    CREATE TABLE public.sites (id uuid PRIMARY KEY, user_id uuid NOT NULL, archived_at timestamptz);
    CREATE TABLE public.fixture_members (
      site_id uuid REFERENCES public.sites, user_id uuid, role text,
      active boolean DEFAULT true, licensed boolean DEFAULT true, restricted boolean DEFAULT false
    );
    CREATE FUNCTION public.current_user_site_role(p_site_id uuid) RETURNS text
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
      SELECT CASE WHEN s.user_id = auth.uid() THEN 'owner' ELSE
        (SELECT m.role FROM public.fixture_members m WHERE m.site_id = s.id
          AND m.user_id = auth.uid() AND m.active AND m.licensed) END
      FROM public.sites s WHERE s.id = p_site_id AND s.archived_at IS NULL
    $$;
    CREATE FUNCTION public.current_user_has_site_location_restrictions(p_site_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
      SELECT EXISTS (SELECT 1 FROM public.fixture_members m
        WHERE m.site_id = p_site_id AND m.user_id = auth.uid() AND m.restricted)
    $$;
    INSERT INTO public.sites VALUES ('${ids.site}', '${ids.owner}', NULL),
      ('${ids.otherSite}', '${ids.foreign}', NULL);
    INSERT INTO public.fixture_members(site_id,user_id,role,active,licensed,restricted) VALUES
      ('${ids.site}','${ids.admin}','admin',true,true,false),
      ('${ids.site}','${ids.inactive}','admin',false,true,false),
      ('${ids.site}','${actors.restricted}','admin',true,true,true),
      ('${ids.site}','${actors.unlicensed}','admin',true,false,false),
      ('${ids.site}','${actors.member}','member',true,true,false);
    -- Simulate Supabase's broad default grants: migration must remove them.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
  pg.db(migration('20261027160000_procurement_policy_versions.sql'))
  // Exercise SECURITY DEFINER as a non-superuser table owner, not the harness superuser.
  pg.db(`ALTER TABLE public.procurement_policy_versions OWNER TO postgres;
    ALTER FUNCTION public.save_procurement_policy(uuid,integer,jsonb) OWNER TO postgres;`)
}