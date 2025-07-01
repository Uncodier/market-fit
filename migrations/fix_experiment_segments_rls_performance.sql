-- Migration: Fix experiment_segments RLS policy violation and optimize performance
-- Description: Fix RLS policy for experiment_segments to prevent violations during inserts
-- and optimize performance with better indexing
-- Date: 2025-01-30

-- ============================================================================
-- EXPERIMENT SEGMENTS TABLE RLS FIX
-- ============================================================================

BEGIN;

-- Drop the current policy that may be causing issues
DROP POLICY IF EXISTS "experiment_segments_optimized_policy" ON experiment_segments;
DROP POLICY IF EXISTS "Users can manage experiment segments for their sites" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_unified" ON experiment_segments;

-- Create separate policies for different operations to optimize performance
-- and prevent RLS violations during inserts

-- Policy for SELECT operations
CREATE POLICY "experiment_segments_select_policy" ON experiment_segments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM experiments e
    JOIN site_members sm ON sm.site_id = e.site_id
    WHERE e.id = experiment_segments.experiment_id 
    AND sm.user_id = (SELECT auth.uid())
    AND sm.status = 'active'
  )
);

-- Policy for INSERT operations with optimized check
CREATE POLICY "experiment_segments_insert_policy" ON experiment_segments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM experiments e
    JOIN site_members sm ON sm.site_id = e.site_id
    WHERE e.id = experiment_segments.experiment_id 
    AND sm.user_id = (SELECT auth.uid())
    AND sm.status = 'active'
  )
  AND 
  EXISTS (
    SELECT 1 FROM segments s
    JOIN site_members sm ON sm.site_id = s.site_id
    WHERE s.id = experiment_segments.segment_id 
    AND sm.user_id = (SELECT auth.uid())
    AND sm.status = 'active'
  )
);

-- Policy for UPDATE operations
CREATE POLICY "experiment_segments_update_policy" ON experiment_segments
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM experiments e
    JOIN site_members sm ON sm.site_id = e.site_id
    WHERE e.id = experiment_segments.experiment_id 
    AND sm.user_id = (SELECT auth.uid())
    AND sm.status = 'active'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM experiments e
    JOIN site_members sm ON sm.site_id = e.site_id
    WHERE e.id = experiment_segments.experiment_id 
    AND sm.user_id = (SELECT auth.uid())
    AND sm.status = 'active'
  )
  AND 
  EXISTS (
    SELECT 1 FROM segments s
    JOIN site_members sm ON sm.site_id = s.site_id
    WHERE s.id = experiment_segments.segment_id 
    AND sm.user_id = (SELECT auth.uid())
    AND sm.status = 'active'
  )
);

-- Policy for DELETE operations
CREATE POLICY "experiment_segments_delete_policy" ON experiment_segments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM experiments e
    JOIN site_members sm ON sm.site_id = e.site_id
    WHERE e.id = experiment_segments.experiment_id 
    AND sm.user_id = (SELECT auth.uid())
    AND sm.status = 'active'
  )
);

COMMIT;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ============================================================================

BEGIN;

-- Ensure we have optimal indexes for the RLS policies
CREATE INDEX IF NOT EXISTS idx_experiment_segments_experiment_id_perf 
ON experiment_segments(experiment_id);

CREATE INDEX IF NOT EXISTS idx_experiment_segments_segment_id_perf 
ON experiment_segments(segment_id);

-- Composite index for the most common lookup pattern
CREATE INDEX IF NOT EXISTS idx_experiment_segments_composite 
ON experiment_segments(experiment_id, segment_id);

-- Ensure we have the necessary indexes on related tables for RLS performance
CREATE INDEX IF NOT EXISTS idx_experiments_site_id_perf 
ON experiments(site_id);

CREATE INDEX IF NOT EXISTS idx_segments_site_id_perf 
ON segments(site_id);

CREATE INDEX IF NOT EXISTS idx_site_members_lookup_perf 
ON site_members(site_id, user_id, status) 
WHERE status = 'active';

-- Create partial index for better performance on active site members
CREATE INDEX IF NOT EXISTS idx_site_members_active_users 
ON site_members(site_id, user_id) 
WHERE status = 'active';

COMMIT;

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER OPTIMIZATION
-- ============================================================================

-- Update table statistics for better query planning
ANALYZE experiment_segments;
ANALYZE experiments;
ANALYZE segments;
ANALYZE site_members;

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY "experiment_segments_select_policy" ON experiment_segments IS 
'Allows users to view experiment-segment relationships for experiments in sites they have access to';

COMMENT ON POLICY "experiment_segments_insert_policy" ON experiment_segments IS 
'Allows users to create experiment-segment relationships when they have access to both the experiment and segment';

COMMENT ON POLICY "experiment_segments_update_policy" ON experiment_segments IS 
'Allows users to update experiment-segment relationships when they have access to both resources';

COMMENT ON POLICY "experiment_segments_delete_policy" ON experiment_segments IS 
'Allows users to delete experiment-segment relationships for experiments they have access to';

-- Log completion
SELECT 'experiment_segments RLS policies and performance optimization completed successfully' AS status; 