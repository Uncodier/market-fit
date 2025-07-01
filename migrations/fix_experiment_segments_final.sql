-- Repair script for experiment_segments
-- Fixes RLS disabled issue and removes duplicate indexes

BEGIN;

-- Fix: Enable RLS (it was disabled but policy exists)
ALTER TABLE experiment_segments ENABLE ROW LEVEL SECURITY;

-- Fix: Remove duplicate index
DROP INDEX IF EXISTS idx_experiment_segments_experiment_id_final;

-- Keep the original index
-- idx_experiment_segments_experiment_id should remain

COMMIT;

-- Verify the fix
SELECT 
    'RLS Status:' as check_type,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
FROM pg_class c 
WHERE c.relname = 'experiment_segments';

SELECT 
    'Policies:' as check_type,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'experiment_segments';

SELECT 
    'Indexes:' as check_type,
    indexname
FROM pg_indexes 
WHERE tablename = 'experiment_segments' 
    AND indexname LIKE '%experiment_id%'; 