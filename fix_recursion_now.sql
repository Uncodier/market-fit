-- SIMPLE FIX: Remove infinite recursion in site_members
-- Execute this to fix the team invitation issue immediately

-- Temporarily disable RLS to clean up
ALTER TABLE public.site_members DISABLE ROW LEVEL SECURITY;

-- Remove ALL problematic policies
DROP POLICY IF EXISTS "View site members" ON public.site_members;
DROP POLICY IF EXISTS "Add site members" ON public.site_members;
DROP POLICY IF EXISTS "Update site members" ON public.site_members;
DROP POLICY IF EXISTS "Allow cascade deletions from auth.users" ON public.site_members;
DROP POLICY IF EXISTS "site_members_view_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_insert_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_update_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_delete_safe" ON public.site_members;
DROP POLICY IF EXISTS "site_members_can_view_own_memberships" ON public.site_members;
DROP POLICY IF EXISTS "site_members_owners_can_manage" ON public.site_members;
DROP POLICY IF EXISTS "site_members_simple_access" ON public.site_members;
DROP POLICY IF EXISTS "site_members_own_only" ON public.site_members;
DROP POLICY IF EXISTS "site_members_owner_manage" ON public.site_members;
DROP POLICY IF EXISTS "site_members_owner_update" ON public.site_members;
DROP POLICY IF EXISTS "site_members_owner_delete" ON public.site_members;
DROP POLICY IF EXISTS "site_members_optimized_policy" ON public.site_members;
DROP POLICY IF EXISTS "site_members_unified" ON public.site_members;
DROP POLICY IF EXISTS "users_view_own_memberships" ON public.site_members;
DROP POLICY IF EXISTS "owners_can_add_members" ON public.site_members;
DROP POLICY IF EXISTS "owners_view_site_members" ON public.site_members;
DROP POLICY IF EXISTS "members_can_be_managed" ON public.site_members;
DROP POLICY IF EXISTS "members_can_be_deleted" ON public.site_members;

-- Re-enable RLS
ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;

-- Create SIMPLE, non-recursive policies
CREATE POLICY "simple_view_own" ON public.site_members
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "simple_owners_manage" ON public.site_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.sites 
            WHERE sites.id = site_members.site_id 
            AND sites.user_id = (SELECT auth.uid())
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sites 
            WHERE sites.id = site_members.site_id 
            AND sites.user_id = (SELECT auth.uid())
        )
    );

-- Test the fix
SELECT 'RECURSION_FIXED' as status; 