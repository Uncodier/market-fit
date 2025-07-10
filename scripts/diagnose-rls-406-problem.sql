-- ============================================================================
-- DIAGNOSE RLS 406 PROBLEM
-- ============================================================================
-- This script diagnoses why service_role is still getting 406 errors

-- Step 1: Check if RLS is enabled on visitors table
SELECT 
    'RLS Status Check' as check_type,
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled,
    CASE WHEN rowsecurity THEN '✅ RLS is enabled' ELSE '❌ RLS is disabled' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('visitors', 'visitor_sessions')
ORDER BY tablename;

-- Step 2: Check what policies exist for visitors table
SELECT 
    'Current Policies' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('visitors', 'visitor_sessions')
ORDER BY tablename, policyname;

-- Step 3: Check if the helper function exists
SELECT 
    'Helper Function Check' as check_type,
    routine_name,
    routine_schema,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'auth' 
AND routine_name = 'is_service_role_or_user_condition';

-- Step 4: Test the helper function manually
SELECT 
    'Helper Function Test' as check_type,
    'Testing with service_role simulation' as test_description,
    auth.is_service_role_or_user_condition(false) as result_when_service_role;

-- Step 5: Check if there are multiple policies causing conflicts
SELECT 
    'Policy Conflict Check' as check_type,
    tablename,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ Single policy (good)'
        WHEN COUNT(*) > 1 THEN '❌ Multiple policies (potential conflict)'
        ELSE '❌ No policies (problem)'
    END as assessment
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('visitors', 'visitor_sessions')
GROUP BY tablename;

-- Step 6: Check specific visitor record that's causing 406
SELECT 
    'Specific Record Check' as check_type,
    id,
    segment_id,
    lead_id,
    CASE 
        WHEN segment_id IS NOT NULL THEN 'Has segment_id'
        WHEN lead_id IS NOT NULL THEN 'Has lead_id'
        ELSE 'No segment or lead reference'
    END as access_path
FROM public.visitors 
WHERE id = 'a2b31d21-29bc-458a-8fd8-e9d718889093';

-- Step 7: Test if visitor has related segment/lead with site access
SELECT 
    'Related Access Check' as check_type,
    v.id as visitor_id,
    s.id as segment_id,
    s.site_id,
    si.name as site_name,
    'Through segment' as access_type
FROM public.visitors v
JOIN public.segments s ON v.segment_id = s.id
JOIN public.sites si ON s.site_id = si.id
WHERE v.id = 'a2b31d21-29bc-458a-8fd8-e9d718889093'

UNION ALL

SELECT 
    'Related Access Check' as check_type,
    v.id as visitor_id,
    l.id as lead_id,
    l.site_id,
    si.name as site_name,
    'Through lead' as access_type
FROM public.visitors v
JOIN public.leads l ON v.lead_id = l.id
JOIN public.sites si ON l.site_id = si.id
WHERE v.id = 'a2b31d21-29bc-458a-8fd8-e9d718889093';

-- Step 8: Check if service_role bypass is working in the policy
SELECT 
    'Policy Logic Test' as check_type,
    'Testing service_role bypass' as test_description,
    CASE 
        WHEN current_setting('role') = 'service_role' THEN '✅ Currently service_role'
        ELSE '❌ Not service_role: ' || current_setting('role')
    END as current_role_status;

-- Step 9: Check recent policy changes
SELECT 
    'Recent Policy Changes' as check_type,
    policyname,
    tablename,
    'Policy exists' as status,
    length(qual) as policy_complexity
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'visitors'
ORDER BY policyname;

-- Step 10: Suggested fix if policies are missing or wrong
SELECT 
    'Diagnosis Summary' as check_type,
    'If RLS is enabled but service_role still gets 406:' as issue,
    '1. Check if is_service_role_or_user_condition function exists' as step1,
    '2. Check if visitors_unified policy uses this function' as step2,
    '3. Check if there are multiple conflicting policies' as step3,
    '4. May need to reapply the RLS migration' as step4; 