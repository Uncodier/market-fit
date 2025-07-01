-- Migration: Final fix for experiment_segments RLS policy violation
-- Description: Simplify RLS policies to prevent violations while maintaining security
-- Date: 2025-01-30

-- ============================================================================
-- EXPERIMENT SEGMENTS TABLE RLS FINAL FIX
-- ============================================================================

BEGIN;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "experiment_segments_select_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_insert_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_update_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_delete_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_optimized_policy" ON experiment_segments;
DROP POLICY IF EXISTS "Users can manage experiment segments for their sites" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_unified" ON experiment_segments;

-- Create a single, simplified policy that works reliably
-- This policy checks if the user has access to the experiment's site
CREATE POLICY "experiment_segments_site_access" ON experiment_segments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM experiments e
    WHERE e.id = experiment_segments.experiment_id 
    AND EXISTS (
      SELECT 1 FROM site_members sm 
      WHERE sm.site_id = e.site_id 
      AND sm.user_id = (SELECT auth.uid())
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM experiments e
    WHERE e.id = experiment_segments.experiment_id 
    AND EXISTS (
      SELECT 1 FROM site_members sm 
      WHERE sm.site_id = e.site_id 
      AND sm.user_id = (SELECT auth.uid())
    )
  )
);

COMMIT;

-- ============================================================================
-- VERIFY POLICY FUNCTIONALITY
-- ============================================================================

-- Test the policy by checking if it allows access to expected records
-- This should be run after the migration to verify functionality

DO $$
BEGIN
  -- Check if the policy exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'experiment_segments' 
    AND policyname = 'experiment_segments_site_access'
  ) THEN
    RAISE NOTICE 'experiment_segments_site_access policy created successfully';
  ELSE
    RAISE EXCEPTION 'experiment_segments_site_access policy was not created';
  END IF;
END $$;

-- ============================================================================
-- ADD PERFORMANCE INDEXES IF MISSING
-- ============================================================================

-- Ensure we have the essential indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_experiment_segments_experiment_lookup 
ON experiment_segments(experiment_id);

CREATE INDEX IF NOT EXISTS idx_experiments_site_lookup 
ON experiments(site_id);

CREATE INDEX IF NOT EXISTS idx_site_members_user_site_lookup 
ON site_members(user_id, site_id);

-- ============================================================================
-- FINAL VERIFICATION AND CLEANUP
-- ============================================================================

-- Verify that RLS is enabled
DO $$
BEGIN
  IF (
    SELECT relrowsecurity 
    FROM pg_class 
    WHERE relname = 'experiment_segments' 
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE 'RLS is properly enabled on experiment_segments table';
  ELSE
    RAISE EXCEPTION 'RLS is not enabled on experiment_segments table';
  END IF;
END $$;

-- Update table statistics for optimal query planning
ANALYZE experiment_segments;
ANALYZE experiments;
ANALYZE site_members;

-- Log completion
SELECT 'experiment_segments RLS final fix completed successfully' AS status; 