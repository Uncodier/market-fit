-- ============================================================================
-- FIX SERVICE_ROLE DETECTION
-- ============================================================================
-- The current helper function is not detecting service_role correctly
-- This script fixes the detection logic

BEGIN;

-- Step 1: Drop the current problematic function
DROP FUNCTION IF EXISTS auth.is_service_role_or_user_condition(boolean);

-- Step 2: Create a simpler, working version
CREATE OR REPLACE FUNCTION auth.is_service_role_or_user_condition(user_condition boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- Primary check: role setting
    current_setting('role', true) = 'service_role',
    -- Fallback: JWT check
    (auth.jwt() ->> 'role') = 'service_role',
    -- Final fallback: user condition
    user_condition,
    false
  );
$$;

-- Step 3: Test the function with different approaches
DO $$
DECLARE
    result1 BOOLEAN;
    result2 BOOLEAN;
    result3 BOOLEAN;
    current_role TEXT;
    jwt_role TEXT;
BEGIN
    -- Test current approaches
    SELECT current_setting('role', true) INTO current_role;
    
    BEGIN
        SELECT (auth.jwt() ->> 'role') INTO jwt_role;
    EXCEPTION WHEN OTHERS THEN
        jwt_role := 'error';
    END;
    
    -- Test the function
    SELECT auth.is_service_role_or_user_condition(false) INTO result1;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 SERVICE_ROLE DETECTION TEST:';
    RAISE NOTICE '================================';
    RAISE NOTICE 'current_setting(''role'', true): %', current_role;
    RAISE NOTICE 'auth.jwt() ->> ''role'': %', jwt_role;
    RAISE NOTICE 'Function result: %', result1;
    RAISE NOTICE '';
    
    IF current_role = 'service_role' OR jwt_role = 'service_role' THEN
        RAISE NOTICE '✅ Should detect service_role';
    ELSE
        RAISE NOTICE '❌ Not service_role context';
    END IF;
END $$;

-- Step 4: Alternative approach - create a more robust function
CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    current_setting('role', true) = 'service_role' OR
    (auth.jwt() ->> 'role') = 'service_role' OR
    -- Additional check for service role JWT
    (auth.jwt() ->> 'iss') = 'supabase' AND (auth.jwt() ->> 'role') = 'service_role'
$$;

-- Step 5: Update the main helper function to use the simpler check
CREATE OR REPLACE FUNCTION auth.is_service_role_or_user_condition(user_condition boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE 
    WHEN auth.is_service_role() THEN true
    ELSE COALESCE(user_condition, false)
  END;
$$;

-- Step 6: Test both functions
DO $$
DECLARE
    service_role_result BOOLEAN;
    combined_result BOOLEAN;
BEGIN
    SELECT auth.is_service_role() INTO service_role_result;
    SELECT auth.is_service_role_or_user_condition(false) INTO combined_result;
    
    RAISE NOTICE '';
    RAISE NOTICE '🧪 FUNCTION TESTS:';
    RAISE NOTICE '==================';
    RAISE NOTICE 'auth.is_service_role(): %', service_role_result;
    RAISE NOTICE 'auth.is_service_role_or_user_condition(false): %', combined_result;
    
    IF service_role_result THEN
        RAISE NOTICE '✅ Service role detection working';
    ELSE
        RAISE NOTICE '❌ Service role detection failed';
        RAISE NOTICE '💡 This is expected if not running as service_role';
    END IF;
END $$;

-- Step 7: Alternative solution - Direct policy update for visitors
-- If the function still doesn't work, we'll use a direct service_role policy

-- Drop the current policy and create a simpler one
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  -- Direct service_role check OR user conditions
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

-- Step 8: Update visitor_sessions policy too
DROP POLICY IF EXISTS "visitor_sessions_unified" ON public.visitor_sessions;

CREATE POLICY "visitor_sessions_unified" ON public.visitor_sessions
FOR ALL 
USING (
  -- Direct service_role check OR user conditions
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

-- Step 9: Final verification
DO $$
DECLARE
    visitors_policy_count INTEGER;
    visitor_sessions_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO visitors_policy_count
    FROM pg_policies 
    WHERE tablename = 'visitors' AND schemaname = 'public';
    
    SELECT COUNT(*) INTO visitor_sessions_policy_count
    FROM pg_policies 
    WHERE tablename = 'visitor_sessions' AND schemaname = 'public';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 FINAL VERIFICATION:';
    RAISE NOTICE '======================';
    RAISE NOTICE 'Visitors policies: %', visitors_policy_count;
    RAISE NOTICE 'Visitor_sessions policies: %', visitor_sessions_policy_count;
    
    IF visitors_policy_count = 1 AND visitor_sessions_policy_count = 1 THEN
        RAISE NOTICE '✅ SUCCESS: Policies updated with direct service_role checks';
        RAISE NOTICE '🔧 Service_role should now bypass all RLS restrictions';
        RAISE NOTICE '';
        RAISE NOTICE '📋 Test with:';
        RAISE NOTICE 'SELECT * FROM visitors WHERE id = ''a2b31d21-29bc-458a-8fd8-e9d718889093'';';
    ELSE
        RAISE NOTICE '❌ PROBLEM: Unexpected policy count';
    END IF;
END $$;

COMMIT; 