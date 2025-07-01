-- DIAGNOSTIC: Step by Step - Execute each query individually
-- Execute these one by one to see where the issue is

-- ============================================================================
-- Query 1: Check RLS Status
-- ============================================================================
SELECT 
    'sites' as table_name,
    CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_class 
WHERE relname = 'sites' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- Query 2: Check RLS Status for site_members
-- ============================================================================
SELECT 
    'site_members' as table_name,
    CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_class 
WHERE relname = 'site_members' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- Query 3: List policies for sites table
-- ============================================================================
SELECT 
    tablename,
    policyname,
    cmd,
    permissive,
    SUBSTRING(qual FROM 1 FOR 100) as using_clause
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'sites'
ORDER BY policyname;

-- ============================================================================
-- Query 4: List policies for site_members table  
-- ============================================================================
SELECT 
    tablename,
    policyname,
    cmd,
    permissive,
    SUBSTRING(qual FROM 1 FOR 100) as using_clause
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'site_members'
ORDER BY policyname;

-- ============================================================================
-- Query 5: Test basic access to sites table
-- ============================================================================
SELECT COUNT(*) as total_sites FROM public.sites;

-- ============================================================================
-- Query 6: Test basic access to site_members table
-- ============================================================================
SELECT COUNT(*) as total_site_members FROM public.site_members;

-- ============================================================================
-- Query 7: Check user sites
-- ============================================================================
SELECT COUNT(*) as user_sites 
FROM public.sites 
WHERE user_id = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid;

-- ============================================================================
-- Query 8: Test auth function
-- ============================================================================
SELECT auth.uid() as current_auth_uid; 