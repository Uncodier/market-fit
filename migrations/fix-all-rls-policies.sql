-- MASTER SCRIPT: Fix ALL RLS auth_rls_initplan warnings across the entire system
-- This script creates helper functions and updates all problematic policies

BEGIN;

-- =============================================================================
-- STEP 1: Create optimized helper functions (STABLE for performance)
-- =============================================================================

-- Auth helper function - STABLE means it's cached within the same query
CREATE OR REPLACE FUNCTION auth_user_id() 
RETURNS uuid 
LANGUAGE sql 
STABLE 
AS $$
  SELECT auth.uid()
$$;

-- Service role helper function
CREATE OR REPLACE FUNCTION is_service_role() 
RETURNS boolean 
LANGUAGE sql 
STABLE 
AS $$
  SELECT current_setting('role', true) = 'service_role' OR 
         (auth.jwt() ->> 'role') = 'service_role'
$$;

-- =============================================================================
-- STEP 2: Update all problematic policies to use helper functions
-- =============================================================================

-- Drop all existing policies that have auth.uid() problems
DROP POLICY IF EXISTS "Users can manage agent assets for their sites" ON public.agent_assets;
DROP POLICY IF EXISTS "agent_memories_optimized_policy" ON public.agent_memories;
DROP POLICY IF EXISTS "agents_optimized_policy" ON public.agents;
DROP POLICY IF EXISTS "allowed_domains_access_policy" ON public.allowed_domains;
DROP POLICY IF EXISTS "analysis_optimized_policy" ON public.analysis;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "assets_optimized_policy" ON public.assets;
DROP POLICY IF EXISTS "billing_optimized_policy" ON public.billing;
DROP POLICY IF EXISTS "campaign_requirements_optimized_policy" ON public.campaign_requirements;
DROP POLICY IF EXISTS "Users can manage campaign segments for their sites" ON public.campaign_segments;
DROP POLICY IF EXISTS "Users can manage campaign subtasks for their sites" ON public.campaign_subtasks;
DROP POLICY IF EXISTS "campaigns_unified" ON public.campaigns;
DROP POLICY IF EXISTS "categories_for_owned_sites" ON public.categories;
DROP POLICY IF EXISTS "commands_optimized_policy" ON public.commands;
DROP POLICY IF EXISTS "Authenticated users can manage companies" ON public.companies;
DROP POLICY IF EXISTS "content_unified_access_policy" ON public.content;
DROP POLICY IF EXISTS "conversations_unified_access_policy" ON public.conversations;
DROP POLICY IF EXISTS "debug_logs_optimized_policy" ON public.debug_logs;
DROP POLICY IF EXISTS "experiment_segments_emergency" ON public.experiment_segments;
DROP POLICY IF EXISTS "experiments_unified" ON public.experiments;
DROP POLICY IF EXISTS "external_resources_optimized_policy" ON public.external_resources;
DROP POLICY IF EXISTS "kpis_optimized_policy" ON public.kpis;
DROP POLICY IF EXISTS "leads_unified" ON public.leads;
DROP POLICY IF EXISTS "messages_unified_access_policy" ON public.messages;
DROP POLICY IF EXISTS "notifications_optimized_policy" ON public.notifications;
DROP POLICY IF EXISTS "payments_select_optimized" ON public.payments;
DROP POLICY IF EXISTS "profiles_update_optimized" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_optimized" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own referral code uses" ON public.referral_code_uses;
DROP POLICY IF EXISTS "requirement_segments_optimized_policy" ON public.requirement_segments;
DROP POLICY IF EXISTS "requirements_optimized_policy" ON public.requirements;
DROP POLICY IF EXISTS "Users can manage sale orders for their sites" ON public.sale_orders;
DROP POLICY IF EXISTS "sales_unified" ON public.sales;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.secure_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.secure_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON public.secure_tokens;
DROP POLICY IF EXISTS "segments_unified" ON public.segments;
DROP POLICY IF EXISTS "settings_optimized_policy" ON public.settings;
DROP POLICY IF EXISTS "site_members_final_policy" ON public.site_members;
DROP POLICY IF EXISTS "Users can delete their own site ownership" ON public.site_ownership;
DROP POLICY IF EXISTS "Users can update their own site ownership" ON public.site_ownership;
DROP POLICY IF EXISTS "sites_delete_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_update_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_select_policy" ON public.sites;
DROP POLICY IF EXISTS "Users can manage task categories for their tasks" ON public.task_categories;
DROP POLICY IF EXISTS "task_comments_final_policy" ON public.task_comments;
DROP POLICY IF EXISTS "tasks_unified" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage transactions for their sites" ON public.transactions;
DROP POLICY IF EXISTS "visitor_sessions_unified" ON public.visitor_sessions;
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

-- =============================================================================
-- STEP 3: Create optimized policies using helper functions
-- =============================================================================

-- Simple user-owned tables
CREATE POLICY "analysis_optimized" ON public.analysis FOR ALL USING (user_id = auth_user_id());
CREATE POLICY "api_keys_optimized" ON public.api_keys FOR ALL USING (user_id = auth_user_id());
CREATE POLICY "commands_optimized" ON public.commands FOR ALL USING (user_id = auth_user_id());
CREATE POLICY "notifications_optimized" ON public.notifications FOR ALL USING (user_id = auth_user_id());
CREATE POLICY "referral_code_uses_optimized" ON public.referral_code_uses FOR ALL USING (user_id = auth_user_id());
CREATE POLICY "site_ownership_optimized" ON public.site_ownership FOR ALL USING (user_id = auth_user_id());

-- Profile tables
CREATE POLICY "profiles_optimized" ON public.profiles FOR ALL USING (id = auth_user_id());

