BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = public, pg_temp;

LOCK TABLE public.conversations, public.messages IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.messages'::regclass
      AND polname = 'messages_unified_access_policy'
      AND polcmd = '*' AND polpermissive
      AND polroles = ARRAY[0::oid] AND polwithcheck IS NULL
      AND md5(regexp_replace(pg_get_expr(polqual,polrelid),'[[:space:]]+','','g'))
        = '771a8eddca5009e2822cbacd7487aa4a'
  ) THEN
    RAISE EXCEPTION 'Unexpected messages parent policy';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.conversations'::regclass
      AND polname = 'conversations_unified_access_policy'
      AND polcmd = '*' AND polpermissive
      AND polroles = ARRAY[0::oid] AND polwithcheck IS NULL
      AND md5(regexp_replace(pg_get_expr(polqual,polrelid),'[[:space:]]+','','g'))
        = '823bf5dbe5d3d4e7e11c254dd0d9d2c3'
  ) THEN
    RAISE EXCEPTION 'Unexpected conversations parent policy';
  END IF;
END $$;

-- The parent's own lead check must also be bounded. Retain caller-visible lead
-- semantics, including cross-site leads; do not add a same-site requirement.
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
          OR delegate_id=(SELECT auth.uid()) OR EXISTS (
            SELECT 1 FROM public.leads l WHERE l.id=conversations.lead_id
              AND (l.user_id=(SELECT auth.uid()) OR l.assignee_id=(SELECT auth.uid()))
            OFFSET 0))
      )
    )
  )
);

-- Retain PUBLIC ALL and its implicit WITH CHECK, direct-message branches and
-- NULL identity behavior. All parent reads remain subject to caller RLS.
-- OFFSET 0 prevents EXISTS decorrelation into an actor-wide hashed parent set:
-- each message tests only its primary-key parent, not all visible conversations.
ALTER POLICY messages_unified_access_policy ON public.messages USING (
  (SELECT auth.uid()) IS NULL OR (
    (SELECT auth.uid()) IS NOT NULL AND (
      user_id=(SELECT auth.uid()) OR visitor_id=(SELECT auth.uid()) OR agent_id=(SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id=messages.conversation_id AND (
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
              OR c.delegate_id=(SELECT auth.uid()) OR EXISTS (
                SELECT 1 FROM public.leads l WHERE l.id=c.lead_id
                  AND (l.user_id=(SELECT auth.uid()) OR l.assignee_id=(SELECT auth.uid()))
                OFFSET 0))
          )
        )
        OFFSET 0
      )
    )
  )
);

COMMIT;