-- Migration: Configure RLS policies for allowed_domains, companies, and cron_status
-- Date: 2025-01-28
-- Description: Update RLS policies for existing tables - site-based access and logged user access

-- ========================================
-- 1. HELPER FUNCTION TO CHECK SUPERADMIN ROLE
-- ========================================

-- Create function to check if current user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if the user has the superadmin role in auth.users
    RETURN EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'role' = 'superadmin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 2. UPDATE ALLOWED_DOMAINS RLS POLICIES
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

-- Create new policies for allowed_domains following the original pattern
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
-- 3. UPDATE COMPANIES RLS POLICIES
-- ========================================

-- Enable RLS on companies table if not already enabled
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can delete companies" ON public.companies;

-- Create policies for authenticated users (any logged user can read, insert, update but NOT delete)
CREATE POLICY "Authenticated users can view companies"
    ON public.companies FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert companies"
    ON public.companies FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update companies"
    ON public.companies FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- NOTE: No DELETE policy created - companies cannot be deleted by anyone

-- ========================================
-- 4. UPDATE CRON_STATUS RLS POLICIES
-- ========================================

-- Enable RLS on cron_status table if not already enabled
ALTER TABLE public.cron_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Only superadmin can view cron status" ON public.cron_status;
DROP POLICY IF EXISTS "Only superadmin can insert cron status" ON public.cron_status;
DROP POLICY IF EXISTS "Only superadmin can update cron status" ON public.cron_status;
DROP POLICY IF EXISTS "Only superadmin can delete cron status" ON public.cron_status;

-- Create superadmin-only policies for cron_status
CREATE POLICY "Only superadmin can view cron status"
    ON public.cron_status FOR SELECT
    USING (public.is_superadmin());

CREATE POLICY "Only superadmin can insert cron status"
    ON public.cron_status FOR INSERT
    WITH CHECK (public.is_superadmin());

CREATE POLICY "Only superadmin can update cron status"
    ON public.cron_status FOR UPDATE
    USING (public.is_superadmin())
    WITH CHECK (public.is_superadmin());

CREATE POLICY "Only superadmin can delete cron status"
    ON public.cron_status FOR DELETE
    USING (public.is_superadmin());

-- ========================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION public.is_superadmin() IS 'Helper function to check if current user has superadmin role';

-- ========================================
-- 6. VERIFICATION QUERIES (COMMENTED)
-- ========================================

-- Use these queries to verify the policies are working correctly:

-- Check current user's superadmin status
-- SELECT public.is_superadmin() as is_current_user_superadmin;

-- List all policies for verification
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename IN ('allowed_domains', 'companies', 'cron_status')
-- ORDER BY tablename, policyname;

-- Test allowed_domains access
-- SELECT ad.*, s.name as site_name 
-- FROM public.allowed_domains ad
-- JOIN public.sites s ON s.id = ad.site_id
-- LIMIT 5; 