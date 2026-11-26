BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = public, pg_temp;

LOCK TABLE public.tasks, public.conversations, public.messages IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE baseline record;
BEGIN
  FOR baseline IN SELECT * FROM (VALUES
    ('tasks','tasks_unified','d5ae97415b9c3317560c5c657508a2b9'),
    ('conversations','conversations_unified_access_policy','b2500c57b850d6a4f4920c04c832fef9'),
    ('messages','messages_unified_access_policy','35714e74f2b7d41e3cc79c200da2a9c9')
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

-- Keep user-scoped parent RLS, including current licensing and archival.
-- Actor-only sets can be evaluated once, instead of once per candidate row.
ALTER POLICY tasks_unified ON public.tasks USING (
  site_id IN (
    SELECT s.id FROM public.sites s
    WHERE s.user_id = (SELECT auth.uid())
      OR EXISTS (SELECT 1 FROM public.site_ownership so
        WHERE so.site_id=s.id AND so.user_id=(SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM public.site_members sm
        WHERE sm.site_id=s.id AND sm.user_id=(SELECT auth.uid())
          AND sm.status='active' AND sm.restrict_to_assigned_only=false)
  ) OR (
    (user_id=(SELECT auth.uid()) OR assignee=(SELECT auth.uid()))
    AND site_id IN (
      SELECT s.id FROM public.sites s WHERE EXISTS (
        SELECT 1 FROM public.site_members sm WHERE sm.site_id=s.id
          AND sm.user_id=(SELECT auth.uid()) AND sm.status='active')
    )
  )
);

-- Preserve the original direct-user/visitor and NULL-identity branches.
-- Restrictive location and internal-review policies remain authoritative.
ALTER POLICY conversations_unified_access_policy ON public.conversations USING (
  (SELECT auth.uid()) IS NULL OR (
    (SELECT auth.uid()) IS NOT NULL AND (
      user_id=(SELECT auth.uid()) OR visitor_id=(SELECT auth.uid())
      OR site_id IN (
        SELECT s.id FROM public.sites s
        WHERE s.user_id=(SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.site_ownership so
            WHERE so.site_id=s.id AND so.user_id=(SELECT auth.uid()))
          OR EXISTS (SELECT 1 FROM public.site_members sm
            WHERE sm.site_id=s.id AND sm.user_id=(SELECT auth.uid())
              AND sm.status='active' AND sm.restrict_to_assigned_only=false)
      ) OR (
        site_id IN (SELECT s.id FROM public.sites s WHERE EXISTS (
          SELECT 1 FROM public.site_members sm WHERE sm.site_id=s.id
            AND sm.user_id=(SELECT auth.uid()) AND sm.status='active'))
        AND (user_id=(SELECT auth.uid()) OR agent_id=(SELECT auth.uid())
          OR delegate_id=(SELECT auth.uid()) OR lead_id IN (
            SELECT l.id FROM public.leads l
            WHERE l.user_id=(SELECT auth.uid()) OR l.assignee_id=(SELECT auth.uid())))
      )
    )
  )
);

-- A visible conversation alone is NOT sufficient: preserve the original site
-- membership/ownership predicate as well as the parent's own RLS restrictions.
ALTER POLICY messages_unified_access_policy ON public.messages USING (
  (SELECT auth.uid()) IS NULL OR (
    (SELECT auth.uid()) IS NOT NULL AND (
      user_id=(SELECT auth.uid()) OR visitor_id=(SELECT auth.uid()) OR agent_id=(SELECT auth.uid())
      OR conversation_id IN (
        SELECT c.id FROM public.conversations c WHERE
          c.site_id IN (
            SELECT s.id FROM public.sites s
            WHERE s.user_id=(SELECT auth.uid())
              OR EXISTS (SELECT 1 FROM public.site_ownership so
                WHERE so.site_id=s.id AND so.user_id=(SELECT auth.uid()))
              OR EXISTS (SELECT 1 FROM public.site_members sm
                WHERE sm.site_id=s.id AND sm.user_id=(SELECT auth.uid())
                  AND sm.status='active' AND sm.restrict_to_assigned_only=false)
          ) OR (
            c.site_id IN (SELECT s.id FROM public.sites s WHERE EXISTS (
              SELECT 1 FROM public.site_members sm WHERE sm.site_id=s.id
                AND sm.user_id=(SELECT auth.uid()) AND sm.status='active'))
            AND (c.user_id=(SELECT auth.uid()) OR c.agent_id=(SELECT auth.uid())
              OR c.delegate_id=(SELECT auth.uid()) OR c.lead_id IN (
                SELECT l.id FROM public.leads l
                WHERE l.user_id=(SELECT auth.uid()) OR l.assignee_id=(SELECT auth.uid())))
          )
      )
    )
  )
);

COMMIT;