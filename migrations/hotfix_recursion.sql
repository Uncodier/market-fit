-- HOTFIX: Remove recursive policy introduced this afternoon
-- This fixes the infinite recursion in site_members

-- Remove the problematic policy
DROP POLICY IF EXISTS "site_members_optimized_policy" ON public.site_members;

-- Create a simple, non-recursive policy
CREATE POLICY "site_members_simple_fix" ON public.site_members
    FOR ALL USING (
        -- Users can see their own memberships
        user_id = (SELECT auth.uid()) 
        OR 
        -- Site owners can see all members (direct lookup, no recursion)
        EXISTS (
            SELECT 1 FROM public.sites 
            WHERE sites.id = site_members.site_id 
            AND sites.user_id = (SELECT auth.uid())
        )
    ) WITH CHECK (
        -- Only site owners can add/modify members (direct lookup, no recursion)
        EXISTS (
            SELECT 1 FROM public.sites 
            WHERE sites.id = site_members.site_id 
            AND sites.user_id = (SELECT auth.uid())
        )
    );

SELECT 'HOTFIX APPLIED: Recursion fixed' AS status; 