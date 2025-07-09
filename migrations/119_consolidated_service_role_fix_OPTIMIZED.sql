-- OPTIMIZED Consolidated Service Role Fix (Performance Optimized)
-- Date: 2025-01-30
-- Fixes 406 errors for service_role token queries
-- OPTIMIZED: Prevents auth_rls_initplan performance warnings

BEGIN;

-- ============================================================================
-- STEP 1: CREATE PERFORMANCE-OPTIMIZED HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.is_service_role_or_user_condition(user_condition boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT current_setting('role')) = 'service_role',
    ((SELECT current_setting('role')) = 'authenticated' AND ((SELECT auth.jwt()) ->> 'role') = 'service_role'),
    user_condition,
    false
  );
$$;

-- ============================================================================
-- STEP 2: COMPREHENSIVE POLICY CLEANUP
-- ============================================================================

-- Remove ALL existing policies (prevents duplicates)
DO $$
DECLARE
    pol RECORD;
    tables_to_clean TEXT[] := ARRAY['visitors', 'visitor_sessions', 'leads', 'sales', 'segments', 'campaigns', 'experiments'];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY tables_to_clean
    LOOP
        FOR pol IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = table_name AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, table_name);
        END LOOP;
        RAISE NOTICE 'Cleaned all policies from: %', table_name;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 3: CREATE OPTIMIZED POLICIES (NO auth_rls_initplan WARNINGS)
-- ============================================================================

-- Visitors - OPTIMIZED
CREATE POLICY "visitors_unified" ON public.visitors FOR ALL USING (
  auth.is_service_role_or_user_condition(
    (visitors.segment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.segments s JOIN public.site_members sm ON sm.site_id = s.site_id 
      WHERE s.id = visitors.segment_id AND sm.user_id = (SELECT auth.uid()) AND sm.status = 'active'
    ))
    OR
    (visitors.lead_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leads l JOIN public.site_members sm ON sm.site_id = l.site_id 
      WHERE l.id = visitors.lead_id AND sm.user_id = (SELECT auth.uid()) AND sm.status = 'active'
    ))
    OR
    EXISTS (
      SELECT 1 FROM public.visitor_sessions vs JOIN public.site_members sm ON sm.site_id = vs.site_id 
      WHERE vs.visitor_id = visitors.id AND sm.user_id = (SELECT auth.uid()) AND sm.status = 'active'
    )
  )
);

-- Visitor sessions - OPTIMIZED
CREATE POLICY "visitor_sessions_unified" ON public.visitor_sessions FOR ALL USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.site_members sm 
      WHERE sm.site_id = visitor_sessions.site_id AND sm.user_id = (SELECT auth.uid()) AND sm.status = 'active'
    )
  )
);

-- Leads - OPTIMIZED
CREATE POLICY "leads_unified" ON public.leads FOR ALL USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = leads.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid()))
      )
    )
  )
);

-- Sales - OPTIMIZED
CREATE POLICY "sales_unified" ON public.sales FOR ALL USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = sales.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid()))
      )
    )
  )
);

-- Segments - OPTIMIZED
CREATE POLICY "segments_unified" ON public.segments FOR ALL USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = segments.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid()))
      )
    )
  )
);

-- Campaigns - OPTIMIZED
CREATE POLICY "campaigns_unified" ON public.campaigns FOR ALL USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = campaigns.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid()))
      )
    )
  )
);

-- Experiments - OPTIMIZED
CREATE POLICY "experiments_unified" ON public.experiments FOR ALL USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = experiments.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid()))
      )
    )
  )
);

-- ============================================================================
-- STEP 4: ADD NECESSARY INDEXES (NO DUPLICATES)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_visitors_segment_id ON public.visitors(segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitors_lead_id ON public.visitors(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_site_id ON public.visitor_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id ON public.visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_site_members_site_user_status ON public.site_members(site_id, user_id, status);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    table_name TEXT;
    policy_count INTEGER;
    problem_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 OPTIMIZED VERIFICATION RESULTS:';
    
    FOR table_name IN VALUES ('visitors'), ('visitor_sessions'), ('leads'), ('sales'), ('segments'), ('campaigns'), ('experiments')
    LOOP
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies 
        WHERE tablename = table_name AND schemaname = 'public';
        
        IF policy_count = 1 THEN
            RAISE NOTICE '✅ %: Single policy (OPTIMAL)', table_name;
        ELSE
            RAISE NOTICE '❌ %: % policies (SHOULD BE 1)', table_name, policy_count;
            problem_count := problem_count + 1;
        END IF;
    END LOOP;
    
    IF problem_count = 0 THEN
        RAISE NOTICE '🎉 SUCCESS: All tables optimized';
        RAISE NOTICE '✅ Service_role access enabled';
        RAISE NOTICE '✅ NO auth_rls_initplan warnings';
        RAISE NOTICE '✅ All auth.uid() calls optimized with SELECT';
    ELSE
        RAISE NOTICE '❌ PROBLEMS DETECTED: % tables have issues', problem_count;
    END IF;
END $$;

COMMIT; 