-- Candidate A only: remove duplicate SELECT capability checks, not ownership work.
-- Catalog fingerprints verified read-only on Makinari at 2026-11-26 19:46 UTC.
-- Run with serialized schema deployment: table locks do not fence concurrent
-- CREATE OR REPLACE FUNCTION by another privileged migration session.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = public, pg_temp;

-- Serialize policy inspection and replacement; no row scan, rewrite or backfill.
LOCK TABLE public.remote_instances, public.instance_logs IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE baseline record;
BEGIN
  FOR baseline IN SELECT * FROM (VALUES
    ('public.instance_row_access(uuid,uuid,uuid)', '469ebb69538fec7b383716b16bdf7f30',
      '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
    ('public.user_can(uuid,text)', '1787c52b61c973bcc26917af2a1a4137',
      '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
  ) AS b(signature, definition_hash, acl) LOOP
    -- Exact definition includes body, language, volatility, security mode and
    -- configuration. Do not accept an approximately equivalent helper body.
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure(baseline.signature)
        AND md5(pg_get_functiondef(p.oid)) = baseline.definition_hash
        AND pg_get_userbyid(p.proowner) = 'postgres'
        AND p.proacl::text = baseline.acl
    ) THEN
      RAISE EXCEPTION 'Unexpected Robots helper fingerprint: %', baseline.signature;
    END IF;
  END LOOP;

  FOR baseline IN SELECT * FROM (VALUES
    ('remote_instances', 'be82d41441bf05123e4f35aa4de49004'),
    ('instance_logs', '0800e622235ecc7f86cb09c354068553')
  ) AS b(relation, expression_hash) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
      WHERE p.polrelid = ('public.' || baseline.relation)::regclass
        AND c.relkind = 'r' AND c.relrowsecurity AND NOT c.relforcerowsecurity
        AND p.polname = 'instance_ownership_select' AND p.polcmd = 'r'
        AND NOT p.polpermissive
        AND p.polroles = ARRAY[(SELECT oid FROM pg_roles WHERE rolname = 'authenticated')]
        AND p.polwithcheck IS NULL
        AND md5(pg_get_expr(p.polqual, p.polrelid)) = baseline.expression_hash
    ) THEN
      RAISE EXCEPTION 'Unexpected Robots SELECT policy fingerprint: %', baseline.relation;
    END IF;
  END LOOP;
END $$;

-- This exact helper already requires user_can(site_id, 'select') IS TRUE.
ALTER POLICY instance_ownership_select ON public.remote_instances
  USING (public.instance_row_access(site_id, user_id, created_by));

-- The invoker-scoped same-site parent read still intersects ALL parent RLS,
-- including the restrictive helper above, location and procurement guards.
ALTER POLICY instance_ownership_select ON public.instance_logs USING (
  EXISTS (SELECT 1 FROM public.remote_instances parent
    WHERE parent.id = instance_logs.instance_id AND parent.site_id = instance_logs.site_id)
);

COMMIT;