-- BATCH 5: Create missing foreign key indexes (Agent Assets, Analysis, Assets)
-- Execute this in Supabase SQL Editor after completing all DROP batches
-- These indexes will improve JOIN performance for foreign keys

-- Agent assets foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_assets_asset_id_new ON public.agent_assets(asset_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_assets_command_id_new ON public.agent_assets(command_id);

-- Analysis foreign key indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analysis_site_id_new ON public.analysis(site_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analysis_command_id_new ON public.analysis(command_id);

-- Assets foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_command_id_new ON public.assets(command_id);

-- Campaign segments foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_segments_command_id_new ON public.campaign_segments(command_id);

-- Campaign subtasks foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_subtasks_command_id_new ON public.campaign_subtasks(command_id);

SELECT 'BATCH 5 COMPLETED: Agent assets, analysis, assets foreign key indexes created' AS status; 