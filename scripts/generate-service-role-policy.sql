-- Script to generate service_role-enabled policies for any table
-- This maintains consistency with the established pattern from Migration 119
-- Use this template when creating new tables or updating existing ones

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================

-- 1. Replace 'your_table_name' with the actual table name
-- 2. Replace 'your_conditions' with the appropriate user access conditions
-- 3. Run this script in Supabase SQL Editor

-- ============================================================================
-- VERIFY HELPER FUNCTION EXISTS
-- ============================================================================

-- First, ensure the helper function exists (from Migration 119)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'is_service_role_or_user_condition' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
    ) THEN
        RAISE NOTICE '❌ Helper function not found. Please run Migration 119 first.';
        RAISE NOTICE '   File: migrations/119_fix_service_role_access_visitors.sql';
        RAISE EXCEPTION 'Missing required helper function';
    ELSE
        RAISE NOTICE '✅ Helper function auth.is_service_role_or_user_condition() found';
    END IF;
END $$;

-- ============================================================================
-- TEMPLATE 1: SITE-BASED TABLE (most common pattern)
-- ============================================================================

-- For tables that have a site_id column and need site-based access control
-- Examples: campaigns, experiments, segments, leads, sales, etc.

/*
DROP POLICY IF EXISTS "your_table_name_unified" ON public.your_table_name;
CREATE POLICY "your_table_name_unified" ON public.your_table_name
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    -- Standard site-based access pattern
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = your_table_name.site_id AND (
        -- Site owner
        s.user_id = (SELECT auth.uid()) OR
        -- Site member
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
          AND sm.status = 'active'
        )
      )
    )
  )
);

COMMENT ON POLICY "your_table_name_unified" ON public.your_table_name IS 
'Allows service_role (admin) OR users to access records for sites they own/are members of - Performance optimized';
*/

-- ============================================================================
-- TEMPLATE 2: USER-OWNED TABLE 
-- ============================================================================

-- For tables that belong directly to a user (user_id column)
-- Examples: profiles, notifications, companies, etc.

/*
DROP POLICY IF EXISTS "your_table_name_unified" ON public.your_table_name;
CREATE POLICY "your_table_name_unified" ON public.your_table_name
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    -- User ownership pattern
    user_id = (SELECT auth.uid())
  )
);

COMMENT ON POLICY "your_table_name_unified" ON public.your_table_name IS 
'Allows service_role (admin) OR users to access their own records - Performance optimized';
*/

-- ============================================================================
-- TEMPLATE 3: AUTHENTICATED-ONLY TABLE
-- ============================================================================

-- For tables that allow access to any authenticated user
-- Examples: conversations, messages (depending on your security model)

/*
DROP POLICY IF EXISTS "your_table_name_unified" ON public.your_table_name;
CREATE POLICY "your_table_name_unified" ON public.your_table_name
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    -- Any authenticated user
    (SELECT auth.uid()) IS NOT NULL
  )
);

COMMENT ON POLICY "your_table_name_unified" ON public.your_table_name IS 
'Allows service_role (admin) OR any authenticated user to access records - Performance optimized';
*/

-- ============================================================================
-- TEMPLATE 4: COMPLEX MULTI-RELATIONSHIP TABLE
-- ============================================================================

-- For tables with complex access patterns (like visitors table)
-- Examples: visitors, visitor_sessions, etc.

/*
DROP POLICY IF EXISTS "your_table_name_unified" ON public.your_table_name;
CREATE POLICY "your_table_name_unified" ON public.your_table_name
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    -- Complex condition 1: Through segment_id
    (
      your_table_name.segment_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 
        FROM public.segments s 
        JOIN public.site_members sm ON sm.site_id = s.site_id 
        WHERE s.id = your_table_name.segment_id 
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
      )
    )
    OR
    -- Complex condition 2: Through lead_id
    (
      your_table_name.lead_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 
        FROM public.leads l 
        JOIN public.site_members sm ON sm.site_id = l.site_id 
        WHERE l.id = your_table_name.lead_id 
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
      )
    )
    OR
    -- Complex condition 3: Through related table
    EXISTS (
      SELECT 1 
      FROM public.related_table rt 
      JOIN public.site_members sm ON sm.site_id = rt.site_id 
      WHERE rt.your_table_id = your_table_name.id 
      AND sm.user_id = (SELECT auth.uid())
      AND sm.status = 'active'
    )
  )
);

COMMENT ON POLICY "your_table_name_unified" ON public.your_table_name IS 
'Allows service_role (admin) OR users to access records through complex relationship patterns - Performance optimized';
*/

