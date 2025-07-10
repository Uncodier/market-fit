-- ============================================================================
-- SERVICE_ROLE FIX - NO FUNCTIONS APPROACH
-- ============================================================================
-- This script eliminates ALL function dependencies that cause performance warnings
-- Uses only direct SELECT subqueries for maximum performance

BEGIN;

-- Step 1: Replace the visitors policy with PURE SELECT subqueries (no function calls)
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  -- Direct service_role checks (no function dependencies at all)
  (SELECT current_setting('role', true)) = 'service_role' OR
  (SELECT (auth.jwt() ->> 'role')) = 'service_role' OR
  (
    -- Original user conditions with ALL auth calls wrapped in SELECT
    (
      visitors.segment_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 
        FROM public.segments s 
        JOIN public.site_members sm ON sm.site_id = s.site_id 
        WHERE s.id = visitors.segment_id 
        AND sm.user_id = (SELECT auth.uid())
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
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
      )
    )
    OR
    EXISTS (
      SELECT 1 
      FROM public.visitor_sessions vs 
      JOIN public.site_members sm ON sm.site_id = vs.site_id 
      WHERE vs.visitor_id = visitors.id 
      AND sm.user_id = (SELECT auth.uid())
      AND sm.status = 'active'
    )
  )
);

-- Step 2: Add performance-focused comment
COMMENT ON POLICY "visitors_unified" ON public.visitors IS 
'Service_role OR user access through segment/lead/session - Pure SELECT subqueries, no function dependencies, optimized for performance';

-- Step 3: Test the specific case
DO $$
DECLARE
    visitor_exists BOOLEAN;
    test_result TEXT;
    policy_definition TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTING NO-FUNCTIONS APPROACH:';
    RAISE NOTICE '=================================';
    
    -- Get the policy definition to verify it's clean
    SELECT qual INTO policy_definition
    FROM pg_policies 
    WHERE tablename = 'visitors' 
    AND schemaname = 'public' 
    AND policyname = 'visitors_unified';
    
    RAISE NOTICE 'Policy uses SELECT subqueries: %', 
        CASE WHEN policy_definition LIKE '%SELECT auth.uid()%' 
             AND policy_definition LIKE '%SELECT current_setting%'
             AND policy_definition NOT LIKE '%auth.is_service_role_or_user_condition%'
        THEN '✅ YES' 
        ELSE '❌ NO' 
        END;
    
    -- Test if the problematic visitor can be accessed
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
    
    RAISE NOTICE 'Access test: %', test_result;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 ARCHITECTURE CHANGES:';
    RAISE NOTICE '• Eliminated helper function dependency completely';
    RAISE NOTICE '• All auth calls wrapped in SELECT subqueries';
    RAISE NOTICE '• Pure RLS policy with no custom functions';
    RAISE NOTICE '• Should eliminate auth_rls_initplan warnings';
END $$;

-- Step 4: Verify the policy structure for performance
DO $$
DECLARE
    policy_text TEXT;
    has_select_wrapping BOOLEAN;
    has_function_calls BOOLEAN;
BEGIN
    -- Get the policy definition
    SELECT qual INTO policy_text
    FROM pg_policies 
    WHERE tablename = 'visitors' 
    AND schemaname = 'public' 
    AND policyname = 'visitors_unified';
    
    -- Check if all auth calls are wrapped in SELECT
    has_select_wrapping := (
        policy_text LIKE '%(SELECT auth.uid())%' AND
        policy_text LIKE '%(SELECT current_setting(%' AND
        policy_text LIKE '%(SELECT (auth.jwt() ->> %'
    );
    
    -- Check if there are any unwrapped function calls
    has_function_calls := (
        policy_text LIKE '%auth.is_service_role_or_user_condition%'
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 PERFORMANCE VERIFICATION:';
    RAISE NOTICE '============================';
    RAISE NOTICE 'All auth calls wrapped in SELECT: %', 
        CASE WHEN has_select_wrapping THEN '✅ YES' ELSE '❌ NO' END;
    RAISE NOTICE 'No custom function dependencies: %', 
        CASE WHEN NOT has_function_calls THEN '✅ YES' ELSE '❌ NO' END;
    
    IF has_select_wrapping AND NOT has_function_calls THEN
        RAISE NOTICE '🎉 SUCCESS: Policy optimized for performance';
        RAISE NOTICE '⚡ Should eliminate auth_rls_initplan warnings';
    ELSE
        RAISE NOTICE '❌ ISSUE: Policy still has performance concerns';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- PERFORMANCE ARCHITECTURE SUMMARY
-- ============================================================================
-- Previous approach: Used helper function that caused warnings
-- Current approach:  Pure RLS policy with direct SELECT subqueries
--
-- Key optimizations:
-- ✅ (SELECT auth.uid()) - evaluated once per query
-- ✅ (SELECT current_setting('role', true)) - evaluated once per query  
-- ✅ (SELECT (auth.jwt() ->> 'role')) - evaluated once per query
-- ✅ No custom function dependencies
-- ✅ Clean, fast RLS policy
-- ============================================================================ 