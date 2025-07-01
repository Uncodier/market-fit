-- Optimize experiment_segments RLS policy for better performance
-- Fixes the auth RLS initialization plan warning

BEGIN;

-- Drop the current policy
DROP POLICY IF EXISTS "experiment_segments_access_only" ON experiment_segments;

-- Create the optimized policy using (select auth.uid()) instead of auth.uid()
-- This prevents re-evaluation of auth.uid() for each row
CREATE POLICY "experiment_segments_access_only" ON experiment_segments
FOR ALL
USING (
    (SELECT auth.uid()) IS NOT NULL 
    AND EXISTS (
        SELECT 1 
        FROM experiments e
        JOIN site_members sm ON sm.site_id = e.site_id
        WHERE e.id = experiment_segments.experiment_id 
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
    )
)
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL 
    AND EXISTS (
        SELECT 1 
        FROM experiments e
        JOIN site_members sm ON sm.site_id = e.site_id
        WHERE e.id = experiment_segments.experiment_id 
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
    )
);

COMMIT;

-- Verify the optimization
SELECT 
    'Optimized Policy:' as status,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'experiment_segments'; 