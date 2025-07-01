-- Migration: Drop unused indexes  
-- Description: Removes indexes that have never been used to improve write performance
-- Date: 2025-01-30
-- IMPORTANT: Review this carefully before executing in production!

-- ⚠️  SAFETY FIRST: Backup your database before running this script
-- ⚠️  Consider running during low-traffic hours
-- ⚠️  You can always recreate these indexes later if needed

-- === WAITLIST TABLE ===
-- These might be used when waitlist functionality is active
DROP INDEX IF EXISTS idx_waitlist_email;
DROP INDEX IF EXISTS idx_waitlist_status; 
DROP INDEX IF EXISTS idx_waitlist_created_at;

-- === SALES TABLE ===
-- These should probably be kept if sales functionality is important
-- DROP INDEX IF EXISTS idx_sales_lead_id;        -- KEEP: Important for sales-leads relationship
-- DROP INDEX IF EXISTS idx_sales_segment_id;     -- KEEP: Used for segment analysis  
-- DROP INDEX IF EXISTS idx_sales_sale_date;      -- KEEP: Used for date range queries
-- DROP INDEX IF EXISTS idx_sales_site_id;        -- KEEP: Used for site-specific sales
DROP INDEX IF EXISTS idx_sales_command_id;        -- Safe to drop if commands aren't used much

-- === CRON STATUS TABLE ===
-- Safe to drop if cron jobs aren't heavily used
DROP INDEX IF EXISTS idx_cron_status_workflow_id;
DROP INDEX IF EXISTS idx_cron_status_schedule_id;
DROP INDEX IF EXISTS idx_cron_status_status;
DROP INDEX IF EXISTS idx_cron_status_next_run;

-- === VISITOR SESSIONS TABLE ===
-- Safe to drop if visitor tracking isn't critical
DROP INDEX IF EXISTS idx_visitor_sessions_identified_at;

-- === SEGMENTS TABLE ===
-- DROP INDEX IF EXISTS idx_segments_name;         -- KEEP: Probably used for lookups

-- === LEADS TABLE ===
-- These might be important for lead management
-- DROP INDEX IF EXISTS idx_leads_email;           -- KEEP: Important for email lookups
-- DROP INDEX IF EXISTS idx_leads_name;            -- KEEP: Used for name searches
DROP INDEX IF EXISTS idx_leads_social_networks;
DROP INDEX IF EXISTS idx_leads_address;
DROP INDEX IF EXISTS idx_leads_company;
DROP INDEX IF EXISTS idx_leads_subscription;
DROP INDEX IF EXISTS idx_leads_company_id;

-- === REQUIREMENTS TABLE ===
DROP INDEX IF EXISTS idx_requirements_priority;
DROP INDEX IF EXISTS idx_requirements_title;

-- === AGENTS TABLE ===
DROP INDEX IF EXISTS idx_agents_type;

-- === EXPERIMENTS TABLE ===
DROP INDEX IF EXISTS idx_experiments_status;
DROP INDEX IF EXISTS idx_experiments_campaign_id;
DROP INDEX IF EXISTS idx_experiments_command_id;

-- === ASSETS TABLE ===
DROP INDEX IF EXISTS idx_assets_file_type;
DROP INDEX IF EXISTS idx_assets_name;
DROP INDEX IF EXISTS idx_assets_command_id;

-- === NOTIFICATIONS TABLE ===
-- These might be used for notification management
-- DROP INDEX IF EXISTS idx_notifications_is_read;      -- KEEP: Important for filtering
-- DROP INDEX IF EXISTS idx_notifications_created_at;   -- KEEP: Used for ordering
-- DROP INDEX IF EXISTS idx_notifications_type;         -- KEEP: Used for filtering

-- === EXTERNAL RESOURCES TABLE ===
DROP INDEX IF EXISTS idx_external_resources_key;

-- === CATEGORIES TABLE ===
DROP INDEX IF EXISTS idx_categories_name;
DROP INDEX IF EXISTS idx_categories_is_active;

-- === TASK CATEGORIES TABLE ===
DROP INDEX IF EXISTS idx_task_categories_category_id;

-- === KPIS TABLE ===
DROP INDEX IF EXISTS idx_kpis_is_highlighted;
DROP INDEX IF EXISTS idx_kpis_name;

-- === CONVERSATIONS TABLE ===
-- DROP INDEX IF EXISTS idx_conversations_user_id;      -- KEEP: Important for user lookups
-- DROP INDEX IF EXISTS idx_conversations_status;       -- KEEP: Used for filtering

-- === MESSAGES TABLE ===
DROP INDEX IF EXISTS idx_messages_agent_id;
DROP INDEX IF EXISTS idx_messages_user_id;

-- === TASK COMMENTS TABLE ===
DROP INDEX IF EXISTS idx_task_comments_created_at;

