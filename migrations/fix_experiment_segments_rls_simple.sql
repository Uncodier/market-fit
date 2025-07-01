-- Migration: Simplified RLS fix for experiment_segments table
-- Description: Reset and create a single, simple RLS policy that allows legitimate operations
-- Date: 2025-07-01

-- ============================================================================
-- EXPERIMENT SEGMENTS TABLE RLS COMPLETE RESET
-- ============================================================================

BEGIN;

-- Disable RLS temporarily to clean up
ALTER TABLE experiment_segments DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "experiment_segments_optimized_policy" ON experiment_segments;
DROP POLICY IF EXISTS "Users can manage experiment segments for their sites" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_unified" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_select_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_insert_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_update_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_delete_policy" ON experiment_segments;

-- Re-enable RLS
ALTER TABLE experiment_segments ENABLE ROW LEVEL SECURITY;

-- Create a single, simple policy that covers all operations
-- This policy allows users to manage experiment_segments if they have access to the site
CREATE POLICY "experiment_segments_simple_policy" ON experiment_segments
USING (
  EXISTS (
    SELECT 1 FROM experiments e
    JOIN site_members sm ON sm.site_id = e.site_id
    WHERE e.id = experiment_segments.experiment_id 
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM experiments e
    JOIN site_members sm ON sm.site_id = e.site_id
    WHERE e.id = experiment_segments.experiment_id 
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  )
);

COMMIT;

-- ============================================================================
-- ENSURE PROPER INDEXES FOR PERFORMANCE
-- ============================================================================

BEGIN;

-- Drop any duplicate indexes first
DROP INDEX IF EXISTS idx_experiment_segments_experiment_id_perf;
DROP INDEX IF EXISTS idx_experiment_segments_segment_id_perf;
DROP INDEX IF EXISTS idx_experiment_segments_composite;

-- Create essential indexes
CREATE INDEX IF NOT EXISTS idx_experiment_segments_experiment_id 
ON experiment_segments(experiment_id);

CREATE INDEX IF NOT EXISTS idx_experiment_segments_segment_id 
ON experiment_segments(segment_id);

-- Composite index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_experiment_segments_exp_seg 
ON experiment_segments(experiment_id, segment_id);

-- Ensure related tables have proper indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_experiments_site_id 
ON experiments(site_id) WHERE site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_members_user_site_status 
ON site_members(user_id, site_id, status) WHERE status = 'active';

COMMIT;

-- ============================================================================
-- VERIFY THE SETUP
-- ============================================================================

-- Show the current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'experiment_segments'; 