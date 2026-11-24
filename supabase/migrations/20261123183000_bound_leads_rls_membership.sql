BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = public, pg_temp;

-- Refuse to replace a policy that differs from the audited production baseline.
-- Acquire the policy DDL lock before inspection so a concurrent change cannot
-- slip between the check and replacement. No table scan or rewrite is needed.
LOCK TABLE public.leads IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.leads'::regclass AND polname = 'leads_unified'
      AND polcmd = '*' AND polpermissive AND polroles = ARRAY[0::oid] AND polwithcheck IS NULL
      AND md5(regexp_replace(pg_get_expr(polqual, polrelid), '[[:space:]]+', '', 'g'))
        = '5aeeeb6f13b85628356a4900444522b7'
  ) THEN
    RAISE EXCEPTION 'Unexpected leads_unified policy; review the deployed baseline before changing it';
  END IF;
END $$;

-- Each set depends only on the actor, not the lead. PostgreSQL can hash these
-- subplans once per statement rather than evaluating parent RLS per lead.
-- Keep sites in BOTH sets: its own RLS still enforces archival and licensing,
-- including for co-owners. No definer, bypass, or stored entitlement is added.
-- An implicit WITH CHECK continues to enforce the same rule for new row values.
ALTER POLICY leads_unified ON public.leads USING (
  (SELECT current_setting('role', true)) = 'service_role'
  OR ((SELECT auth.jwt()) ->> 'role') = 'service_role'
  OR site_id IN (
    SELECT s.id FROM public.sites s
    WHERE s.user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.site_ownership so
        WHERE so.site_id = s.id AND so.user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
          AND sm.status = 'active' AND sm.restrict_to_assigned_only = false
      )
  )
  OR (
    (user_id = (SELECT auth.uid()) OR assignee_id = (SELECT auth.uid()))
    AND site_id IN (
      SELECT s.id FROM public.sites s
      WHERE EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid()) AND sm.status = 'active'
      )
    )
  )
);

COMMIT;