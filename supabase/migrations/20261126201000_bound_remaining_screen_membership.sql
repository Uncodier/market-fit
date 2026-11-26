BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = public, pg_temp;

-- Inspect under the same locks used by policy DDL; refuse a changed baseline.
LOCK TABLE public.content, public.requirements, public.segments,
  public.deals, public.deal_owners IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE baseline record;
BEGIN
  FOR baseline IN SELECT * FROM (VALUES
    ('content','content_unified_access_policy','7652ccf18f25ae8bc7136751b9ee3168'),
    ('requirements','requirements_optimized_policy','6dbab219926ea9af8b6647675f5a2c94'),
    ('segments','segments_unified','4a31f214f80c877249e8672ea211ff0a'),
    ('deals','deals_unified','3cf40ca71964b8a31442ec0e665bf3c7'),
    ('deal_owners','deal_owners_unified','84c0976802ec6841f0a182081f0c7c21')
  ) AS b(relation,policy,hash) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy
      WHERE polrelid = ('public.'||baseline.relation)::regclass
        AND polname = baseline.policy AND polcmd = '*' AND polpermissive
        AND polroles = ARRAY[0::oid] AND polwithcheck IS NULL
        AND md5(regexp_replace(pg_get_expr(polqual,polrelid),'[[:space:]]+','','g')) = baseline.hash
    ) THEN RAISE EXCEPTION 'Unexpected membership policy on %', baseline.relation;
    END IF;
  END LOOP;
END $$;

-- Actor-only sets bound membership work independently of candidate row count.
-- Both sets retain caller-scoped sites RLS (including licensing and archival).
-- ALL/PUBLIC/permissive and implicit WITH CHECK remain unchanged, as do every
-- restrictive policy, grant, trigger and helper's security context.
ALTER POLICY content_unified_access_policy ON public.content USING (
  site_id IN (
    SELECT s.id FROM public.sites s
    WHERE s.user_id=(SELECT auth.uid())
      OR EXISTS (SELECT 1 FROM public.site_ownership so
        WHERE so.site_id=s.id AND so.user_id=(SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM public.site_members sm
        WHERE sm.site_id=s.id AND sm.user_id=(SELECT auth.uid())
          AND sm.status='active' AND sm.restrict_to_assigned_only=false)
  ) OR (
    (user_id=(SELECT auth.uid()) OR author_id=(SELECT auth.uid()))
    AND site_id IN (SELECT s.id FROM public.sites s WHERE EXISTS (
      SELECT 1 FROM public.site_members sm WHERE sm.site_id=s.id
        AND sm.user_id=(SELECT auth.uid()) AND sm.status='active'))
  )
  -- These original direct branches intentionally do not require a visible site.
  OR user_id=(SELECT auth.uid()) OR author_id=(SELECT auth.uid())
);

ALTER POLICY requirements_optimized_policy ON public.requirements USING (
  site_id IN (
    SELECT s.id FROM public.sites s
    WHERE s.user_id=(SELECT auth.uid())
      OR EXISTS (SELECT 1 FROM public.site_ownership so
        WHERE so.site_id=s.id AND so.user_id=(SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM public.site_members sm
        WHERE sm.site_id=s.id AND sm.user_id=(SELECT auth.uid())
          AND sm.status='active' AND sm.restrict_to_assigned_only=false)
  ) OR (
    user_id=(SELECT auth.uid())
    AND site_id IN (SELECT s.id FROM public.sites s WHERE EXISTS (
      SELECT 1 FROM public.site_members sm WHERE sm.site_id=s.id
        AND sm.user_id=(SELECT auth.uid()) AND sm.status='active'))
  )
);

ALTER POLICY segments_unified ON public.segments USING (
  app_auth.is_service_role_or_user_condition(
    site_id IN (
      SELECT s.id FROM public.sites s
      WHERE s.user_id=(SELECT auth.uid())
        OR EXISTS (SELECT 1 FROM public.site_ownership so
          WHERE so.site_id=s.id AND so.user_id=(SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM public.site_members sm
          WHERE sm.site_id=s.id AND sm.user_id=(SELECT auth.uid())
            AND sm.status='active' AND sm.restrict_to_assigned_only=false)
    ) OR (
      user_id=(SELECT auth.uid())
      AND site_id IN (SELECT s.id FROM public.sites s WHERE EXISTS (
        SELECT 1 FROM public.site_members sm WHERE sm.site_id=s.id
          AND sm.user_id=(SELECT auth.uid()) AND sm.status='active'))
    )
  )
);

ALTER POLICY deals_unified ON public.deals USING (
  (SELECT current_setting('role',true))='service_role'
  OR ((SELECT auth.jwt())->>'role')='service_role'
  OR site_id IN (
    SELECT s.id FROM public.sites s
    WHERE s.user_id=(SELECT auth.uid())
      OR EXISTS (SELECT 1 FROM public.site_ownership so
        WHERE so.site_id=s.id AND so.user_id=(SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM public.site_members sm
        WHERE sm.site_id=s.id AND sm.user_id=(SELECT auth.uid())
          AND sm.status='active' AND sm.restrict_to_assigned_only=false)
  ) OR (
    -- Keep the existing definer helper: replacing it with an invoker scan of
    -- deal_owners would change visibility and introduce recursive parent RLS.
    (user_id=(SELECT auth.uid()) OR public.is_deal_owner(id,(SELECT auth.uid())))
    AND site_id IN (SELECT s.id FROM public.sites s WHERE EXISTS (
      SELECT 1 FROM public.site_members sm WHERE sm.site_id=s.id
        AND sm.user_id=(SELECT auth.uid()) AND sm.status='active'))
  )
);

ALTER POLICY deal_owners_unified ON public.deal_owners USING (
  deal_id IN (
    SELECT d.id FROM public.deals d WHERE
      (SELECT current_setting('role',true))='service_role'
      OR ((SELECT auth.jwt())->>'role')='service_role'
      OR d.site_id IN (
        SELECT s.id FROM public.sites s WHERE s.user_id=(SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.site_members sm
            WHERE sm.site_id=s.id AND sm.user_id=(SELECT auth.uid()))
      )
  )
  -- Preserve the visible parent requirement and this policy's original member
  -- predicate: no active/assignment filter and no independent co-owner branch.
);

COMMIT;