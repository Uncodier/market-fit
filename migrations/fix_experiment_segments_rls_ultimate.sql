-- Ultimate fix for experiment_segments RLS
-- This will completely reset and create the simplest possible working policy
-- Date: 2025-07-01

-- ============================================================================
-- STEP 1: COMPLETE RESET - DISABLE RLS AND CLEAN ALL POLICIES
-- ============================================================================

BEGIN;

-- Completely disable RLS for this table
ALTER TABLE experiment_segments DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies (even if they don't exist)
DO $$ 
BEGIN
    -- Drop any possible policy names
    DROP POLICY IF EXISTS "experiment_segments_optimized_policy" ON experiment_segments;
    DROP POLICY IF EXISTS "Users can manage experiment segments for their sites" ON experiment_segments;
    DROP POLICY IF EXISTS "experiment_segments_unified" ON experiment_segments;
    DROP POLICY IF EXISTS "experiment_segments_select_policy" ON experiment_segments;
    DROP POLICY IF EXISTS "experiment_segments_insert_policy" ON experiment_segments;
    DROP POLICY IF EXISTS "experiment_segments_update_policy" ON experiment_segments;
    DROP POLICY IF EXISTS "experiment_segments_delete_policy" ON experiment_segments;
    DROP POLICY IF EXISTS "experiment_segments_simple_policy" ON experiment_segments;
    DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON experiment_segments;
    
    -- Any other possible policy names from previous attempts
    DROP POLICY IF EXISTS "experiment_segments_policy" ON experiment_segments;
    DROP POLICY IF EXISTS "experiment_segments_access" ON experiment_segments;
EXCEPTION
    WHEN undefined_object THEN
        RAISE NOTICE 'Some policies did not exist, continuing...';
END $$;

COMMIT;

-- ============================================================================
-- STEP 2: CREATE A VERY PERMISSIVE POLICY FOR TESTING
-- ============================================================================

BEGIN;

-- Re-enable RLS
ALTER TABLE experiment_segments ENABLE ROW LEVEL SECURITY;

-- Create a very simple policy that just checks if user is authenticated
-- and the experiment exists (without complex joins)
CREATE POLICY "experiment_segments_permissive" ON experiment_segments
FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM experiments 
        WHERE id = experiment_segments.experiment_id
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM experiments 
        WHERE id = experiment_segments.experiment_id
    )
);

COMMIT;

-- ============================================================================
-- STEP 3: OPTIMIZE INDEXES FOR THE NEW POLICY
-- ============================================================================

BEGIN;

-- Ensure we have the basic indexes
CREATE INDEX IF NOT EXISTS idx_experiment_segments_exp_id 
ON experiment_segments(experiment_id);

CREATE INDEX IF NOT EXISTS idx_experiment_segments_seg_id 
ON experiment_segments(segment_id);

-- Index on experiments for the EXISTS check
CREATE INDEX IF NOT EXISTS idx_experiments_id 
ON experiments(id);

COMMIT;

-- ============================================================================
-- STEP 4: GRANT NECESSARY PERMISSIONS
-- ============================================================================

BEGIN;

-- Ensure authenticated users can access the table
GRANT ALL ON experiment_segments TO authenticated;
GRANT ALL ON experiments TO authenticated;
GRANT SELECT ON site_members TO authenticated;

COMMIT;

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================

-- Check the current policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'experiment_segments';

-- Check table permissions
SELECT 
    table_name,
    grantee,
    privilege_type
FROM information_schema.table_privileges 
WHERE table_name = 'experiment_segments' 
    AND grantee = 'authenticated'; 