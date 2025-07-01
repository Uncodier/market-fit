-- BATCH 6: Create missing foreign key indexes (Companies, Debug Logs, Experiments)
-- Execute this in Supabase SQL Editor after Batch 5
-- These indexes will improve JOIN performance for foreign keys

-- Companies foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_acquired_by_id_new ON public.companies(acquired_by_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_parent_company_id_new ON public.companies(parent_company_id);

-- Debug logs foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_debug_logs_command_id_new ON public.debug_logs(command_id);

-- Experiment segments foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_segments_command_id_new ON public.experiment_segments(command_id);

-- Experiments foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiments_campaign_id_new ON public.experiments(campaign_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiments_command_id_new ON public.experiments(command_id);

-- Leads foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_company_id_new ON public.leads(company_id);

SELECT 'BATCH 6 COMPLETED: Companies, debug logs, experiments foreign key indexes created' AS status; 