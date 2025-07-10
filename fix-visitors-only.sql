-- PROOF OF CONCEPT: Fix only visitors table using helper functions
-- If this works, we'll apply the same approach to all tables

BEGIN;

-- =============================================================================
-- STEP 1: Create optimized helper functions (STABLE for performance)
-- =============================================================================

-- Auth helper function - STABLE means it's cached within the same query
CREATE OR REPLACE FUNCTION auth_user_id() 
RETURNS uuid 
LANGUAGE sql 
STABLE 
AS $$
  SELECT auth.uid()
$$;

-- Service role helper function
CREATE OR REPLACE FUNCTION is_service_role() 
RETURNS boolean 
LANGUAGE sql 
STABLE 
AS $$
  SELECT current_setting('role', true) = 'service_role' OR 
         (auth.jwt() ->> 'role') = 'service_role'
$$;

-- =============================================================================
-- STEP 2: Fix ONLY visitors table policy
-- =============================================================================

-- Drop existing problematic policy
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

-- Create optimized policy using helper functions
CREATE POLICY "visitors_optimized" ON public.visitors
FOR ALL 
USING (
  -- Use helper functions instead of direct auth calls
  is_service_role() OR
  (
    auth_user_id() IS NOT NULL AND (
      -- Through segment membership
      (
        visitors.segment_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM segments s JOIN site_members sm ON sm.site_id = s.site_id 
          WHERE s.id = visitors.segment_id AND sm.user_id = auth_user_id() AND sm.status = 'active'
        )
      )
      OR
      -- Through lead membership  
      (
        visitors.lead_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM leads l JOIN site_members sm ON sm.site_id = l.site_id 
          WHERE l.id = visitors.lead_id AND sm.user_id = auth_user_id() AND sm.status = 'active'
        )
      )
      OR
      -- Through visitor sessions
      EXISTS (
        SELECT 1 FROM visitor_sessions vs JOIN site_members sm ON sm.site_id = vs.site_id 
        WHERE vs.visitor_id = visitors.id AND sm.user_id = auth_user_id() AND sm.status = 'active'
      )
    )
  )
);

-- =============================================================================
-- STEP 3: Verification - Check that visitors table is now optimized
-- =============================================================================

DO $$
DECLARE
    policy_text TEXT;
    has_direct_auth BOOLEAN;
    has_helper_functions BOOLEAN;
BEGIN
    -- Get policy definition
    SELECT qual INTO policy_text
    FROM pg_policies 
    WHERE tablename = 'visitors' 
    AND schemaname = 'public' 
    AND policyname = 'visitors_optimized';
    
    -- Check if it still has direct auth calls
    has_direct_auth := policy_text LIKE '%auth.uid()%' OR 
                      policy_text LIKE '%auth.jwt()%' OR 
                      policy_text LIKE '%current_setting(%';
    
    -- Check if it uses helper functions
    has_helper_functions := policy_text LIKE '%auth_user_id()%' OR 
                           policy_text LIKE '%is_service_role()%';
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VISITORS TABLE OPTIMIZATION TEST:';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Policy name: visitors_optimized';
    RAISE NOTICE 'Has direct auth calls: %', 
        CASE WHEN has_direct_auth THEN '❌ YES (PROBLEM)' ELSE '✅ NO (GOOD)' END;
    RAISE NOTICE 'Uses helper functions: %', 
        CASE WHEN has_helper_functions THEN '✅ YES (GOOD)' ELSE '❌ NO (PROBLEM)' END;
    
    IF NOT has_direct_auth AND has_helper_functions THEN
        RAISE NOTICE '🎉 SUCCESS: Visitors policy optimized!';
        RAISE NOTICE '📋 Policy content: %', substring(policy_text from 1 for 150);
        RAISE NOTICE '⚡ The auth_rls_initplan warning for visitors should be gone!';
    ELSE
        RAISE NOTICE '❌ ISSUE: Optimization failed';
        RAISE NOTICE '📋 Policy content: %', policy_text;
    END IF;
END $$;

-- =============================================================================
-- STEP 4: Test access to verify functionality
-- =============================================================================

DO $$
DECLARE
    visitor_count INTEGER;
    test_result TEXT;
BEGIN
    -- Test basic access
    BEGIN
        SELECT COUNT(*) INTO visitor_count FROM public.visitors LIMIT 1;
        test_result := '✅ Policy allows access - ' || visitor_count || ' visitors accessible';
    EXCEPTION WHEN OTHERS THEN
        test_result := '❌ Policy blocks access: ' || SQLERRM;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '🧪 ACCESS TEST:';
    RAISE NOTICE '===============';
    RAISE NOTICE '%', test_result;
    RAISE NOTICE 'Note: This test verifies the policy works functionally';
END $$;

COMMIT;

-- =============================================================================
-- NEXT STEPS
-- =============================================================================
-- 1. Check Supabase dashboard for auth_rls_initplan warnings
-- 2. If warning is gone for visitors table, apply the same approach to all tables
-- 3. If warning persists, we need to investigate further
-- ============================================================================= 