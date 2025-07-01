-- BATCH 2: Drop unused indexes (Segments, Agents, Leads, Campaigns)
-- Execute this in Supabase SQL Editor after Batch 1
-- Safe to run - these indexes are not being used according to DB linter

-- Segments indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_segments_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_segments_user_id;

-- Agents indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_agents_supervisor;
DROP INDEX CONCURRENTLY IF EXISTS idx_agents_user_id;

-- Leads indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_leads_email;
DROP INDEX CONCURRENTLY IF EXISTS idx_leads_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_leads_campaign_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_leads_user_id;

-- Campaign segments indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_campaign_segments_segment_id;

-- Campaigns indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_campaigns_user_id;

-- Commands indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_commands_site_id;

-- Content indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_content_author_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_segment_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_user_id;

SELECT 'BATCH 2 COMPLETED: Segments, agents, leads, campaigns indexes dropped' AS status; 