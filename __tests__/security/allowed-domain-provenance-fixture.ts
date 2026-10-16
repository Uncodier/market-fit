import { ids, migration, uuid } from './isolated-postgres'

export const provenanceFile = '20261016171100_allowed_domain_provenance.sql'
export const provenanceSql = migration(provenanceFile)
export const requirement = uuid(100)
export const otherRequirement = uuid(101)
export const secondRequirement = uuid(102)

export function installDomainFixture(db: (sql: string) => string) {
  db(`DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public; CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
    $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role')
    $$;
    -- Core tables predate the checked-in migration history. Use synthetic rows,
    -- and explicit existing policies/grants to prove this migration preserves them.
    CREATE TABLE public.sites (id uuid PRIMARY KEY, user_id uuid NOT NULL, archived_at timestamptz);
    CREATE TABLE public.requirements (id uuid PRIMARY KEY, site_id uuid NOT NULL REFERENCES public.sites);
    CREATE TABLE public.allowed_domains (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites,
      domain text NOT NULL CHECK (domain = 'localhost' OR domain ~* '^([a-zA-Z0-9-]+\\.)*[a-zA-Z0-9-]+\\.[a-zA-Z]{2,}$'
        OR domain ~* '^(\\d{1,3}\\.){3}\\d{1,3}$' OR domain ~* '^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$'),
      created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
      updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()), UNIQUE (site_id, domain)
    );
    GRANT SELECT ON public.sites TO authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirements, public.allowed_domains TO authenticated, service_role;
    ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.allowed_domains ENABLE ROW LEVEL SECURITY;
    CREATE POLICY requirement_site_access ON public.requirements TO authenticated
      USING (EXISTS (SELECT 1 FROM public.sites WHERE id = site_id AND user_id = auth.uid()));
    CREATE POLICY domain_site_access ON public.allowed_domains TO authenticated
      USING (EXISTS (SELECT 1 FROM public.sites WHERE id = site_id AND user_id = auth.uid()));
    INSERT INTO public.sites(id,user_id) VALUES ('${ids.site}','${ids.owner}'), ('${ids.otherSite}','${ids.foreign}');
    INSERT INTO public.requirements VALUES ('${requirement}','${ids.site}'),
      ('${secondRequirement}','${ids.site}'), ('${otherRequirement}','${ids.otherSite}');
    INSERT INTO public.allowed_domains(site_id,domain,created_at) VALUES
      ('${ids.site}','manual.example.test','2026-10-01T00:00:00Z'),
      ('${ids.site}','preview.vercel.app','2026-10-02T00:00:00Z');`)
  // Keep the actual pre-existing archival guard installed, rather than mocking it.
  const archive = migration('20260929221000_archive_sites.sql')
  const guard = archive.slice(archive.indexOf('CREATE OR REPLACE FUNCTION public.guard_archived_site_domain()'))
    .split('CREATE OR REPLACE FUNCTION public.archive_site(')[0]
  db(guard)
}

export const domainSecuritySnapshot = `SELECT jsonb_build_object(
  'rls', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.allowed_domains'::regclass),
  'grants', (SELECT jsonb_agg(row_to_json(g) ORDER BY grantee, privilege_type)
    FROM information_schema.role_table_grants g WHERE table_schema = 'public' AND table_name = 'allowed_domains'),
  'policies', (SELECT jsonb_agg(row_to_json(p) ORDER BY policyname)
    FROM pg_policies p WHERE schemaname = 'public' AND tablename = 'allowed_domains'),
  'archive_trigger', (SELECT pg_get_triggerdef(oid) FROM pg_trigger
    WHERE tgrelid = 'public.allowed_domains'::regclass AND tgname = 'guard_archived_site_domain')
)`