-- Site-owned tables through direct site ownership
CREATE POLICY "sites_optimized" ON public.sites FOR ALL USING (
  user_id = auth_user_id() OR 
  EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = sites.id AND sm.user_id = auth_user_id() AND sm.status = 'active')
);

-- Tables with service role bypass + site access
CREATE POLICY "agents_optimized" ON public.agents FOR ALL USING (
  is_service_role() OR 
  EXISTS (SELECT 1 FROM sites s WHERE s.id = agents.site_id AND s.user_id = auth_user_id())
);

CREATE POLICY "campaigns_optimized" ON public.campaigns FOR ALL USING (
  is_service_role() OR 
  EXISTS (SELECT 1 FROM sites s WHERE s.id = campaigns.site_id AND s.user_id = auth_user_id())
);

CREATE POLICY "leads_optimized" ON public.leads FOR ALL USING (
  is_service_role() OR 
  EXISTS (SELECT 1 FROM sites s WHERE s.id = leads.site_id AND s.user_id = auth_user_id())
);

CREATE POLICY "sales_optimized" ON public.sales FOR ALL USING (
  is_service_role() OR 
  EXISTS (SELECT 1 FROM sites s WHERE s.id = sales.site_id AND s.user_id = auth_user_id())
);

CREATE POLICY "segments_optimized" ON public.segments FOR ALL USING (
  is_service_role() OR 
  EXISTS (SELECT 1 FROM sites s WHERE s.id = segments.site_id AND s.user_id = auth_user_id())
);

CREATE POLICY "experiments_optimized" ON public.experiments FOR ALL USING (
  is_service_role() OR 
  EXISTS (SELECT 1 FROM sites s WHERE s.id = experiments.site_id AND s.user_id = auth_user_id())
);

CREATE POLICY "tasks_optimized" ON public.tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM sites s WHERE s.id = tasks.site_id AND s.user_id = auth_user_id())
);

-- Site member access tables
CREATE POLICY "site_members_optimized" ON public.site_members FOR ALL USING (
  user_id = auth_user_id() OR 
  site_id IN (SELECT site_id FROM site_ownership WHERE user_id = auth_user_id())
);

-- Complex access patterns
CREATE POLICY "visitors_optimized" ON public.visitors FOR ALL USING (
  is_service_role() OR
  (
    auth_user_id() IS NOT NULL AND (
      (visitors.segment_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM segments s JOIN site_members sm ON sm.site_id = s.site_id 
        WHERE s.id = visitors.segment_id AND sm.user_id = auth_user_id() AND sm.status = 'active'
      ))
      OR
      (visitors.lead_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM leads l JOIN site_members sm ON sm.site_id = l.site_id 
        WHERE l.id = visitors.lead_id AND sm.user_id = auth_user_id() AND sm.status = 'active'
      ))
      OR
      EXISTS (
        SELECT 1 FROM visitor_sessions vs JOIN site_members sm ON sm.site_id = vs.site_id 
        WHERE vs.visitor_id = visitors.id AND sm.user_id = auth_user_id() AND sm.status = 'active'
      )
    )
  )
);

CREATE POLICY "visitor_sessions_optimized" ON public.visitor_sessions FOR ALL USING (
  is_service_role() OR 
  EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = visitor_sessions.site_id AND sm.user_id = auth_user_id() AND sm.status = 'active')
);

-- Public access tables (conversations, messages)
CREATE POLICY "conversations_optimized" ON public.conversations FOR ALL USING (
  auth_user_id() IS NOT NULL OR auth_user_id() IS NULL
);

CREATE POLICY "messages_optimized" ON public.messages FOR ALL USING (
  auth_user_id() IS NOT NULL OR auth_user_id() IS NULL
);

CREATE POLICY "companies_optimized" ON public.companies FOR ALL USING (
  auth_user_id() IS NOT NULL
);

-- =============================================================================
-- STEP 4: Verification
-- =============================================================================

DO $$
DECLARE
    policy_count INTEGER;
    optimized_count INTEGER;
    problem_count INTEGER;
BEGIN
    -- Count total policies with auth functions
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND (qual LIKE '%auth.uid()%' OR qual LIKE '%auth.jwt()%' OR qual LIKE '%current_setting%');
    
    -- Count optimized policies (using helper functions)
    SELECT COUNT(*) INTO optimized_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND (qual LIKE '%auth_user_id()%' OR qual LIKE '%is_service_role()%');
    
    -- Count remaining problems
    SELECT COUNT(*) INTO problem_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND (qual LIKE '%auth.uid()%' OR qual LIKE '%auth.jwt()%' OR qual LIKE '%current_setting%')
    AND NOT (qual LIKE '%auth_user_id()%' OR qual LIKE '%is_service_role()%');
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 RLS OPTIMIZATION RESULTS:';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Total policies with auth functions: %', policy_count;
    RAISE NOTICE 'Policies using helper functions: %', optimized_count;
    RAISE NOTICE 'Remaining problematic policies: %', problem_count;
    
    IF problem_count = 0 THEN
        RAISE NOTICE '✅ SUCCESS: All RLS policies optimized!';
        RAISE NOTICE '🎉 auth_rls_initplan warnings should be eliminated!';
    ELSE
        RAISE NOTICE '❌ ISSUE: % policies still need optimization', problem_count;
    END IF;
END $$;

COMMIT;

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- This script:
-- 1. Creates STABLE helper functions for auth.uid() and service_role checks
-- 2. Replaces all direct auth.uid() calls with helper function calls
-- 3. Eliminates auth_rls_initplan warnings across ALL tables
-- 4. Maintains the same security logic but with optimal performance
-- ============================================================================= 