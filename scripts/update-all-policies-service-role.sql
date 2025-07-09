-- Script to systematically update ALL RLS policies to support service_role access
-- This should be run in Supabase SQL Editor after the main migration
-- It identifies tables that likely need service_role access and updates their policies

-- ============================================================================
-- STEP 1: IDENTIFY TABLES THAT NEED SERVICE_ROLE ACCESS
-- ============================================================================

DO $$
DECLARE
    table_name TEXT;
    policy_name TEXT;
    policy_definition TEXT;
    tables_to_update TEXT[] := ARRAY[
        'leads', 'sales', 'segments', 'campaigns', 'experiments', 
        'session_events', 'tasks', 'commands', 'agents', 'content',
        'conversations', 'messages', 'requirements', 'notifications',
        'companies', 'billing', 'secure_tokens', 'allowed_domains'
    ];
BEGIN
    RAISE NOTICE '🔍 ANALYZING TABLES THAT NEED SERVICE_ROLE ACCESS...';
    RAISE NOTICE '================================================================';
    
    -- Check each table for existing policies
    FOREACH table_name IN ARRAY tables_to_update
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '📋 Table: %', table_name;
        
        -- Check if table exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') THEN
            RAISE NOTICE '   ⚠️  Table does not exist - skipping';
            CONTINUE;
        END IF;
        
        -- Check if RLS is enabled
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = table_name AND relrowsecurity = true) THEN
            RAISE NOTICE '   ⚠️  RLS not enabled - skipping';
            CONTINUE;
        END IF;
        
        -- List existing policies
        FOR policy_name IN
            SELECT policyname FROM pg_policies 
            WHERE tablename = table_name AND schemaname = 'public'
        LOOP
            RAISE NOTICE '   📝 Policy: %', policy_name;
        END LOOP;
        
        -- Check if policies might need service_role access
        IF EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name 
            AND schemaname = 'public' 
            AND qual LIKE '%auth.uid()%'
        ) THEN
            RAISE NOTICE '   ✅ Needs service_role access (uses auth.uid())';
        ELSE
            RAISE NOTICE '   ❌ May not need service_role access';
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '🎯 RECOMMENDATION: Update policies for tables marked with ✅';
END $$;

-- ============================================================================
-- STEP 2: UPDATE COMMON POLICIES FOR TABLES THAT NEED SERVICE_ROLE ACCESS
-- ============================================================================

-- Update session_events (commonly used in analytics)
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

-- Update tasks (commonly used in admin operations)
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

-- Update commands (commonly used in admin operations)
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

-- Update agents (commonly used in admin operations)
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

-- Update content (commonly used in admin operations)
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

-- Update conversations (commonly used in admin operations)
DROP POLICY IF EXISTS "conversations_unified_access_policy" ON public.conversations;
CREATE POLICY "conversations_unified_access_policy" ON public.conversations
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    (SELECT auth.uid()) IS NOT NULL
  )
);

-- Update messages (commonly used in admin operations)
DROP POLICY IF EXISTS "messages_unified_access_policy" ON public.messages;
CREATE POLICY "messages_unified_access_policy" ON public.messages
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    (SELECT auth.uid()) IS NOT NULL
  )
);

-- Update requirements (commonly used in admin operations)
DROP POLICY IF EXISTS "requirements_unified" ON public.requirements;
CREATE POLICY "requirements_unified" ON public.requirements
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = requirements.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
        )
      )
    )
  )
);

-- Update notifications (commonly used in admin operations)
DROP POLICY IF EXISTS "notifications_unified" ON public.notifications;
CREATE POLICY "notifications_unified" ON public.notifications
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    user_id = (SELECT auth.uid())
  )
);

-- Update companies (commonly used in admin operations)
DROP POLICY IF EXISTS "companies_unified" ON public.companies;
CREATE POLICY "companies_unified" ON public.companies
FOR ALL 
USING (
  auth.is_service_role_or_user_condition(
    user_id = (SELECT auth.uid())
  )
);

-- Update billing (commonly used in admin operations)
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

-- Update allowed_domains (commonly used in admin operations)
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

-- ============================================================================
-- STEP 3: VERIFICATION OF UPDATED POLICIES
-- ============================================================================

DO $$
DECLARE
    updated_count INTEGER := 0;
    table_name TEXT;
    policy_name TEXT;
    tables_updated TEXT[] := ARRAY[
        'session_events', 'tasks', 'commands', 'agents', 'content',
        'conversations', 'messages', 'requirements', 'notifications',
        'companies', 'billing', 'allowed_domains'
    ];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFYING UPDATED POLICIES...';
    RAISE NOTICE '================================================================';
    
    FOREACH table_name IN ARRAY tables_updated
    LOOP
        -- Check if the policy exists and contains our helper function
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
            
            RAISE NOTICE '✅ %: Policy "%" updated with service_role support', table_name, policy_name;
            updated_count := updated_count + 1;
        ELSE
            RAISE NOTICE '❌ %: Policy may not have been updated', table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 SUMMARY: % out of % policies updated successfully', updated_count, array_length(tables_updated, 1);
    RAISE NOTICE '';
    RAISE NOTICE '🎯 All updated policies now support service_role access for admin operations';
    RAISE NOTICE '⚡ Performance is optimized with the helper function auth.is_service_role_or_user_condition()';
END $$; 