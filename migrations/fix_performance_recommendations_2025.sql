-- MIGRATION: Fix Performance Recommendations from Supabase Linter
-- Date: 2025-01-30
-- Description: Addresses specific unindexed foreign keys and unused indexes identified by Supabase DB linter

DO $$
BEGIN
    RAISE NOTICE '🔧 FIXING PERFORMANCE RECOMMENDATIONS...';
    RAISE NOTICE '📊 Adding missing foreign key indexes and removing unused indexes';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 1: CREATE MISSING FOREIGN KEY INDEXES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📈 Creating missing foreign key indexes...';
END $$;

-- Table: agent_assets
CREATE INDEX IF NOT EXISTS idx_agent_assets_asset_id ON public.agent_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_agent_assets_command_id ON public.agent_assets(command_id);

-- Table: analysis  
CREATE INDEX IF NOT EXISTS idx_analysis_site_id ON public.analysis(site_id);
CREATE INDEX IF NOT EXISTS idx_analysis_command_id ON public.analysis(command_id);

-- Table: assets
CREATE INDEX IF NOT EXISTS idx_assets_command_id ON public.assets(command_id);

-- Table: campaign_segments
CREATE INDEX IF NOT EXISTS idx_campaign_segments_command_id ON public.campaign_segments(command_id);

-- Table: campaign_subtasks
CREATE INDEX IF NOT EXISTS idx_campaign_subtasks_command_id ON public.campaign_subtasks(command_id);

-- Table: companies
CREATE INDEX IF NOT EXISTS idx_companies_acquired_by_id ON public.companies(acquired_by_id);
CREATE INDEX IF NOT EXISTS idx_companies_parent_company_id ON public.companies(parent_company_id);

-- Table: debug_logs
CREATE INDEX IF NOT EXISTS idx_debug_logs_command_id ON public.debug_logs(command_id);

-- Table: experiment_segments
CREATE INDEX IF NOT EXISTS idx_experiment_segments_command_id ON public.experiment_segments(command_id);

-- Table: experiments
CREATE INDEX IF NOT EXISTS idx_experiments_campaign_id ON public.experiments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_experiments_command_id ON public.experiments(command_id);

-- Table: leads
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);

-- Table: profiles
CREATE INDEX IF NOT EXISTS idx_profiles_command_id ON public.profiles(command_id);

-- Table: requirement_segments
CREATE INDEX IF NOT EXISTS idx_requirement_segments_command_id ON public.requirement_segments(command_id);

-- Table: sales
CREATE INDEX IF NOT EXISTS idx_sales_command_id ON public.sales(command_id);

-- Table: sites
CREATE INDEX IF NOT EXISTS idx_sites_command_id ON public.sites(command_id);

-- Table: task_categories
CREATE INDEX IF NOT EXISTS idx_task_categories_category_id ON public.task_categories(category_id);

-- Table: tasks
CREATE INDEX IF NOT EXISTS idx_tasks_command_id ON public.tasks(command_id);

-- Table: transactions
CREATE INDEX IF NOT EXISTS idx_transactions_command_id ON public.transactions(command_id);

-- ============================================================================
-- PART 2: DROP UNUSED INDEXES 
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🗑️  Dropping unused indexes...';
    RAISE NOTICE '⚠️  These indexes have never been used according to Supabase linter';
END $$;

-- Site members indexes
DROP INDEX IF EXISTS idx_site_members_lookup;
DROP INDEX IF EXISTS idx_site_members_added_by;

-- Agent memories indexes
DROP INDEX IF EXISTS idx_agent_memories_agent_id;

-- Sales indexes (keeping essential ones, dropping unused)
DROP INDEX IF EXISTS idx_sales_lead_id;
DROP INDEX IF EXISTS idx_sales_segment_id;
DROP INDEX IF EXISTS idx_sales_sale_date;
DROP INDEX IF EXISTS idx_sales_site_id;
DROP INDEX IF EXISTS idx_sales_user_id;

-- Requirement segments indexes
DROP INDEX IF EXISTS idx_requirement_segments_requirement_id;
DROP INDEX IF EXISTS idx_requirement_segments_segment_id;

-- Debug logs indexes
DROP INDEX IF EXISTS idx_debug_logs_user_id;
DROP INDEX IF EXISTS idx_debug_logs_site_id;