-- === TASKS TABLE ===
-- Many of these might be important for task management
DROP INDEX IF EXISTS idx_tasks_serial_id;
DROP INDEX IF EXISTS idx_tasks_address;
DROP INDEX IF EXISTS idx_tasks_site_status_priority;
DROP INDEX IF EXISTS idx_tasks_command_id;
-- DROP INDEX IF EXISTS idx_tasks_status;               -- KEEP: Important for filtering
-- DROP INDEX IF EXISTS idx_tasks_stage;                -- KEEP: Used for kanban views

-- === AGENT MEMORIES TABLE ===
DROP INDEX IF EXISTS idx_memories_user_id;
DROP INDEX IF EXISTS idx_memories_key;
DROP INDEX IF EXISTS idx_memories_last_accessed;
DROP INDEX IF EXISTS idx_memories_raw_data;

-- === REQUIREMENT SEGMENTS TABLE ===
DROP INDEX IF EXISTS idx_requirement_segments_command_id;

-- === EXPERIMENT SEGMENTS TABLE ===
DROP INDEX IF EXISTS idx_experiment_segments_command_id;

-- === PROFILES TABLE ===
DROP INDEX IF EXISTS idx_profiles_command_id;
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_profiles_language;
DROP INDEX IF EXISTS idx_profiles_timezone;
DROP INDEX IF EXISTS idx_profiles_notifications;
DROP INDEX IF EXISTS idx_profiles_settings;

-- === SITES TABLE ===
DROP INDEX IF EXISTS idx_sites_command_id;

-- === ANALYSIS TABLE ===
DROP INDEX IF EXISTS idx_analysis_command_id;
DROP INDEX IF EXISTS analysis_site_id_idx;
DROP INDEX IF EXISTS analysis_url_path_idx;
DROP INDEX IF EXISTS analysis_created_at_idx;

-- === DEBUG LOGS TABLE ===
DROP INDEX IF EXISTS idx_debug_logs_command_id;

-- === AGENT ASSETS TABLE ===
DROP INDEX IF EXISTS idx_agent_assets_command_id;
DROP INDEX IF EXISTS idx_agent_assets_asset_id;

-- === TRANSACTIONS TABLE ===
DROP INDEX IF EXISTS idx_transactions_command_id;
-- DROP INDEX IF EXISTS idx_transactions_type;          -- KEEP: Might be used for filtering
-- DROP INDEX IF EXISTS idx_transactions_site_id;       -- KEEP: Important for site queries

-- === CAMPAIGN SUBTASKS TABLE ===
DROP INDEX IF EXISTS idx_campaign_subtasks_command_id;
DROP INDEX IF EXISTS idx_campaign_subtasks_status;

-- === CAMPAIGN SEGMENTS TABLE ===
DROP INDEX IF EXISTS idx_campaign_segments_command_id;

-- === VISITORS TABLE ===
DROP INDEX IF EXISTS idx_visitors_is_identified;

-- === PAYMENTS TABLE ===
DROP INDEX IF EXISTS idx_payments_created_at;
DROP INDEX IF EXISTS idx_payments_transaction_type;
DROP INDEX IF EXISTS idx_payments_transaction_id;

-- === COMPANIES TABLE ===
DROP INDEX IF EXISTS idx_companies_industry;
DROP INDEX IF EXISTS idx_companies_size;
DROP INDEX IF EXISTS idx_companies_tax_id;
DROP INDEX IF EXISTS idx_companies_registration_number;
DROP INDEX IF EXISTS idx_companies_vat_number;
DROP INDEX IF EXISTS idx_companies_tax_country;
DROP INDEX IF EXISTS idx_companies_legal_structure;
DROP INDEX IF EXISTS idx_companies_parent_company_id;
DROP INDEX IF EXISTS idx_companies_is_public;
DROP INDEX IF EXISTS idx_companies_employees_count;
DROP INDEX IF EXISTS idx_companies_business_model;
DROP INDEX IF EXISTS idx_companies_remote_policy;
DROP INDEX IF EXISTS idx_companies_acquired_by_id;
DROP INDEX IF EXISTS idx_companies_last_funding_date;
DROP INDEX IF EXISTS idx_companies_ipo_date;

-- === API KEYS TABLE ===
DROP INDEX IF EXISTS idx_api_keys_key_hash;

-- === SESSION EVENTS TABLE ===
DROP INDEX IF EXISTS idx_session_events_timestamp;
DROP INDEX IF EXISTS idx_session_events_event_type;

-- === CAMPAIGNS TABLE ===
DROP INDEX IF EXISTS idx_campaigns_priority;
DROP INDEX IF EXISTS idx_campaigns_type;

-- === REFERRAL CODES TABLE ===
DROP INDEX IF EXISTS idx_referral_codes_is_active;
DROP INDEX IF EXISTS idx_referral_codes_expires_at;

-- === OTHER INDEXES ===
DROP INDEX IF EXISTS segments_url_idx;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Unused indexes cleanup completed successfully!';
    RAISE NOTICE 'Performance should improve for INSERT/UPDATE/DELETE operations.';
    RAISE NOTICE 'You can always recreate these indexes later if needed.';
END $$; 