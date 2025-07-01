-- FIX CIRCULAR RECURSION: Final Solution
-- Remove all problematic policies and create simple, working ones

-- ============================================================================
-- STEP 1: Remove ALL problematic policies from sites
-- ============================================================================

DROP POLICY IF EXISTS "sites_optimized_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_owner_access" ON public.sites;

-- Keep service role policy as it's needed for admin operations
-- DROP POLICY IF EXISTS "allow_service_role_delete_sites" ON public.sites;

-- ============================================================================
-- STEP 2: Remove ALL problematic policies from site_members
-- ============================================================================

DROP POLICY IF EXISTS "site_members_simple_access" ON public.site_members;

-- Keep service role policy as it's needed for admin operations  
-- DROP POLICY IF EXISTS "allow_service_role_delete" ON public.site_members;

-- ============================================================================
-- STEP 3: Create SIMPLE, NON-RECURSIVE policies for sites
-- ============================================================================

-- Simple policy: Users can only access sites they own
CREATE POLICY "sites_owner_only" ON public.sites
    FOR ALL USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- STEP 4: Create SIMPLE, NON-RECURSIVE policies for site_members  
-- ============================================================================

-- Simple policy: Users can see their own memberships
CREATE POLICY "site_members_own_only" ON public.site_members
    FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Simple policy: Site owners can manage memberships (without circular query)
CREATE POLICY "site_members_owner_manage" ON public.site_members
    FOR INSERT WITH CHECK (
        -- Only allow if the current user owns the site (direct lookup, no RLS)
        EXISTS (
            SELECT 1 FROM public.sites 
            WHERE sites.id = site_members.site_id 
            AND sites.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "site_members_owner_update" ON public.site_members
    FOR UPDATE USING (
        user_id = (SELECT auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.sites 
            WHERE sites.id = site_members.site_id 
            AND sites.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "site_members_owner_delete" ON public.site_members
    FOR DELETE USING (
        user_id = (SELECT auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.sites 
            WHERE sites.id = site_members.site_id 
            AND sites.user_id = (SELECT auth.uid())
        )
    );

-- ============================================================================
-- STEP 5: Test the fix
-- ============================================================================

-- Test sites access
SELECT 'SITES_TEST' as test_type, COUNT(*) as result FROM public.sites;

-- Test site_members access  
SELECT 'SITE_MEMBERS_TEST' as test_type, COUNT(*) as result FROM public.site_members;

-- Test specific user query that was failing
SELECT 'USER_SITES_TEST' as test_type, COUNT(*) as result 
FROM public.sites 
WHERE user_id = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid;

-- Show final policies
SELECT 'FINAL_POLICIES' as test_type, 
       tablename || '.' || policyname as result
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('sites', 'site_members')
ORDER BY tablename, policyname;

SELECT 'CIRCULAR_RECURSION_FIXED' AS status; 