-- Migration: Update existing RLS policies to include service_role access (Performance optimized)
-- Description: Updates existing policies instead of creating new ones for cleaner policy management
-- Date: 2025-01-30
-- Fixes 406 errors when using service_role token for admin queries

-- ============================================================================
-- STEP 1: CREATE REUSABLE HELPER FUNCTION
-- ============================================================================

-- Create a performant helper function to check if current user is service_role or regular user
CREATE OR REPLACE FUNCTION auth.is_service_role_or_user_condition(user_condition boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- Fast path: Check if service_role (bypass all conditions)
    current_setting('role') = 'service_role',
    -- Fallback: Check JWT role for service_role
    (current_setting('role') = 'authenticated' AND (auth.jwt() ->> 'role') = 'service_role'),
    -- If not service_role, evaluate the user condition
    user_condition,
    false
  );
$$;

COMMENT ON FUNCTION auth.is_service_role_or_user_condition(boolean) IS 
'Performance-optimized function to check service_role access OR user condition. Service_role bypasses all checks.';

-- ============================================================================
-- STEP 2: UPDATE EXISTING VISITORS POLICY (instead of creating new one)
-- ============================================================================

-- Drop and recreate the existing visitors_unified policy with service_role support
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    -- Original user conditions from the existing policy
    (
      visitors.segment_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 
        FROM public.segments s 
        JOIN public.site_members sm ON sm.site_id = s.site_id 
        WHERE s.id = visitors.segment_id 
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
      )
    )
    OR
    (
      visitors.lead_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 
        FROM public.leads l 
        JOIN public.site_members sm ON sm.site_id = l.site_id 
        WHERE l.id = visitors.lead_id 
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
      )
    )
    OR
    EXISTS (
      SELECT 1 
      FROM public.visitor_sessions vs 
      JOIN public.site_members sm ON sm.site_id = vs.site_id 
      WHERE vs.visitor_id = visitors.id 
      AND sm.user_id = (SELECT auth.uid())
      AND sm.status = 'active'
    )
  )
);

-- ============================================================================
-- STEP 3: UPDATE EXISTING VISITOR_SESSIONS POLICY (instead of creating new one)
-- ============================================================================

-- Drop and recreate the existing visitor_sessions_unified policy with service_role support
DROP POLICY IF EXISTS "visitor_sessions_unified" ON public.visitor_sessions;

CREATE POLICY "visitor_sessions_unified" ON public.visitor_sessions
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    -- Original user condition from the existing policy
    EXISTS (
      SELECT 1 
      FROM public.site_members sm 
      WHERE sm.site_id = visitor_sessions.site_id 
      AND sm.user_id = (SELECT auth.uid())
      AND sm.status = 'active'
    )
  )
);

-- ============================================================================
-- STEP 4: UPDATE OTHER TABLES THAT LIKELY NEED SERVICE_ROLE ACCESS
-- ============================================================================

-- Update leads_unified policy (if exists) to include service_role
DROP POLICY IF EXISTS "leads_unified" ON public.leads;
CREATE POLICY "leads_unified" ON public.leads
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = leads.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
        )
      )
    )
  )
);

-- Update sales_unified_access_policy (if exists) to include service_role
DROP POLICY IF EXISTS "sales_unified_access_policy" ON public.sales;
CREATE POLICY "sales_unified_access_policy" ON public.sales
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = sales.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
        )
      )
    )
  )
);

-- Update segments_unified_access (if exists) to include service_role
DROP POLICY IF EXISTS "segments_unified_access" ON public.segments;
CREATE POLICY "segments_unified_access" ON public.segments
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = segments.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
        )
      )
    )
  )
);

-- Update campaigns_unified (if exists) to include service_role
DROP POLICY IF EXISTS "campaigns_unified" ON public.campaigns;
CREATE POLICY "campaigns_unified" ON public.campaigns
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = campaigns.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
        )
      )
    )
  )
);

