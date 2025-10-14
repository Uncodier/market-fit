-- ============================================================================
-- FIX RLS POLICY FOR remote_instances TO ALLOW SITE MEMBERS TO CREATE INSTANCES
-- ============================================================================

-- Drop the existing policy
DROP POLICY IF EXISTS "remote_instances_access_policy" ON public.remote_instances;

-- Create new policy that allows site members to create instances
CREATE POLICY "remote_instances_access_policy" ON public.remote_instances
    FOR ALL USING (
        -- Site owners can manage all instances
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = remote_instances.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
        OR
        -- Active site members can view instances
        EXISTS (
            SELECT 1 FROM public.site_members 
            WHERE site_members.site_id = remote_instances.site_id 
            AND site_members.user_id = (SELECT auth.uid())
            AND site_members.status = 'active'
        )
    ) WITH CHECK (
        -- Site owners can create/modify instances
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = remote_instances.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
        OR
        -- Active site members can create instances
        EXISTS (
            SELECT 1 FROM public.site_members 
            WHERE site_members.site_id = remote_instances.site_id 
            AND site_members.user_id = (SELECT auth.uid())
            AND site_members.status = 'active'
        )
    );

-- ============================================================================
-- VERIFY THE POLICY
-- ============================================================================

-- Check that the policy was created correctly
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'remote_instances' 
AND policyname = 'remote_instances_access_policy';
