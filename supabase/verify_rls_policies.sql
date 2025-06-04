-- Verification script for RLS policies
-- Run this script to verify that all RLS policies are properly configured

-- ========================================
-- 1. VERIFY RLS IS ENABLED ON ALL TABLES
-- ========================================

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('allowed_domains', 'companies', 'cron_status')
ORDER BY tablename;

-- ========================================
-- 2. LIST ALL POLICIES FOR TARGET TABLES
-- ========================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('allowed_domains', 'companies', 'cron_status')
ORDER BY tablename, cmd, policyname;

-- ========================================
-- 3. VERIFY ALLOWED_DOMAINS POLICIES SPECIFICALLY
-- ========================================

-- Check if allowed_domains has RLS enabled
SELECT 
    'allowed_domains' as table_name,
    CASE 
        WHEN relrowsecurity THEN 'RLS ENABLED ✅'
        ELSE 'RLS DISABLED ❌'
    END as rls_status
FROM pg_class 
WHERE relname = 'allowed_domains' 
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Count policies for allowed_domains
SELECT 
    'allowed_domains' as table_name,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) >= 4 THEN 'SUFFICIENT POLICIES ✅'
        ELSE 'MISSING POLICIES ❌'
    END as policy_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'allowed_domains';

-- List specific allowed_domains policies
SELECT 
    policyname,
    cmd as operation,
    CASE 
        WHEN qual IS NOT NULL THEN 'HAS USING CLAUSE ✅'
        ELSE 'NO USING CLAUSE'
    END as using_status,
    CASE 
        WHEN with_check IS NOT NULL THEN 'HAS WITH CHECK ✅'
        ELSE 'NO WITH CHECK'
    END as check_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'allowed_domains'
ORDER BY cmd;

-- ========================================
-- 4. VERIFY COMPANIES POLICIES SPECIFICALLY
-- ========================================

-- Check companies policies
SELECT 
    'companies' as table_name,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) = 3 THEN 'CORRECT POLICIES (NO DELETE) ✅'
        WHEN COUNT(*) > 3 THEN 'TOO MANY POLICIES (HAS DELETE?) ❌'
        ELSE 'MISSING POLICIES ❌'
    END as policy_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'companies';

-- List companies policies (should NOT have DELETE)
SELECT 
    policyname,
    cmd as operation
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'companies'
ORDER BY cmd;

-- ========================================
-- 5. VERIFY CRON_STATUS POLICIES SPECIFICALLY
-- ========================================

-- Check cron_status policies
SELECT 
    'cron_status' as table_name,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) = 4 THEN 'COMPLETE POLICIES ✅'
        ELSE 'MISSING POLICIES ❌'
    END as policy_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'cron_status';

-- ========================================
-- 6. VERIFY HELPER FUNCTIONS EXIST
-- ========================================

-- Check if is_superadmin function exists
SELECT 
    'is_superadmin()' as function_name,
    CASE 
        WHEN COUNT(*) > 0 THEN 'FUNCTION EXISTS ✅'
        ELSE 'FUNCTION MISSING ❌'
    END as function_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'is_superadmin';

-- ========================================
-- 7. TEST QUERIES (COMMENTED FOR SAFETY)
-- ========================================

-- Uncomment these to test actual access (be careful - these will show real data)

-- Test current user access to allowed_domains
-- SELECT 
--     COUNT(*) as accessible_domains,
--     'If > 0, RLS is working and you have site access' as note
-- FROM public.allowed_domains;

-- Test current user access to companies
-- SELECT 
--     COUNT(*) as accessible_companies,
--     'Should show all companies if logged in' as note
-- FROM public.companies;

-- Test current user access to cron_status
-- SELECT 
--     COUNT(*) as accessible_cron_jobs,
--     'Should be 0 unless you are superadmin' as note
-- FROM public.cron_status;

-- ========================================
-- 8. SUMMARY REPORT
-- ========================================

SELECT 
    'POLICY VERIFICATION SUMMARY' as report_title,
    '' as spacer,
    'Run the queries above to verify:' as instruction,
    '1. RLS is enabled on all tables' as step_1,
    '2. Correct number of policies exist' as step_2,
    '3. No DELETE policy on companies' as step_3,
    '4. Helper functions are available' as step_4,
    '5. Test access with commented queries' as step_5; 