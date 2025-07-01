-- HOTFIX V2: Remove ALL problematic policies and create a working one
-- This fixes the infinite recursion completely

-- Remove ALL potentially problematic policies
DROP POLICY IF EXISTS "site_members_optimized_policy" ON public.site_members;
DROP POLICY IF EXISTS "site_members_simple_fix" ON public.site_members;
DROP POLICY IF EXISTS "site_members_unified" ON public.site_members;
DROP POLICY IF EXISTS "site_members_view_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_insert_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_update_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_delete_safe" ON public.site_members;

-- Create a new, unique policy that works
CREATE POLICY "site_members_working_policy_v2" ON public.site_members
    FOR ALL USING (
        -- Users can see their own memberships
        user_id = (SELECT auth.uid()) 
        OR 
        -- Site owners can see all members (NO RECURSION - direct sites lookup)
        EXISTS (
            SELECT 1 FROM public.sites 
            WHERE sites.id = site_members.site_id 
            AND sites.user_id = (SELECT auth.uid())
        )
    ) WITH CHECK (
        -- Only site owners can add/modify members (NO RECURSION - direct sites lookup)
        EXISTS (
            SELECT 1 FROM public.sites 
            WHERE sites.id = site_members.site_id 
            AND sites.user_id = (SELECT auth.uid())
        )
    );

SELECT 'HOTFIX V2 APPLIED: All recursive policies removed, working policy created' AS status; 