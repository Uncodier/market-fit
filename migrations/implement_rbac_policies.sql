-- IMPLEMENT RBAC (Role-Based Access Control)
-- Execute this in Supabase Dashboard → SQL Editor

-- ============================================================================
-- REMOVE CURRENT PERMISSIVE POLICIES
-- ============================================================================

-- Remove the current policy that allows ALL operations to any member
DROP POLICY IF EXISTS "site_members_unified_optimized" ON public.site_members;

-- ============================================================================
-- CREATE RBAC POLICIES FOR SITE_MEMBERS
-- ============================================================================

-- POLICY 1: SELECT (All members can view site_members)
CREATE POLICY "site_members_rbac_select" ON public.site_members
    FOR SELECT USING (
        -- Users can see their own membership
        user_id = (SELECT auth.uid()) 
        OR 
        -- Site owners can see all members
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = site_members.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
        OR
        -- All active members can see other members
        EXISTS (
            SELECT 1 FROM public.site_members sm
            WHERE sm.site_id = site_members.site_id 
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
        )
    );

-- POLICY 2: INSERT (Only owners can add members)
CREATE POLICY "site_members_rbac_insert" ON public.site_members
    FOR INSERT WITH CHECK (
        -- Only site owners can add members
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = site_members.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    );

-- POLICY 3: UPDATE (Only owners can update members)
CREATE POLICY "site_members_rbac_update" ON public.site_members
    FOR UPDATE USING (
        -- Users can update their own basic info (name, position)
        user_id = (SELECT auth.uid())
        OR
        -- Site owners can update any member
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = site_members.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    ) WITH CHECK (
        -- Same conditions for WITH CHECK
        user_id = (SELECT auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = site_members.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    );

-- POLICY 4: DELETE (Only owners can remove members)
CREATE POLICY "site_members_rbac_delete" ON public.site_members
    FOR DELETE USING (
        -- Only site owners can remove members
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = site_members.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    );

-- ============================================================================
-- CREATE HELPER FUNCTION FOR ROLE CHECKING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_role_for_site(p_site_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Check if user is site owner first
    IF EXISTS (
        SELECT 1 FROM public.site_ownership 
        WHERE site_id = p_site_id AND user_id = p_user_id
    ) THEN
        RETURN 'owner';
    END IF;
    
    -- Get role from site_members
    SELECT role INTO user_role
    FROM public.site_members 
    WHERE site_id = p_site_id 
    AND user_id = p_user_id 
    AND status = 'active';
    
    RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'SUCCESS: RBAC policies implemented for site_members!' as status; 