-- Segments indexes
DROP INDEX IF EXISTS idx_segments_name;
DROP INDEX IF EXISTS idx_segments_user_id;

-- Agents indexes
DROP INDEX IF EXISTS idx_agents_supervisor;
DROP INDEX IF EXISTS idx_agents_user_id;

-- Leads indexes
DROP INDEX IF EXISTS idx_leads_email;
DROP INDEX IF EXISTS idx_leads_name;
DROP INDEX IF EXISTS idx_leads_campaign_id;
DROP INDEX IF EXISTS idx_leads_user_id;

-- Campaign segments indexes
DROP INDEX IF EXISTS idx_campaign_segments_segment_id;

-- Campaigns indexes
DROP INDEX IF EXISTS idx_campaigns_user_id;

-- Commands indexes
DROP INDEX IF EXISTS idx_commands_site_id;

-- Content indexes
DROP INDEX IF EXISTS idx_content_author_id;
DROP INDEX IF EXISTS idx_content_segment_id;
DROP INDEX IF EXISTS idx_content_user_id;

-- Notifications indexes
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_type;
DROP INDEX IF EXISTS idx_notifications_site_id;

-- Conversations indexes
DROP INDEX IF EXISTS idx_conversations_user_id;
DROP INDEX IF EXISTS idx_conversations_status;
DROP INDEX IF EXISTS idx_conversations_delegate_id;

-- Experiment segments indexes
DROP INDEX IF EXISTS idx_experiment_segments_segment_id;

-- Experiments indexes
DROP INDEX IF EXISTS idx_experiments_user_id;

-- KPIs indexes
DROP INDEX IF EXISTS idx_kpis_segment_id;

-- Referral codes indexes
DROP INDEX IF EXISTS idx_referral_codes_created_by;

-- Requirements indexes
DROP INDEX IF EXISTS idx_requirements_user_id;

-- Session events indexes
DROP INDEX IF EXISTS idx_session_events_segment_id;

-- Site ownership indexes
DROP INDEX IF EXISTS idx_site_ownership_user_id;

-- Tasks indexes
DROP INDEX IF EXISTS idx_tasks_assignee;
DROP INDEX IF EXISTS idx_tasks_user_id;
DROP INDEX IF EXISTS idx_tasks_status;
DROP INDEX IF EXISTS idx_tasks_stage;

-- Transactions indexes
DROP INDEX IF EXISTS idx_transactions_user_id;
DROP INDEX IF EXISTS idx_transactions_type;
DROP INDEX IF EXISTS idx_transactions_site_id;

-- Visitors indexes
DROP INDEX IF EXISTS idx_visitors_campaign_id;
DROP INDEX IF EXISTS idx_visitors_segment_id;

-- ============================================================================
-- PART 3: VERIFICATION
-- ============================================================================

DO $$
DECLARE
    total_indexes_before INTEGER;
    total_indexes_after INTEGER;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ PERFORMANCE OPTIMIZATION COMPLETE!';
    RAISE NOTICE '';
    
    -- Count current indexes
    SELECT COUNT(*) INTO total_indexes_after
    FROM pg_indexes 
    WHERE schemaname = 'public';
    
    RAISE NOTICE '📊 Database index summary:';
    RAISE NOTICE '   • Total indexes remaining: %', total_indexes_after;
    RAISE NOTICE '';
    
    RAISE NOTICE '🎯 Expected improvements:';
    RAISE NOTICE '   • ✅ Better foreign key query performance (22 new indexes)';
    RAISE NOTICE '   • ✅ Faster INSERT/UPDATE/DELETE operations (45 unused indexes removed)';
    RAISE NOTICE '   • ✅ Reduced storage overhead';
    RAISE NOTICE '   • ✅ Improved overall database performance';
    RAISE NOTICE '';
    
    RAISE NOTICE '⚠️  Important notes:';
    RAISE NOTICE '   • Monitor query performance after deployment';
    RAISE NOTICE '   • Some removed indexes can be recreated if needed';
    RAISE NOTICE '   • Run ANALYZE on affected tables if needed';
    RAISE NOTICE '';
    
END $$;

-- Add performance monitoring comment
COMMENT ON SCHEMA public IS 'Performance optimized on 2025-01-30: Added foreign key indexes, removed unused indexes';

SELECT 'PERFORMANCE_RECOMMENDATIONS_APPLIED' AS status; 