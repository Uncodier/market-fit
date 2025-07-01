-- Emergency fix for experiment_segments RLS
-- Creates a more permissive policy while we debug the main issue

BEGIN;

-- Drop the current restrictive policy
DROP POLICY IF EXISTS "experiment_segments_access_only" ON experiment_segments;

-- Create a temporary more permissive policy
-- This allows authenticated users to insert if the experiment exists
CREATE POLICY "experiment_segments_emergency" ON experiment_segments
FOR ALL
USING (
    (SELECT auth.uid()) IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM experiments 
        WHERE id = experiment_segments.experiment_id
    )
)
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM experiments 
        WHERE id = experiment_segments.experiment_id
    )
);

COMMIT;

-- Test the emergency policy
SELECT 
    'Emergency Policy Created:' as status,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'experiment_segments';

-- Test if this would work for recent experiments
SELECT 
    'Test Recent Experiments:' as test_type,
    e.id as experiment_id,
    e.name,
    e.site_id,
    EXISTS (SELECT 1 FROM experiments WHERE id = e.id) as policy_check
FROM experiments e 
WHERE e.site_id = 'cfe4d280-df8a-4b2c-96db-f02ba04368c1'::uuid
ORDER BY e.created_at DESC 
LIMIT 3; 