-- ============================================================================
-- FIX SERVICE_ROLE DETECTION - CASCADE VERSION
-- ============================================================================
-- This script properly handles dropping the function and all dependent policies

BEGIN;

-- Step 1: Drop ALL policies that depend on the function first
DO $$
DECLARE
    policy_record RECORD;
    tables_with_policies TEXT[] := ARRAY['visitors', 'visitor_sessions', 'leads', 'sales', 'segments', 'campaigns', 'experiments'];
    table_name TEXT;
BEGIN
    RAISE NOTICE '🗑️ DROPPING ALL DEPENDENT POLICIES...';
    
    FOREACH table_name IN ARRAY tables_with_policies
    LOOP
        FOR policy_record IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = table_name AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, table_name);
            RAISE NOTICE 'Dropped policy: %.%', table_name, policy_record.policyname;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ All policies dropped';
END $$;

-- Step 2: Now we can safely drop the function
DROP FUNCTION IF EXISTS auth.is_service_role_or_user_condition(boolean);
DROP FUNCTION IF EXISTS auth.is_service_role();

RAISE NOTICE '✅ Functions dropped';

-- Step 3: Create direct policies WITHOUT using helper functions
-- This eliminates the dependency issues and works more reliably

-- VISITORS policy - direct service_role check
CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  -- Direct service_role checks (no function dependency)
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    -- Original user conditions
    (
      visitors.segment_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 
        FROM public.segments s 
        JOIN public.site_members sm ON sm.site_id = s.site_id 
        WHERE s.id = visitors.segment_id 
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
      )
    )
    OR
    (
      visitors.lead_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 
        FROM public.leads l 
        JOIN public.site_members sm ON sm.site_id = l.site_id 
        WHERE l.id = visitors.lead_id 
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
      )
    )
    OR
    EXISTS (
      SELECT 1 
      FROM public.visitor_sessions vs 
      JOIN public.site_members sm ON sm.site_id = vs.site_id 
      WHERE vs.visitor_id = visitors.id 
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
    )
  )
);

-- VISITOR_SESSIONS policy - direct service_role check
CREATE POLICY "visitor_sessions_unified" ON public.visitor_sessions
FOR ALL 
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    EXISTS (
      SELECT 1 
      FROM public.site_members sm 
      WHERE sm.site_id = visitor_sessions.site_id 
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
    )
  )
);

-- LEADS policy - direct service_role check
CREATE POLICY "leads_unified" ON public.leads
FOR ALL 
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = leads.site_id AND (
        s.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
        )
      )
    )
  )
);

-- SALES policy - direct service_role check
CREATE POLICY "sales_unified" ON public.sales
FOR ALL 
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = sales.site_id AND (
        s.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
        )
      )
    )
  )
);

-- SEGMENTS policy - direct service_role check
CREATE POLICY "segments_unified" ON public.segments
FOR ALL 
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = segments.site_id AND (
        s.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
        )
      )
    )
  )
);

-- CAMPAIGNS policy - direct service_role check
CREATE POLICY "campaigns_unified" ON public.campaigns
FOR ALL 
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = campaigns.site_id AND (
        s.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
        )
      )
    )
  )
);

-- EXPERIMENTS policy - direct service_role check
CREATE POLICY "experiments_unified" ON public.experiments
FOR ALL 
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = experiments.site_id AND (
        s.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
        )
      )
    )
  )
);

-- Step 4: Add policy comments for documentation
COMMENT ON POLICY "visitors_unified" ON public.visitors IS 
'Allows service_role (admin) OR users to access visitors through segment/lead/session membership - Direct checks, no function dependency';

COMMENT ON POLICY "visitor_sessions_unified" ON public.visitor_sessions IS 
'Allows service_role (admin) OR users to access visitor sessions for sites they are members of - Direct checks';

COMMENT ON POLICY "leads_unified" ON public.leads IS 
'Allows service_role (admin) OR users to access leads for sites they own/are members of - Direct checks';

COMMENT ON POLICY "sales_unified" ON public.sales IS 
'Allows service_role (admin) OR users to access sales for sites they own/are members of - Direct checks';

COMMENT ON POLICY "segments_unified" ON public.segments IS 
'Allows service_role (admin) OR users to access segments for sites they own/are members of - Direct checks';

COMMENT ON POLICY "campaigns_unified" ON public.campaigns IS 
'Allows service_role (admin) OR users to access campaigns for sites they own/are members of - Direct checks';

COMMENT ON POLICY "experiments_unified" ON public.experiments IS 
'Allows service_role (admin) OR users to access experiments for sites they own/are members of - Direct checks';

-- Step 5: Verification
DO $$
DECLARE
    table_name TEXT;
    policy_count INTEGER;
    total_policies INTEGER := 0;
    tables_to_check TEXT[] := ARRAY['visitors', 'visitor_sessions', 'leads', 'sales', 'segments', 'campaigns', 'experiments'];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICATION RESULTS:';
    RAISE NOTICE '========================';
    
    FOREACH table_name IN ARRAY tables_to_check
    LOOP
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies 
        WHERE tablename = table_name AND schemaname = 'public';
        
        total_policies := total_policies + policy_count;
        
        IF policy_count = 1 THEN
            RAISE NOTICE '✅ %: 1 policy (GOOD)', table_name;
        ELSE
            RAISE NOTICE '❌ %: % policies (EXPECTED 1)', table_name, policy_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Total policies created: %', total_policies;
    
    IF total_policies = 7 THEN
        RAISE NOTICE '🎉 SUCCESS: All 7 tables have direct service_role policies';
        RAISE NOTICE '✅ No function dependencies';
        RAISE NOTICE '🔧 Service_role should now bypass all RLS restrictions';
        RAISE NOTICE '';
        RAISE NOTICE '📋 Test the problematic query:';
        RAISE NOTICE 'SELECT * FROM visitors WHERE id = ''a2b31d21-29bc-458a-8fd8-e9d718889093'';';
    ELSE
        RAISE NOTICE '❌ PROBLEM: Expected 7 policies, got %', total_policies;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🏗️ ARCHITECTURE CHANGE:';
    RAISE NOTICE '• Removed helper function dependencies';
    RAISE NOTICE '• Direct service_role checks in each policy';
    RAISE NOTICE '• More reliable and easier to debug';
    RAISE NOTICE '• Should eliminate 406 errors for service_role';
END $$;

COMMIT; 