-- ============================================================================
-- POST-CREATION CHECKLIST
-- ============================================================================

-- After creating your policy, run these verification queries:

-- 1. Verify the policy was created
SELECT 
    tablename, 
    policyname, 
    cmd,
    CASE 
        WHEN qual LIKE '%is_service_role_or_user_condition%' THEN '✅ Using helper function'
        ELSE '❌ Not using helper function'
    END as helper_function_check
FROM pg_policies 
WHERE tablename = 'your_table_name' 
AND schemaname = 'public';

-- 2. Verify RLS is enabled
SELECT 
    relname as table_name,
    CASE 
        WHEN relrowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as rls_status
FROM pg_class 
WHERE relname = 'your_table_name' 
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Check for multiple policies (should be avoided)
SELECT 
    tablename,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ Single policy'
        ELSE '⚠️ Multiple policies - consider consolidating'
    END as policy_status
FROM pg_policies 
WHERE tablename = 'your_table_name' 
AND schemaname = 'public'
GROUP BY tablename;

-- 4. Test the policy (replace with your actual table name)
-- This should work for service_role and regular users
SELECT 
    'Testing policy...' as test_status,
    auth.is_service_role_or_user_condition(true) as service_role_test,
    (SELECT auth.uid()) as current_user_id;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION RECOMMENDATIONS
-- ============================================================================

-- Add these indexes based on your table structure:

-- For site-based tables:
-- CREATE INDEX IF NOT EXISTS idx_your_table_name_site_id ON public.your_table_name(site_id);

-- For user-owned tables:
-- CREATE INDEX IF NOT EXISTS idx_your_table_name_user_id ON public.your_table_name(user_id);

-- For foreign key relationships:
-- CREATE INDEX IF NOT EXISTS idx_your_table_name_segment_id ON public.your_table_name(segment_id) WHERE segment_id IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_your_table_name_lead_id ON public.your_table_name(lead_id) WHERE lead_id IS NOT NULL;

-- For site_members table (if not already exists):
-- CREATE INDEX IF NOT EXISTS idx_site_members_site_user_status ON public.site_members(site_id, user_id, status);

-- ============================================================================
-- TROUBLESHOOTING GUIDE
-- ============================================================================

-- If you encounter 406 errors after creating the policy:

-- 1. Check if the policy is using the helper function
SELECT policyname, qual
FROM pg_policies 
WHERE tablename = 'your_table_name' 
AND qual LIKE '%is_service_role_or_user_condition%';

-- 2. Check if there are conflicting policies
SELECT tablename, array_agg(policyname) as policies
FROM pg_policies 
WHERE tablename = 'your_table_name' 
GROUP BY tablename
HAVING COUNT(*) > 1;

-- 3. Test the helper function directly
SELECT auth.is_service_role_or_user_condition(true);

-- 4. Check current user context
SELECT 
    current_setting('role') as current_role,
    (SELECT auth.uid()) as current_user_id,
    auth.jwt() ->> 'role' as jwt_role;

-- ============================================================================
-- FINAL NOTES
-- ============================================================================

-- Remember:
-- 1. Always use the helper function auth.is_service_role_or_user_condition()
-- 2. Preserve original user conditions inside the function call
-- 3. Use ONE policy per table (unified approach)
-- 4. Add appropriate indexes for performance
-- 5. Test both service_role and regular user access
-- 6. Document your policies with meaningful comments

-- This pattern ensures consistency, performance, and maintainability across all tables. 