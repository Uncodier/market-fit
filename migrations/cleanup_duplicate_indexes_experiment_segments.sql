-- Migration: Cleanup duplicate indexes for experiment_segments and related tables
-- Description: Remove duplicate indexes created by previous migrations to improve performance
-- Date: 2025-01-30

-- ============================================================================
-- CLEANUP DUPLICATE INDEXES
-- ============================================================================

BEGIN;

-- Drop the older, less optimal indexes and keep the newer performance-optimized ones

-- For experiment_segments table
DROP INDEX IF EXISTS idx_experiment_segments_experiment_id;
DROP INDEX IF EXISTS idx_experiment_segments_segment_id;

-- Keep: idx_experiment_segments_experiment_id_perf, idx_experiment_segments_segment_id_perf, idx_experiment_segments_composite

-- For experiments table
DROP INDEX IF EXISTS idx_experiments_site_id;

-- Keep: idx_experiments_site_id_perf

-- For segments table
DROP INDEX IF EXISTS idx_segments_site_id;

-- Keep: idx_segments_site_id_perf

-- Ensure we don't have any other potential duplicates by checking and dropping older patterns
DROP INDEX IF EXISTS idx_perf_experiment_segments_experiment_id;
DROP INDEX IF EXISTS idx_perf_experiment_segments_segment_id;
DROP INDEX IF EXISTS idx_perf_experiments_site_id;
DROP INDEX IF EXISTS idx_perf_segments_site_id;

COMMIT;

-- ============================================================================
-- VERIFY REMAINING INDEXES
-- ============================================================================

-- Log the remaining indexes for verification
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('experiment_segments', 'experiments', 'segments')
AND indexname LIKE '%experiment%' OR indexname LIKE '%segment%'
ORDER BY tablename, indexname;

-- Log completion
SELECT 'Duplicate indexes cleanup completed successfully' AS status; 