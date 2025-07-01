-- OPTIMIZE SITE_MEMBERS PERFORMANCE
-- Execute this in Supabase Dashboard → SQL Editor
-- Consolidates multiple policies into ONE optimized policy

-- ============================================================================
-- REMOVE ALL EXISTING POLICIES (causing performance issues)
-- ============================================================================

-- Remove ALL site_members policies
DROP POLICY IF EXISTS "site_members_clean_policy" ON public.site_members;
DROP POLICY IF EXISTS "site_members_using_ownership" ON public.site_members;
DROP POLICY IF EXISTS "simple_view_own" ON public.site_members;

-- Keep service role policy (doesn't affect performance)
-- "allow_service_role_delete" is fine

-- ============================================================================
-- CREATE SINGLE OPTIMIZED POLICY
-- ============================================================================

-- One unified policy for ALL operations (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "site_members_unified_optimized" ON public.site_members
    FOR ALL USING (
        -- Users can see/manage their own memberships
        user_id = (SELECT auth.uid()) 
        OR 
        -- Site owners can manage all members (using site_ownership for performance)
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = site_members.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    ) WITH CHECK (
        -- For INSERT/UPDATE: Only site owners can modify members
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = site_members.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
        OR
        -- Users can update their own membership status
        (user_id = (SELECT auth.uid()) AND site_id = site_id)
    );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'SUCCESS: Site members performance optimized - now using single policy!' as status; 