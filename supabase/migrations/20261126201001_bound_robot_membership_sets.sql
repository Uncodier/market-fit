-- Local candidate, following applied 20261126195001. No data/backfill/RPC changes.
-- Audited with read-only TLS catalog queries on 2026-11-26.
-- Serialize schema deployments: table locks cannot fence privileged function DDL.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = public, pg_temp;

LOCK TABLE public.sites, public.site_members, public.site_ownership IN ACCESS SHARE MODE;
LOCK TABLE public.remote_instances IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE baseline record;
BEGIN
  FOR baseline IN SELECT * FROM (VALUES
    ('public.instance_row_access(uuid,uuid,uuid)', '469ebb69538fec7b383716b16bdf7f30',
      '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
    ('public.user_can(uuid,text)', '1787c52b61c973bcc26917af2a1a4137',
      '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
    ('public.current_user_site_role(uuid)', '290987884b14b194caddbf2f2553fec8',
      '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
  ) AS b(signature, definition_hash, acl) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure(baseline.signature)
        AND md5(pg_get_functiondef(p.oid)) = baseline.definition_hash
        AND pg_get_userbyid(p.proowner) = 'postgres' AND p.proacl::text = baseline.acl
    ) THEN RAISE EXCEPTION 'Unexpected Robots helper fingerprint: %', baseline.signature;
    END IF;
  END LOOP;

  -- Invoker reads must expose precisely the actor's owner/member rows admitted
  -- by user_can. Pin all applicable SELECT policies, including restrictive ones.
  FOR baseline IN SELECT * FROM (VALUES
    ('sites', '7745b73403b7954da786f65806200254'),
    ('site_members', '54436f7ba941a6fd3c3bf74e7bfcb9dc'),
    ('site_ownership', '5702b35c485cf5c0c6282c161d57c4c3')
  ) AS b(relation, policy_hash) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c
      WHERE c.oid=('public.'||baseline.relation)::regclass
        AND c.relkind='r' AND c.relrowsecurity AND NOT c.relforcerowsecurity)
      OR (SELECT md5(jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,
        pg_get_expr(p.polqual,p.polrelid)) ORDER BY p.polname)::text)
        FROM pg_policy p WHERE p.polrelid=('public.'||baseline.relation)::regclass
          AND p.polcmd IN ('r','*') AND (0::oid=ANY(p.polroles)
            OR (SELECT oid FROM pg_roles WHERE rolname='authenticated')=ANY(p.polroles)))
        IS DISTINCT FROM baseline.policy_hash
    THEN RAISE EXCEPTION 'Unexpected Robots membership policy fingerprint: %', baseline.relation;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.remote_instances'::regclass
    AND relkind='r' AND relrowsecurity AND NOT relforcerowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.remote_instances'::regclass
      AND polname='instance_ownership_select' AND polcmd='r' AND NOT polpermissive
      AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]
      AND polwithcheck IS NULL
      AND md5(pg_get_expr(polqual,polrelid))='4aff622cec399bc86eb6501a615431d4')
    OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.remote_instances'::regclass
      AND polname='remote_instances_access_policy' AND polcmd='*' AND polpermissive
      AND polroles=ARRAY[0::oid]
      AND md5(pg_get_expr(polqual,polrelid))='83e80153cf04cbea220bd23abdea37ac'
      AND md5(pg_get_expr(polwithcheck,polrelid))='83e80153cf04cbea220bd23abdea37ac')
  THEN RAISE EXCEPTION 'Unexpected Robots parent policy fingerprint'; END IF;
END $$;

-- Each candidate comes only from the actor, not a global licensed-sites scan.
-- Keep the sites invoker read: it is part of the old permissive policy boundary.
-- ALTER USING leaves the explicit historical WITH CHECK byte-for-byte intact.
ALTER POLICY remote_instances_access_policy ON public.remote_instances USING (
  current_setting('role', true) = 'service_role'
  OR (auth.jwt() ->> 'role') = 'service_role'
  OR site_id IN (
    SELECT s.id FROM public.sites s WHERE s.id IN (
      SELECT owned.id FROM public.sites owned WHERE owned.user_id=(SELECT auth.uid())
      UNION
      SELECT so.site_id FROM public.site_ownership so WHERE so.user_id=(SELECT auth.uid())
      UNION
      SELECT sm.site_id FROM public.site_members sm
        WHERE sm.user_id=(SELECT auth.uid()) AND sm.status='active'
    )
  )
);

-- Exact instance_row_access SELECT semantics: non-null actor AND user_can IS
-- TRUE AND owner/co-owner/unrestricted member, or active member + either author.
-- NULL restriction means unrestricted here (unlike some other module policies).
-- Keep user_can inside both actor-only sets; do not infer a license from status.
ALTER POLICY instance_ownership_select ON public.remote_instances USING (
  (SELECT auth.uid()) IS NOT NULL AND (
    site_id IN (
      SELECT candidate.site_id FROM (
        SELECT s.id AS site_id FROM public.sites s WHERE s.user_id=(SELECT auth.uid())
        UNION
        SELECT so.site_id FROM public.site_ownership so WHERE so.user_id=(SELECT auth.uid())
        UNION
        SELECT sm.site_id FROM public.site_members sm
          WHERE sm.user_id=(SELECT auth.uid()) AND sm.status='active'
            AND NOT coalesce(sm.restrict_to_assigned_only, false)
      ) candidate WHERE public.user_can(candidate.site_id, 'select') IS TRUE
    ) OR (
      (user_id=(SELECT auth.uid()) OR created_by=(SELECT auth.uid()))
      AND site_id IN (
        SELECT sm.site_id FROM public.site_members sm
          WHERE sm.user_id=(SELECT auth.uid()) AND sm.status='active'
            AND public.user_can(sm.site_id, 'select') IS TRUE
      )
    )
  )
);

-- instance_logs/assets/RPC retain their invoker same-site parent reads and all
-- location/procurement/write policies. No privileged helper or cache is added.
COMMIT;