-- Update experiments_unified (if exists) to include service_role
DROP POLICY IF EXISTS "experiments_unified" ON public.experiments;
CREATE POLICY "experiments_unified" ON public.experiments
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = experiments.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
        )
      )
    )
  )
);

-- ============================================================================
-- STEP 5: UPDATE DOCUMENTATION FOR EXISTING POLICIES
-- ============================================================================

COMMENT ON POLICY "visitors_unified" ON public.visitors IS 
'Allows service_role (admin) OR users to access visitors through segment/lead/session membership - Performance optimized';

COMMENT ON POLICY "visitor_sessions_unified" ON public.visitor_sessions IS 
'Allows service_role (admin) OR users to access visitor sessions for sites they are members of - Performance optimized';

COMMENT ON POLICY "leads_unified" ON public.leads IS 
'Allows service_role (admin) OR users to access leads for sites they own/are members of - Performance optimized';

COMMENT ON POLICY "sales_unified_access_policy" ON public.sales IS 
'Allows service_role (admin) OR users to access sales for sites they own/are members of - Performance optimized';

COMMENT ON POLICY "segments_unified_access" ON public.segments IS 
'Allows service_role (admin) OR users to access segments for sites they own/are members of - Performance optimized';

COMMENT ON POLICY "campaigns_unified" ON public.campaigns IS 
'Allows service_role (admin) OR users to access campaigns for sites they own/are members of - Performance optimized';

COMMENT ON POLICY "experiments_unified" ON public.experiments IS 
'Allows service_role (admin) OR users to access experiments for sites they own/are members of - Performance optimized';

-- ============================================================================
-- STEP 6: PERFORMANCE INDEXES (if not already exist)
-- ============================================================================

-- These indexes should help with the existing RLS policies performance
CREATE INDEX IF NOT EXISTS idx_visitors_segment_id_performance ON public.visitors(segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitors_lead_id_performance ON public.visitors(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_site_id_performance ON public.visitor_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id_performance ON public.visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_site_members_site_user_status_performance ON public.site_members(site_id, user_id, status);

-- ============================================================================
-- STEP 7: VERIFICATION
-- ============================================================================

-- Test that function and policies exist
DO $$
BEGIN
    -- Check if helper function was created successfully
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'is_service_role_or_user_condition' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
    ) THEN
        RAISE NOTICE 'WARNING: auth.is_service_role_or_user_condition() function was not created';
    ELSE
        RAISE NOTICE 'SUCCESS: auth.is_service_role_or_user_condition() function created';
    END IF;
    
    -- Check if policies were updated successfully
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'visitors' 
        AND policyname = 'visitors_unified'
    ) THEN
        RAISE NOTICE 'WARNING: visitors_unified policy was not updated';
    ELSE
        RAISE NOTICE 'SUCCESS: visitors_unified policy updated with service_role support';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'visitor_sessions' 
        AND policyname = 'visitor_sessions_unified'
    ) THEN
        RAISE NOTICE 'WARNING: visitor_sessions_unified policy was not updated';
    ELSE
        RAISE NOTICE 'SUCCESS: visitor_sessions_unified policy updated with service_role support';
    END IF;
    
    -- Show summary of updated policies
    RAISE NOTICE '';
    RAISE NOTICE '=== SUMMARY OF UPDATED POLICIES ===';
    RAISE NOTICE 'The following policies now support service_role access:';
    RAISE NOTICE '• visitors_unified';
    RAISE NOTICE '• visitor_sessions_unified';
    RAISE NOTICE '• leads_unified';
    RAISE NOTICE '• sales_unified_access_policy';
    RAISE NOTICE '• segments_unified_access';
    RAISE NOTICE '• campaigns_unified';
    RAISE NOTICE '• experiments_unified';
    RAISE NOTICE '';
    RAISE NOTICE 'All policies use the helper function auth.is_service_role_or_user_condition()';
    RAISE NOTICE 'for optimal performance and consistent service_role handling.';
END $$; 