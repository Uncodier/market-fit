-- ============================================================================
-- MINIMAL SERVICE_ROLE FIX - PERFORMANCE OPTIMIZED
-- ============================================================================
-- This script fixes 406 errors AND preserves performance optimizations
-- Prevents auth_rls_initplan warnings by using SELECT subqueries

BEGIN;

-- Step 1: Check current state first
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 FIXING SERVICE_ROLE + PERFORMANCE:';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'This script will:';
    RAISE NOTICE '✅ Fix service_role 406 errors';
    RAISE NOTICE '✅ Preserve performance optimizations (no auth_rls_initplan warnings)';
    RAISE NOTICE '✅ Maintain existing role restrictions';
    RAISE NOTICE '✅ Keep all other policies unchanged';
END $$;

-- Step 2: Update the helper function with performance optimization
CREATE OR REPLACE FUNCTION auth.is_service_role_or_user_condition(user_condition boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE 
    WHEN (SELECT current_setting('role', true)) = 'service_role' THEN true
    WHEN (SELECT (auth.jwt() ->> 'role')) = 'service_role' THEN true
    ELSE COALESCE(user_condition, false)
  END;
$$;

-- Step 3: Update ONLY the visitors policy with PERFORMANCE OPTIMIZED version
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  -- PERFORMANCE OPTIMIZED service_role checks (prevents auth_rls_initplan warnings)
  (SELECT current_setting('role', true)) = 'service_role' OR
  (SELECT (auth.jwt() ->> 'role')) = 'service_role' OR
  
  -- PRESERVE existing user logic with performance optimizations
  auth.is_service_role_or_user_condition(
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

-- Step 4: Add performance comment
COMMENT ON POLICY "visitors_unified" ON public.visitors IS 
'Allows service_role (admin) OR users to access visitors through segment/lead/session membership - Performance optimized with SELECT subqueries to prevent auth_rls_initplan warnings';

-- Step 5: Test the specific problematic case
DO $$
DECLARE
    visitor_exists BOOLEAN;
    test_result TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTING SPECIFIC CASE:';
    RAISE NOTICE '=========================';
    
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
    
    RAISE NOTICE 'Test result: %', test_result;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 WHAT WAS CHANGED:';
    RAISE NOTICE '• Fixed helper function with SELECT subqueries';
    RAISE NOTICE '• Updated visitors policy with optimized service_role checks';
    RAISE NOTICE '• Used (SELECT auth.uid()) instead of auth.uid()';
    RAISE NOTICE '• Used (SELECT current_setting()) instead of current_setting()';
    RAISE NOTICE '• ALL OTHER policies remain unchanged';
    RAISE NOTICE '• Role restrictions (triggers) remain unchanged';
END $$;

-- Step 6: Verify minimal impact and performance
DO $$
DECLARE
    policies_count INTEGER;
    triggers_count INTEGER;
    functions_count INTEGER;
BEGIN
    -- Count policies (should be same as before)
    SELECT COUNT(*) INTO policies_count
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    -- Count role restriction triggers (should be unchanged)
    SELECT COUNT(*) INTO triggers_count
    FROM information_schema.triggers 
    WHERE trigger_name LIKE '%permission%';
    
    -- Count functions (should be same)
    SELECT COUNT(*) INTO functions_count
    FROM information_schema.routines 
    WHERE routine_schema = 'auth';
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 IMPACT VERIFICATION:';
    RAISE NOTICE '========================';
    RAISE NOTICE 'Total RLS policies: % (should be unchanged)', policies_count;
    RAISE NOTICE 'Role restriction triggers: % (should be unchanged)', triggers_count;
    RAISE NOTICE 'Auth functions: % (should be same)', functions_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ MINIMAL change with PERFORMANCE optimization';
    RAISE NOTICE '🚀 Should eliminate both 406 errors AND performance warnings';
END $$;

COMMIT;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION SUMMARY
-- ============================================================================
-- The key change: Wrapped auth function calls in SELECT subqueries:
-- 
-- ❌ BEFORE (causes warnings):
-- auth.uid() -> re-evaluated for each row
-- current_setting('role', true) -> re-evaluated for each row
--
-- ✅ AFTER (optimized):
-- (SELECT auth.uid()) -> evaluated once per query
-- (SELECT current_setting('role', true)) -> evaluated once per query
--
-- This prevents auth_rls_initplan warnings while fixing service_role 406 errors
-- ============================================================================ 