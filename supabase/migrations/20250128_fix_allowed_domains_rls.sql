-- Migration: Fix allowed_domains RLS policies
-- Date: 2025-01-28
-- Description: Update RLS policies for allowed_domains table to ensure proper site-based access

-- ========================================
-- UPDATE ALLOWED_DOMAINS RLS POLICIES
-- ========================================

-- Drop existing policies for allowed_domains
DROP POLICY IF EXISTS "Users can view allowed domains for their sites" ON public.allowed_domains;
DROP POLICY IF EXISTS "Only owners and admins can insert allowed domains" ON public.allowed_domains;
DROP POLICY IF EXISTS "Only owners and admins can update allowed domains" ON public.allowed_domains;
DROP POLICY IF EXISTS "Only owners and admins can delete allowed domains" ON public.allowed_domains;
DROP POLICY IF EXISTS "Only superadmin can view allowed domains" ON public.allowed_domains;
DROP POLICY IF EXISTS "Only superadmin can insert allowed domains" ON public.allowed_domains;
DROP POLICY IF EXISTS "Only superadmin can update allowed domains" ON public.allowed_domains;
DROP POLICY IF EXISTS "Only superadmin can delete allowed domains" ON public.allowed_domains;
DROP POLICY IF EXISTS "Site owners and admins can insert allowed domains" ON public.allowed_domains;
DROP POLICY IF EXISTS "Site owners and admins can update allowed domains" ON public.allowed_domains;
DROP POLICY IF EXISTS "Site owners and admins can delete allowed domains" ON public.allowed_domains;

-- Ensure RLS is enabled on allowed_domains
ALTER TABLE public.allowed_domains ENABLE ROW LEVEL SECURITY;

-- Create new policies for allowed_domains
CREATE POLICY "Users can view allowed domains for their sites"
    ON public.allowed_domains FOR SELECT
    USING (
        site_id IN (
            SELECT s.id 
            FROM public.sites s
            LEFT JOIN public.site_members sm ON s.id = sm.site_id
            LEFT JOIN public.site_ownership so ON s.id = so.site_id
            WHERE s.user_id = auth.uid()  -- Direct site ownership
               OR (sm.user_id = auth.uid() AND sm.status = 'active')  -- Site member access
               OR so.user_id = auth.uid()  -- Site ownership table
        )
    );

CREATE POLICY "Only owners and admins can insert allowed domains"
    ON public.allowed_domains FOR INSERT
    WITH CHECK (
        site_id IN (
            SELECT s.id 
            FROM public.sites s
            LEFT JOIN public.site_members sm ON s.id = sm.site_id
            LEFT JOIN public.site_ownership so ON s.id = so.site_id
            WHERE s.user_id = auth.uid()  -- Direct site ownership
               OR (sm.user_id = auth.uid() AND sm.role IN ('owner', 'admin') AND sm.status = 'active')  -- Admin/owner members
               OR so.user_id = auth.uid()  -- Site ownership table
        )
    );

CREATE POLICY "Only owners and admins can update allowed domains"
    ON public.allowed_domains FOR UPDATE
    USING (
        site_id IN (
            SELECT s.id 
            FROM public.sites s
            LEFT JOIN public.site_members sm ON s.id = sm.site_id
            LEFT JOIN public.site_ownership so ON s.id = so.site_id
            WHERE s.user_id = auth.uid()  -- Direct site ownership
               OR (sm.user_id = auth.uid() AND sm.role IN ('owner', 'admin') AND sm.status = 'active')  -- Admin/owner members
               OR so.user_id = auth.uid()  -- Site ownership table
        )
    )
    WITH CHECK (
        site_id IN (
            SELECT s.id 
            FROM public.sites s
            LEFT JOIN public.site_members sm ON s.id = sm.site_id
            LEFT JOIN public.site_ownership so ON s.id = so.site_id
            WHERE s.user_id = auth.uid()  -- Direct site ownership
               OR (sm.user_id = auth.uid() AND sm.role IN ('owner', 'admin') AND sm.status = 'active')  -- Admin/owner members
               OR so.user_id = auth.uid()  -- Site ownership table
        )
    );

CREATE POLICY "Only owners and admins can delete allowed domains"
    ON public.allowed_domains FOR DELETE
    USING (
        site_id IN (
            SELECT s.id 
            FROM public.sites s
            LEFT JOIN public.site_members sm ON s.id = sm.site_id
            LEFT JOIN public.site_ownership so ON s.id = so.site_id
            WHERE s.user_id = auth.uid()  -- Direct site ownership
               OR (sm.user_id = auth.uid() AND sm.role IN ('owner', 'admin') AND sm.status = 'active')  -- Admin/owner members
               OR so.user_id = auth.uid()  -- Site ownership table
        )
    );

-- ========================================
-- VERIFICATION QUERIES (COMMENTED)
-- ========================================

-- Verify RLS is enabled and policies are created
-- SELECT 
--     'allowed_domains' as table_name,
--     CASE 
--         WHEN relrowsecurity THEN 'RLS ENABLED ✅'
--         ELSE 'RLS DISABLED ❌'
--     END as rls_status
-- FROM pg_class 
-- WHERE relname = 'allowed_domains' 
--   AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- List all policies for allowed_domains
-- SELECT 
--     policyname,
--     cmd as operation,
--     CASE 
--         WHEN qual IS NOT NULL THEN 'HAS USING CLAUSE ✅'
--         ELSE 'NO USING CLAUSE'
--     END as using_status,
--     CASE 
--         WHEN with_check IS NOT NULL THEN 'HAS WITH CHECK ✅'
--         ELSE 'NO WITH CHECK'
--     END as check_status
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename = 'allowed_domains'
-- ORDER BY cmd;

-- Test access (uncomment to test)
-- SELECT ad.*, s.name as site_name 
-- FROM public.allowed_domains ad
-- JOIN public.sites s ON s.id = ad.site_id
-- LIMIT 5; 