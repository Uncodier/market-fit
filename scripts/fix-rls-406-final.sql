-- ============================================================================
-- FINAL FIX FOR SERVICE_ROLE 406 ERRORS
-- ============================================================================
-- This script definitively fixes the 406 errors for service_role on visitors table

BEGIN;

-- Step 1: Create the helper function if it doesn't exist
CREATE OR REPLACE FUNCTION auth.is_service_role_or_user_condition(user_condition boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- Fast path: Check if service_role (bypass all conditions)
    current_setting('role') = 'service_role',
    -- Fallback: Check JWT role for service_role
    (current_setting('role') = 'authenticated' AND (auth.jwt() ->> 'role') = 'service_role'),
    -- If not service_role, evaluate the user condition
    user_condition,
    false
  );
$$;

-- Step 2: Remove ALL existing policies for visitors (clean slate)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'visitors' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.visitors', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Step 3: Create a single, clean policy for visitors
CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
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

-- Step 4: Do the same for visitor_sessions
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'visitor_sessions' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.visitor_sessions', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Step 5: Create a single, clean policy for visitor_sessions
CREATE POLICY "visitor_sessions_unified" ON public.visitor_sessions
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 
      FROM public.site_members sm 
      WHERE sm.site_id = visitor_sessions.site_id 
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
    )
  )
);

-- Step 6: Add necessary indexes
CREATE INDEX IF NOT EXISTS idx_visitors_segment_id ON public.visitors(segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitors_lead_id ON public.visitors(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_site_id ON public.visitor_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id ON public.visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_site_members_site_user_status ON public.site_members(site_id, user_id, status);

-- Step 7: Verification
DO $$
DECLARE
    visitors_policy_count INTEGER;
    visitor_sessions_policy_count INTEGER;
    helper_function_exists BOOLEAN;
BEGIN
    -- Check policy counts
    SELECT COUNT(*) INTO visitors_policy_count
    FROM pg_policies 
    WHERE tablename = 'visitors' AND schemaname = 'public';
    
    SELECT COUNT(*) INTO visitor_sessions_policy_count
    FROM pg_policies 
    WHERE tablename = 'visitor_sessions' AND schemaname = 'public';
    
    -- Check helper function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'auth' AND p.proname = 'is_service_role_or_user_condition'
    ) INTO helper_function_exists;
    
    -- Report results
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICATION RESULTS:';
    RAISE NOTICE '========================';
    
    IF helper_function_exists THEN
        RAISE NOTICE '✅ Helper function: auth.is_service_role_or_user_condition exists';
    ELSE
        RAISE NOTICE '❌ Helper function: MISSING';
    END IF;
    
    RAISE NOTICE '📊 Policy counts:';
    RAISE NOTICE '  - visitors: % policies', visitors_policy_count;
    RAISE NOTICE '  - visitor_sessions: % policies', visitor_sessions_policy_count;
    
    IF visitors_policy_count = 1 AND visitor_sessions_policy_count = 1 THEN
        RAISE NOTICE '✅ SUCCESS: Both tables have exactly 1 policy each';
        RAISE NOTICE '🎉 Service_role should now work without 406 errors';
    ELSE
        RAISE NOTICE '❌ PROBLEM: Expected 1 policy per table';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 Test this fix:';
    RAISE NOTICE '1. Try the service_role query that was failing';
    RAISE NOTICE '2. Check Supabase logs for 406 errors';
    RAISE NOTICE '3. Run: SELECT * FROM public.visitors WHERE id = ''a2b31d21-29bc-458a-8fd8-e9d718889093''';
END $$;

COMMIT; 