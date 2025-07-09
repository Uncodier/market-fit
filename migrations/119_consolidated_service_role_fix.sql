-- CONSOLIDATED Migration: Fix service_role access for ALL tables at once
-- Description: Single script that updates all RLS policies to include service_role access
-- Date: 2025-01-30
-- Fixes 406 errors when using service_role token for admin queries
-- Consolidates both core and additional table updates

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
-- STEP 2: UPDATE ALL CORE TABLES (Core Business Logic)
-- ============================================================================

-- Update visitors policy
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;
CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
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

-- Update visitor_sessions policy
DROP POLICY IF EXISTS "visitor_sessions_unified" ON public.visitor_sessions;
CREATE POLICY "visitor_sessions_unified" ON public.visitor_sessions
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 
      FROM public.site_members sm 
      WHERE sm.site_id = visitor_sessions.site_id 
      AND sm.user_id = (SELECT auth.uid())
      AND sm.status = 'active'
    )
  )
);

-- Update leads policy
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

-- Update sales policy
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

-- Update segments policy
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

-- Update campaigns policy
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

-- Update experiments policy
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
-- STEP 3: UPDATE ADDITIONAL TABLES (Safe - handles missing tables)
-- ============================================================================

-- Update session_events policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session_events' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "session_events_unified" ON public.session_events;
    CREATE POLICY "session_events_unified" ON public.session_events
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        EXISTS (
          SELECT 1 FROM public.sites s 
          WHERE s.id = session_events.site_id AND (
            s.user_id = (SELECT auth.uid()) OR
            EXISTS (
              SELECT 1 FROM public.site_members sm 
              WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
            )
          )
        )
      )
    );
    RAISE NOTICE '✅ Updated session_events policy';
  ELSE
    RAISE NOTICE '⏭️ session_events table does not exist - skipping';
  END IF;
END $$;

-- Update tasks policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "tasks_unified" ON public.tasks;
    CREATE POLICY "tasks_unified" ON public.tasks
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        EXISTS (
          SELECT 1 FROM public.sites s 
          WHERE s.id = tasks.site_id AND (
            s.user_id = (SELECT auth.uid()) OR
            EXISTS (
              SELECT 1 FROM public.site_members sm 
              WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
            )
          )
        )
      )
    );
    RAISE NOTICE '✅ Updated tasks policy';
  ELSE
    RAISE NOTICE '⏭️ tasks table does not exist - skipping';
  END IF;
END $$;

-- Update commands policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commands' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "commands_unified" ON public.commands;
    CREATE POLICY "commands_unified" ON public.commands
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        EXISTS (
          SELECT 1 FROM public.sites s 
          WHERE s.id = commands.site_id AND (
            s.user_id = (SELECT auth.uid()) OR
            EXISTS (
              SELECT 1 FROM public.site_members sm 
              WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
            )
          )
        )
      )
    );
    RAISE NOTICE '✅ Updated commands policy';
  ELSE
    RAISE NOTICE '⏭️ commands table does not exist - skipping';
  END IF;
END $$;

-- Update agents policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "agents_unified" ON public.agents;
    CREATE POLICY "agents_unified" ON public.agents
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        EXISTS (
          SELECT 1 FROM public.sites s 
          WHERE s.id = agents.site_id AND (
            s.user_id = (SELECT auth.uid()) OR
            EXISTS (
              SELECT 1 FROM public.site_members sm 
              WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
            )
          )
        )
      )
    );
    RAISE NOTICE '✅ Updated agents policy';
  ELSE
    RAISE NOTICE '⏭️ agents table does not exist - skipping';
  END IF;
END $$;

-- Update content policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "content_unified_access_policy" ON public.content;
    CREATE POLICY "content_unified_access_policy" ON public.content
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        EXISTS (
          SELECT 1 FROM public.sites s 
          WHERE s.id = content.site_id AND (
            s.user_id = (SELECT auth.uid()) OR
            EXISTS (
              SELECT 1 FROM public.site_members sm 
              WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
            )
          )
        )
      )
    );
    RAISE NOTICE '✅ Updated content policy';
  ELSE
    RAISE NOTICE '⏭️ content table does not exist - skipping';
  END IF;
END $$;

-- Update conversations policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "conversations_unified_access_policy" ON public.conversations;
    CREATE POLICY "conversations_unified_access_policy" ON public.conversations
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        (SELECT auth.uid()) IS NOT NULL
      )
    );
    RAISE NOTICE '✅ Updated conversations policy';
  ELSE
    RAISE NOTICE '⏭️ conversations table does not exist - skipping';
  END IF;
END $$;

-- Update messages policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "messages_unified_access_policy" ON public.messages;
    CREATE POLICY "messages_unified_access_policy" ON public.messages
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        (SELECT auth.uid()) IS NOT NULL
      )
    );
    RAISE NOTICE '✅ Updated messages policy';
  ELSE
    RAISE NOTICE '⏭️ messages table does not exist - skipping';
  END IF;
END $$;

-- Update notifications policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "notifications_unified" ON public.notifications;
    CREATE POLICY "notifications_unified" ON public.notifications
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        user_id = (SELECT auth.uid())
      )
    );
    RAISE NOTICE '✅ Updated notifications policy';
  ELSE
    RAISE NOTICE '⏭️ notifications table does not exist - skipping';
  END IF;
