-- IMPLEMENT RBAC FOR ALL MAIN TABLES
-- Execute this AFTER implementing site_members RBAC
-- This applies role-based permissions to leads, campaigns, experiments, etc.

-- ============================================================================
-- RBAC ROLES DEFINITION:
-- owner: Full access (SELECT, INSERT, UPDATE, DELETE)
-- collaborator: Editor access (SELECT, INSERT, UPDATE) 
-- marketing: Viewer access (SELECT only)
-- ============================================================================

-- Helper function to check if user has permission for specific action
CREATE OR REPLACE FUNCTION public.user_can_perform_action(
    p_site_id UUID, 
    p_action TEXT, 
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    user_role := public.get_user_role_for_site(p_site_id, p_user_id);
    
    CASE p_action
        WHEN 'SELECT' THEN
            -- All roles can view
            RETURN user_role IN ('owner', 'collaborator', 'marketing');
        WHEN 'INSERT' THEN
            -- Only owner and collaborator can create
            RETURN user_role IN ('owner', 'collaborator');
        WHEN 'UPDATE' THEN
            -- Only owner and collaborator can update
            RETURN user_role IN ('owner', 'collaborator');
        WHEN 'DELETE' THEN
            -- Only owner can delete
            RETURN user_role = 'owner';
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- LEADS TABLE RBAC POLICIES
-- ============================================================================

-- Remove existing permissive policies for leads
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view leads they have access to" ON public.leads;
    DROP POLICY IF EXISTS "Users can insert leads for sites they have access to" ON public.leads;
    DROP POLICY IF EXISTS "Users can update leads they have access to" ON public.leads;
    DROP POLICY IF EXISTS "Users can delete leads they have access to" ON public.leads;
    -- Add any other existing policy names here
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- Policy doesn't exist, continue
END $$;

-- LEADS RBAC Policies
CREATE POLICY "leads_rbac_select" ON public.leads
    FOR SELECT USING (
        public.user_can_perform_action(site_id, 'SELECT')
    );

CREATE POLICY "leads_rbac_insert" ON public.leads
    FOR INSERT WITH CHECK (
        public.user_can_perform_action(site_id, 'INSERT')
    );

CREATE POLICY "leads_rbac_update" ON public.leads
    FOR UPDATE USING (
        public.user_can_perform_action(site_id, 'UPDATE')
    ) WITH CHECK (
        public.user_can_perform_action(site_id, 'UPDATE')
    );

CREATE POLICY "leads_rbac_delete" ON public.leads
    FOR DELETE USING (
        public.user_can_perform_action(site_id, 'DELETE')
    );

-- ============================================================================
-- CAMPAIGNS TABLE RBAC POLICIES
-- ============================================================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view campaigns for sites they have access to" ON public.campaigns;
    DROP POLICY IF EXISTS "Users can insert campaigns for sites they have access to" ON public.campaigns;
    DROP POLICY IF EXISTS "Users can update campaigns for sites they have access to" ON public.campaigns;
    DROP POLICY IF EXISTS "Users can delete campaigns for sites they have access to" ON public.campaigns;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

CREATE POLICY "campaigns_rbac_select" ON public.campaigns
    FOR SELECT USING (
        public.user_can_perform_action(site_id, 'SELECT')
    );

CREATE POLICY "campaigns_rbac_insert" ON public.campaigns
    FOR INSERT WITH CHECK (
        public.user_can_perform_action(site_id, 'INSERT')
    );

CREATE POLICY "campaigns_rbac_update" ON public.campaigns
    FOR UPDATE USING (
        public.user_can_perform_action(site_id, 'UPDATE')
    ) WITH CHECK (
        public.user_can_perform_action(site_id, 'UPDATE')
    );

CREATE POLICY "campaigns_rbac_delete" ON public.campaigns
    FOR DELETE USING (
        public.user_can_perform_action(site_id, 'DELETE')
    );

-- ============================================================================
-- EXPERIMENTS TABLE RBAC POLICIES
-- ============================================================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view experiments for sites they have access to" ON public.experiments;
    DROP POLICY IF EXISTS "Users can insert experiments for sites they have access to" ON public.experiments;
    DROP POLICY IF EXISTS "Users can update experiments for sites they have access to" ON public.experiments;
    DROP POLICY IF EXISTS "Users can delete experiments for sites they have access to" ON public.experiments;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

CREATE POLICY "experiments_rbac_select" ON public.experiments
    FOR SELECT USING (
        public.user_can_perform_action(site_id, 'SELECT')
    );

CREATE POLICY "experiments_rbac_insert" ON public.experiments
    FOR INSERT WITH CHECK (
        public.user_can_perform_action(site_id, 'INSERT')
    );

CREATE POLICY "experiments_rbac_update" ON public.experiments
    FOR UPDATE USING (
        public.user_can_perform_action(site_id, 'UPDATE')
    ) WITH CHECK (
        public.user_can_perform_action(site_id, 'UPDATE')
    );

CREATE POLICY "experiments_rbac_delete" ON public.experiments
    FOR DELETE USING (
        public.user_can_perform_action(site_id, 'DELETE')
    );

-- ============================================================================
-- SEGMENTS TABLE RBAC POLICIES
-- ============================================================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view segments for sites they have access to" ON public.segments;
    DROP POLICY IF EXISTS "Users can insert segments for sites they have access to" ON public.segments;
    DROP POLICY IF EXISTS "Users can update segments for sites they have access to" ON public.segments;
    DROP POLICY IF EXISTS "Users can delete segments for sites they have access to" ON public.segments;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

CREATE POLICY "segments_rbac_select" ON public.segments
    FOR SELECT USING (
        public.user_can_perform_action(site_id, 'SELECT')
    );

CREATE POLICY "segments_rbac_insert" ON public.segments
    FOR INSERT WITH CHECK (
        public.user_can_perform_action(site_id, 'INSERT')
    );

CREATE POLICY "segments_rbac_update" ON public.segments
    FOR UPDATE USING (
        public.user_can_perform_action(site_id, 'UPDATE')
    ) WITH CHECK (
        public.user_can_perform_action(site_id, 'UPDATE')
    );

CREATE POLICY "segments_rbac_delete" ON public.segments
    FOR DELETE USING (
        public.user_can_perform_action(site_id, 'DELETE')
    );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'SUCCESS: RBAC implemented for all main tables!' as status;
SELECT 'Role permissions:' as info;
SELECT '- owner: Full access (SELECT, INSERT, UPDATE, DELETE)' as permissions;
SELECT '- collaborator: Editor access (SELECT, INSERT, UPDATE)' as permissions;
SELECT '- marketing: Viewer access (SELECT only)' as permissions; 