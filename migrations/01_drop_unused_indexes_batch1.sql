-- BATCH 1: Drop unused indexes (Site Members, Sales, Requirements)
-- Execute this in Supabase SQL Editor
-- Safe to run - these indexes are not being used according to DB linter

-- Site members indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_site_members_lookup;
DROP INDEX CONCURRENTLY IF EXISTS idx_site_members_added_by;

-- Agent memories indexes  
DROP INDEX CONCURRENTLY IF EXISTS idx_agent_memories_agent_id;

-- Sales indexes (unused according to linter)
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_lead_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_segment_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_sale_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_site_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_user_id;

-- Requirement segments indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_requirement_segments_requirement_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_requirement_segments_segment_id;

-- Debug logs indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_debug_logs_user_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_debug_logs_site_id;

SELECT 'BATCH 1 COMPLETED: Site members, sales, requirements indexes dropped' AS status; 