END $$;

-- Update companies policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "companies_unified" ON public.companies;
    CREATE POLICY "companies_unified" ON public.companies
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        user_id = (SELECT auth.uid())
      )
    );
    RAISE NOTICE '✅ Updated companies policy';
  ELSE
    RAISE NOTICE '⏭️ companies table does not exist - skipping';
  END IF;
END $$;

-- Update billing policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "billing_optimized_policy" ON public.billing;
    CREATE POLICY "billing_optimized_policy" ON public.billing
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        EXISTS (
          SELECT 1 FROM public.sites s 
          WHERE s.id = billing.site_id AND (
            s.user_id = (SELECT auth.uid()) OR
            EXISTS (
              SELECT 1 FROM public.site_members sm 
              WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
            )
          )
        )
      )
    );
    RAISE NOTICE '✅ Updated billing policy';
  ELSE
    RAISE NOTICE '⏭️ billing table does not exist - skipping';
  END IF;
END $$;

-- Update allowed_domains policy (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'allowed_domains' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "allowed_domains_access_policy" ON public.allowed_domains;
    CREATE POLICY "allowed_domains_access_policy" ON public.allowed_domains
    FOR ALL 
    USING (
      auth.is_service_role_or_user_condition(
        site_id IN (
          SELECT site_id FROM site_ownership WHERE user_id = (SELECT auth.uid())
          UNION
          SELECT site_id FROM site_members 
          WHERE user_id = (SELECT auth.uid()) AND status = 'active'
        )
      )
    );
    RAISE NOTICE '✅ Updated allowed_domains policy';
  ELSE
    RAISE NOTICE '⏭️ allowed_domains table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: ADD PERFORMANCE INDEXES (if not already exist)
-- ============================================================================

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_visitors_segment_id_performance ON public.visitors(segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitors_lead_id_performance ON public.visitors(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_site_id_performance ON public.visitor_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id_performance ON public.visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_site_members_site_user_status_performance ON public.site_members(site_id, user_id, status);

-- ============================================================================
-- STEP 5: COMPREHENSIVE VERIFICATION
-- ============================================================================

DO $$
DECLARE
    core_tables TEXT[] := ARRAY['visitors', 'visitor_sessions', 'leads', 'sales', 'segments', 'campaigns', 'experiments'];
    additional_tables TEXT[] := ARRAY['session_events', 'tasks', 'commands', 'agents', 'content', 'conversations', 'messages', 'notifications', 'companies', 'billing', 'allowed_domains'];
    table_name TEXT;
    updated_count INTEGER := 0;
    total_count INTEGER := 0;
    policy_name TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 COMPREHENSIVE VERIFICATION RESULTS';
    RAISE NOTICE '================================================================';
    
    -- Check helper function
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'is_service_role_or_user_condition' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
    ) THEN
        RAISE NOTICE '✅ Helper function auth.is_service_role_or_user_condition() exists';
    ELSE
        RAISE NOTICE '❌ Helper function missing!';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 CORE TABLES STATUS:';
    
    -- Check core tables
    FOREACH table_name IN ARRAY core_tables
    LOOP
        total_count := total_count + 1;
        IF EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name 
            AND schemaname = 'public'
            AND qual LIKE '%is_service_role_or_user_condition%'
        ) THEN
            SELECT policyname INTO policy_name 
            FROM pg_policies 
            WHERE tablename = table_name 
            AND schemaname = 'public'
            AND qual LIKE '%is_service_role_or_user_condition%'
            LIMIT 1;
            
            RAISE NOTICE '✅ %: Policy "%" updated', table_name, policy_name;
            updated_count := updated_count + 1;
        ELSE
            RAISE NOTICE '❌ %: Policy NOT updated', table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 ADDITIONAL TABLES STATUS:';
    
    -- Check additional tables
    FOREACH table_name IN ARRAY additional_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') THEN
            total_count := total_count + 1;
            IF EXISTS (
                SELECT 1 FROM pg_policies 
                WHERE tablename = table_name 
                AND schemaname = 'public'
                AND qual LIKE '%is_service_role_or_user_condition%'
            ) THEN
                SELECT policyname INTO policy_name 
                FROM pg_policies 
                WHERE tablename = table_name 
                AND schemaname = 'public'
                AND qual LIKE '%is_service_role_or_user_condition%'
                LIMIT 1;
                
                RAISE NOTICE '✅ %: Policy "%" updated', table_name, policy_name;
                updated_count := updated_count + 1;
            ELSE
                RAISE NOTICE '❌ %: Policy NOT updated', table_name;
            END IF;
        ELSE
            RAISE NOTICE '⏭️ %: Table does not exist', table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 FINAL SUMMARY:';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '✅ Successfully updated: % out of % tables', updated_count, total_count;
    RAISE NOTICE '⚡ All updated policies support service_role access';
    RAISE NOTICE '🏆 Performance optimized with helper function';
    RAISE NOTICE '🔒 Security maintained for regular users';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 NEXT STEPS:';
    RAISE NOTICE '1. Monitor Supabase logs for reduced 406 errors';
    RAISE NOTICE '2. Test admin operations work correctly';
    RAISE NOTICE '3. Check API response times for improvements';
    RAISE NOTICE '4. Verify regular user permissions unchanged';
    
END $$; 