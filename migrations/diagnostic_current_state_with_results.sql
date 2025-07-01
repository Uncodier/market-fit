-- DIAGNOSTIC SCRIPT: Current State Analysis (Results in Tables)
-- This script will show all diagnostic information in SELECT results

-- ============================================================================
-- STEP 1: Check RLS Status
-- ============================================================================

SELECT 
    'RLS_STATUS' as diagnostic_step,
    'sites' as table_name,
    CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status,
    'Row Level Security status for sites table' as description
FROM pg_class 
WHERE relname = 'sites' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')

UNION ALL

SELECT 
    'RLS_STATUS' as diagnostic_step,
    'site_members' as table_name,
    CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status,
    'Row Level Security status for site_members table' as description
FROM pg_class 
WHERE relname = 'site_members' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- STEP 2: List All Current Policies
-- ============================================================================

SELECT 
    'POLICIES' as diagnostic_step,
    tablename as table_name,
    policyname as policy_name,
    CONCAT(cmd, ' | ', permissive) as policy_type,
    COALESCE(SUBSTRING(qual FROM 1 FOR 80), 'NULL') as using_clause,
    COALESCE(SUBSTRING(with_check FROM 1 FOR 80), 'NULL') as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('sites', 'site_members')
ORDER BY tablename, policyname;

-- ============================================================================
-- STEP 3: Test Basic Table Access (Count rows)
-- ============================================================================

SELECT 
    'TABLE_ACCESS' as diagnostic_step,
    'sites' as table_name,
    COUNT(*)::text as row_count,
    'Total rows in sites table' as description
FROM public.sites

UNION ALL

SELECT 
    'TABLE_ACCESS' as diagnostic_step,
    'site_members' as table_name,
    COUNT(*)::text as row_count,
    'Total rows in site_members table' as description
FROM public.site_members;

-- ============================================================================
-- STEP 4: Check Specific User Data
-- ============================================================================

SELECT 
    'USER_DATA' as diagnostic_step,
    'sites_for_user' as table_name,
    COUNT(*)::text as row_count,
    'Sites owned by user 541396e1-a904-4a81-8cbf-0ca4e3b8b2b4' as description
FROM public.sites 
WHERE user_id = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid

UNION ALL

SELECT 
    'USER_DATA' as diagnostic_step,
    'memberships_for_user' as table_name,
    COUNT(*)::text as row_count,
    'Site memberships for user 541396e1-a904-4a81-8cbf-0ca4e3b8b2b4' as description
FROM public.site_members 
WHERE user_id = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid;

-- ============================================================================
-- STEP 5: Check for Functions That Could Interfere
-- ============================================================================

SELECT 
    'FUNCTIONS' as diagnostic_step,
    proname as table_name,
    'FUNCTION' as row_count,
    CONCAT('Function that might affect sites/members: ', proname) as description
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND (proname ILIKE '%site%' OR proname ILIKE '%member%')
ORDER BY proname;

-- ============================================================================
-- STEP 6: Check for Triggers
-- ============================================================================

SELECT 
    'TRIGGERS' as diagnostic_step,
    c.relname as table_name,
    t.tgname as row_count,
    CONCAT('Trigger: ', t.tgname, ' → ', p.proname) as description
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
AND c.relname IN ('sites', 'site_members')
AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- ============================================================================
-- STEP 7: Test Auth Context (Simulated)
-- ============================================================================

SELECT 
    'AUTH_TEST' as diagnostic_step,
    'auth_uid_function' as table_name,
    CASE 
        WHEN auth.uid() IS NOT NULL THEN 'WORKING'
        ELSE 'NOT_AVAILABLE'
    END as row_count,
    CONCAT('Auth UID function result: ', COALESCE(auth.uid()::text, 'NULL')) as description;

-- ============================================================================
-- STEP 8: Summary and Recommendations
-- ============================================================================

SELECT 
    'SUMMARY' as diagnostic_step,
    'analysis_complete' as table_name,
    'DIAGNOSTIC_DONE' as row_count,
    'Review all results above to understand current state' as description

UNION ALL

SELECT 
    'RECOMMENDATIONS' as diagnostic_step,
    'next_steps' as table_name,
    'ACTION_NEEDED' as row_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sites') = 0 
        THEN 'NO_POLICIES_FOUND - Need to create basic policies'
        WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'sites' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) = false
        THEN 'RLS_DISABLED - RLS is disabled, thats why no errors but also no security'
        ELSE 'POLICIES_EXIST - Check policy syntax above for issues'
    END as description; 