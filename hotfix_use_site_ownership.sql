-- HOTFIX: Use site_ownership table to avoid recursion
-- This prevents querying the sites table which has its own RLS policies

-- Remove ALL potentially recursive policies
DROP POLICY IF EXISTS "site_members_optimized_policy" ON public.site_members;
DROP POLICY IF EXISTS "site_members_simple_fix" ON public.site_members;
DROP POLICY IF EXISTS "site_members_unified" ON public.site_members;
DROP POLICY IF EXISTS "site_members_view_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_insert_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_update_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_delete_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_working_policy_v2" ON public.site_members;

-- Create policy using site_ownership (NO RECURSION)
CREATE POLICY "site_members_using_ownership" ON public.site_members
    FOR ALL USING (
        -- Users can see their own memberships
        user_id = (SELECT auth.uid()) 
        OR 
        -- Site owners can see all members (using site_ownership, not sites)
        EXISTS (
            SELECT 1 FROM public.site_ownership so
            WHERE so.site_id = site_members.site_id 
            AND so.user_id = (SELECT auth.uid())
        )
    ) WITH CHECK (
        -- Only site owners can add/modify members (using site_ownership, not sites)
        EXISTS (
            SELECT 1 FROM public.site_ownership so
            WHERE so.site_id = site_members.site_id 
            AND so.user_id = (SELECT auth.uid())
        )
    );

SELECT 'HOTFIX APPLIED: Using site_ownership to prevent recursion' AS status; 