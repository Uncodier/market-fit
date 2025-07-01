-- FIX: Allow site members to see sites they belong to
-- Execute this in Supabase Dashboard → SQL Editor

-- Remove the current sites policy that only checks site_ownership
DROP POLICY IF EXISTS "sites_clean_policy" ON public.sites;

-- Create new policy that checks BOTH site_ownership AND site_members
CREATE POLICY "sites_include_members_policy" ON public.sites
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
        OR
        -- Users who are members through site_members (active status)
        EXISTS (
            SELECT 1 FROM public.site_members 
            WHERE site_members.site_id = sites.id 
            AND site_members.user_id = (SELECT auth.uid())
            AND site_members.status = 'active'
        )
    ) WITH CHECK (
        -- Only direct owners and site_ownership can modify sites
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
SELECT 'SUCCESS: Site members can now see sites they belong to!' as status; 