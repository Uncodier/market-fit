-- Final clean migration for experiment_segments RLS
-- This removes ALL conflicting policies and creates ONE working policy
-- Date: 2025-07-01

-- ============================================================================
-- STEP 1: REMOVE ALL EXISTING POLICIES (WE SAW 2 ACTIVE POLICIES)
-- ============================================================================

BEGIN;

-- Disable RLS completely first
ALTER TABLE experiment_segments DISABLE ROW LEVEL SECURITY;

-- Remove the two policies we saw in the output
DROP POLICY IF EXISTS "experiment_segments_simple_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_site_access" ON experiment_segments;

-- Remove any other possible policies from previous attempts
DROP POLICY IF EXISTS "experiment_segments_optimized_policy" ON experiment_segments;
DROP POLICY IF EXISTS "Users can manage experiment segments for their sites" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_unified" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_select_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_insert_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_update_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_delete_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_permissive" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_access" ON experiment_segments;

COMMIT;

-- ============================================================================
-- STEP 2: CREATE ONE SINGLE, WORKING POLICY
-- ============================================================================

BEGIN;

-- Re-enable RLS
ALTER TABLE experiment_segments ENABLE ROW LEVEL SECURITY;

-- Create ONE single policy that allows authenticated users to manage
-- experiment_segments if they have active membership to the site
CREATE POLICY "experiment_segments_access_only" ON experiment_segments
FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 
        FROM experiments e
        JOIN site_members sm ON sm.site_id = e.site_id
        WHERE e.id = experiment_segments.experiment_id 
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 
        FROM experiments e
        JOIN site_members sm ON sm.site_id = e.site_id
        WHERE e.id = experiment_segments.experiment_id 
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
    )
);

COMMIT;

-- ============================================================================
-- STEP 3: VERIFY ONLY ONE POLICY EXISTS
-- ============================================================================

-- This should return exactly ONE row
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'experiment_segments'
ORDER BY policyname;

-- ============================================================================
-- STEP 4: ENSURE PROPER INDEXES FOR PERFORMANCE
-- ============================================================================

BEGIN;

-- Create indexes to make the policy fast
CREATE INDEX IF NOT EXISTS idx_experiment_segments_experiment_id_final 
ON experiment_segments(experiment_id);

CREATE INDEX IF NOT EXISTS idx_experiments_id_site_id 
ON experiments(id, site_id);

CREATE INDEX IF NOT EXISTS idx_site_members_site_user_status 
ON site_members(site_id, user_id, status) 
WHERE status = 'active';

COMMIT;

-- Show final verification
SELECT 
    'SUCCESS: Only one policy should be shown below' as status;

SELECT 
    policyname,
    cmd,
    'Policy exists and active' as verification
FROM pg_policies 
WHERE tablename = 'experiment_segments'; 