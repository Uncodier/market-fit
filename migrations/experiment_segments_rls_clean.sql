-- Clean migration for experiment_segments RLS
-- Removes all conflicting policies and creates one working policy

BEGIN;

ALTER TABLE experiment_segments DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "experiment_segments_simple_policy" ON experiment_segments;
DROP POLICY IF EXISTS "experiment_segments_site_access" ON experiment_segments;
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

BEGIN;

ALTER TABLE experiment_segments ENABLE ROW LEVEL SECURITY;

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

SELECT 
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'experiment_segments'; 