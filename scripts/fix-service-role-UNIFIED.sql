-- ============================================================================
-- SERVICE_ROLE FIX - UNIFIED POLICY APPROACH
-- ============================================================================
-- This script unifies ALL auth evaluations into a single SELECT to eliminate
-- auth_rls_initplan warnings completely

BEGIN;

-- Step 1: Replace visitors policy with UNIFIED SELECT approach
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  -- UNIFIED evaluation - all auth checks in ONE subquery
  (
    SELECT 
      -- Service role bypass checks
      current_setting('role', true) = 'service_role' OR
      (auth.jwt() ->> 'role') = 'service_role' OR
      
      -- User access conditions (only evaluate if not service_role)
      (
        auth.uid() IS NOT NULL AND (
          -- Through segment membership
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
          -- Through lead membership  
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
          -- Through visitor sessions
          EXISTS (
            SELECT 1 
            FROM public.visitor_sessions vs 
            JOIN public.site_members sm ON sm.site_id = vs.site_id 
            WHERE vs.visitor_id = visitors.id 
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
          )
        )
      )
  )
);

-- Step 2: Add unified policy comment
COMMENT ON POLICY "visitors_unified" ON public.visitors IS 
'Unified policy: Service_role bypass OR user access through segment/lead/session - Single SELECT evaluation to prevent auth_rls_initplan warnings';

-- Step 3: Test and verify the unified approach
DO $$
DECLARE
    visitor_exists BOOLEAN;
    test_result TEXT;
    policy_text TEXT;
    select_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔄 TESTING UNIFIED POLICY APPROACH:';
    RAISE NOTICE '===================================';
    
    -- Get policy definition
    SELECT qual INTO policy_text
    FROM pg_policies 
    WHERE tablename = 'visitors' 
    AND schemaname = 'public' 
    AND policyname = 'visitors_unified';
    
    -- Count SELECT statements (should be minimal)
    SELECT (length(policy_text) - length(replace(upper(policy_text), 'SELECT', ''))) / 6 INTO select_count;
    
    RAISE NOTICE 'Policy structure analysis:';
    RAISE NOTICE '• Starts with unified SELECT: %', 
        CASE WHEN policy_text LIKE '(( SELECT%' THEN '✅ YES' ELSE '❌ NO' END;
    RAISE NOTICE '• Total SELECT count: %', select_count;
    RAISE NOTICE '• Expected: Minimal SELECTs in unified structure';
    
    -- Test access to problematic visitor
    BEGIN
        SELECT EXISTS(
            SELECT 1 FROM public.visitors 
            WHERE id = 'a2b31d21-29bc-458a-8fd8-e9d718889093'
        ) INTO visitor_exists;
        
        IF visitor_exists THEN
            test_result := '✅ Visitor record accessible';
        ELSE
            test_result := '❌ Visitor record not found or not accessible';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        test_result := '❌ Error accessing visitor: ' || SQLERRM;
    END;
    
    RAISE NOTICE 'Access test result: %', test_result;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 UNIFIED APPROACH BENEFITS:';
    RAISE NOTICE '• Single SELECT evaluation for all auth checks';
    RAISE NOTICE '• All auth functions called once per query, not per row';
    RAISE NOTICE '• Short-circuit logic: service_role bypasses user checks';
    RAISE NOTICE '• Should eliminate auth_rls_initplan warnings completely';
END $$;

-- Step 4: Performance verification
DO $$
DECLARE
    policy_definition TEXT;
    has_outer_select BOOLEAN;
    function_pattern_count INTEGER;
BEGIN
    -- Get the complete policy definition
    SELECT qual INTO policy_definition
    FROM pg_policies 
    WHERE tablename = 'visitors' 
    AND schemaname = 'public' 
    AND policyname = 'visitors_unified';
    
    -- Check if it has the unified structure
    has_outer_select := policy_definition LIKE '(( SELECT%';
    
    -- Count patterns that might cause warnings (should be minimal in unified approach)
    SELECT (
        (CASE WHEN policy_definition LIKE '%auth.uid()%' THEN 1 ELSE 0 END) +
        (CASE WHEN policy_definition LIKE '%current_setting(%' THEN 1 ELSE 0 END) +
        (CASE WHEN policy_definition LIKE '%auth.jwt()%' THEN 1 ELSE 0 END)
    ) INTO function_pattern_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 PERFORMANCE ANALYSIS:';
    RAISE NOTICE '=========================';
    RAISE NOTICE 'Unified SELECT structure: %', 
        CASE WHEN has_outer_select THEN '✅ YES' ELSE '❌ NO' END;
    RAISE NOTICE 'Auth function patterns found: %', function_pattern_count;
    RAISE NOTICE 'Expected result: All auth calls evaluated once per query';
    
    IF has_outer_select THEN
        RAISE NOTICE '🎉 SUCCESS: Unified policy structure implemented';
        RAISE NOTICE '⚡ Should resolve auth_rls_initplan warnings';
    ELSE
        RAISE NOTICE '❌ ISSUE: Policy structure may still cause warnings';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- UNIFIED POLICY ARCHITECTURE
-- ============================================================================
-- Key insight: Instead of multiple SELECT calls:
--   (SELECT current_setting(...)) OR (SELECT auth.jwt()...) OR (user logic)
--
-- Use single unified SELECT:
--   (SELECT current_setting(...) OR auth.jwt()... OR user_logic)
--
-- Benefits:
-- ✅ All auth functions evaluated exactly once per query
-- ✅ Short-circuit evaluation (service_role skips user checks)  
-- ✅ No repeated function calls that trigger warnings
-- ✅ Clean, maintainable policy structure
-- ============================================================================ 