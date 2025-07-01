-- BATCH 4: Drop unused indexes (Tasks, Transactions, Visitors - FINAL)
-- Execute this in Supabase SQL Editor after Batch 3
-- Safe to run - these indexes are not being used according to DB linter

-- Tasks indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_tasks_assignee;
DROP INDEX CONCURRENTLY IF EXISTS idx_tasks_user_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_tasks_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_tasks_stage;

-- Transactions indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_site_id;

-- Visitors indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_visitors_campaign_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_visitors_segment_id;

SELECT 'BATCH 4 COMPLETED: All unused indexes have been dropped!' AS status,
       'Phase 1 Complete: Ready for foreign key indexes' AS next_phase; 