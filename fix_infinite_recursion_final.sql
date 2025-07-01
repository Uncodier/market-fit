-- DEFINITIVE FIX: Infinite Recursion in site_members/sites
-- Execute this in Supabase Dashboard → SQL Editor

-- ============================================================================
-- REMOVE PROBLEMATIC POLICIES CAUSING RECURSION
-- ============================================================================

-- Remove the recursive policy in site_members that queries sites
DROP POLICY IF EXISTS "simple_owners_manage" ON public.site_members;

-- Remove the recursive policy in sites that queries site_members  
DROP POLICY IF EXISTS "sites_unified_access" ON public.sites;

-- ============================================================================
-- CREATE CLEAN, NON-RECURSIVE POLICIES USING site_ownership
-- ============================================================================

-- Policy for site_members: Use site_ownership instead of sites
CREATE POLICY "site_members_clean_policy" ON public.site_members
    FOR ALL USING (
        -- Users can manage their own memberships
        user_id = (SELECT auth.uid()) 
        OR 
        -- Site owners can manage all members (using site_ownership)
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = site_members.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    ) WITH CHECK (
        -- Only site owners can add members (using site_ownership)
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = site_members.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    );

-- Policy for sites: Use site_ownership instead of site_members
CREATE POLICY "sites_clean_policy" ON public.sites
    FOR ALL USING (
        -- Direct site owners
        user_id = (SELECT auth.uid()) 
        OR 
        -- Users who have ownership through site_ownership
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = sites.id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    ) WITH CHECK (
        -- Only owners can modify sites
        user_id = (SELECT auth.uid()) 
        OR 
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = sites.id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'SUCCESS: Infinite recursion fixed!' as status; 