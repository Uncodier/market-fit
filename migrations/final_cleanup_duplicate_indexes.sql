-- Migration: Final cleanup of all duplicate indexes
-- Description: Remove all duplicate indexes and keep only the essential ones with consistent naming
-- Date: 2025-01-30

-- ============================================================================
-- CLEANUP ALL DUPLICATE INDEXES
-- ============================================================================

BEGIN;

-- Drop all experiment_segments indexes and recreate only the essential ones
DROP INDEX IF EXISTS idx_experiment_segments_experiment_id;
DROP INDEX IF EXISTS idx_experiment_segments_experiment_id_perf;
DROP INDEX IF EXISTS idx_experiment_segments_experiment_lookup;
DROP INDEX IF EXISTS idx_experiment_segments_segment_id;
DROP INDEX IF EXISTS idx_experiment_segments_segment_id_perf;
DROP INDEX IF EXISTS idx_experiment_segments_composite;

-- Drop all experiments indexes and recreate only the essential ones  
DROP INDEX IF EXISTS idx_experiments_site_id;
DROP INDEX IF EXISTS idx_experiments_site_id_perf;
DROP INDEX IF EXISTS idx_experiments_site_lookup;

-- Drop all segments indexes and recreate only the essential ones
DROP INDEX IF EXISTS idx_segments_site_id;
DROP INDEX IF EXISTS idx_segments_site_id_perf;

-- Drop all site_members indexes and recreate only the essential ones
DROP INDEX IF EXISTS idx_site_members_lookup_perf;
DROP INDEX IF EXISTS idx_site_members_active_users;
DROP INDEX IF EXISTS idx_site_members_user_site_lookup;

-- Create only the essential indexes with consistent naming
-- For experiment_segments table
CREATE INDEX idx_experiment_segments_experiment_id ON experiment_segments(experiment_id);
CREATE INDEX idx_experiment_segments_segment_id ON experiment_segments(segment_id);

-- For experiments table
CREATE INDEX idx_experiments_site_id ON experiments(site_id);

-- For segments table  
CREATE INDEX idx_segments_site_id ON segments(site_id);

-- For site_members table (essential for RLS performance)
CREATE INDEX idx_site_members_user_site ON site_members(user_id, site_id);

COMMIT;

-- ============================================================================
-- VERIFY NO DUPLICATES REMAIN
-- ============================================================================

-- Check for any remaining duplicate indexes
SELECT 
    schemaname,
    tablename,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as indexes
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('experiment_segments', 'experiments', 'segments', 'site_members')
AND (
    indexname LIKE '%experiment%' 
    OR indexname LIKE '%segment%' 
    OR indexname LIKE '%site%'
)
GROUP BY schemaname, tablename, indexdef
HAVING COUNT(*) > 1;

-- Log completion
SELECT 'Final cleanup of duplicate indexes completed successfully' AS status; 