-- BATCH 3: Drop unused indexes (Notifications, Conversations, Tasks, etc.)
-- Execute this in Supabase SQL Editor after Batch 2
-- Safe to run - these indexes are not being used according to DB linter

-- Notifications indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_is_read;
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_site_id;

-- Conversations indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_conversations_user_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_conversations_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_conversations_delegate_id;

-- Experiment segments indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_experiment_segments_segment_id;

-- Experiments indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_experiments_user_id;

-- KPIs indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_kpis_segment_id;

-- Referral codes indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_referral_codes_created_by;

-- Requirements indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_requirements_user_id;

-- Session events indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_session_events_segment_id;

-- Site ownership indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_site_ownership_user_id;

SELECT 'BATCH 3 COMPLETED: Notifications, conversations, experiments indexes dropped' AS status; 