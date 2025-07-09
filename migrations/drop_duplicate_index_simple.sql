-- ============================================================================
-- SIMPLE FIX: DROP DUPLICATE INDEX
-- ============================================================================
-- Direct fix for duplicate index warning on tasks table
-- ============================================================================

-- Show current indexes before
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'tasks' 
AND schemaname = 'public' 
AND indexname IN ('idx_tasks_serial_id_site', 'idx_tasks_serial_id_site_unique')
ORDER BY indexname;

-- Drop the non-unique duplicate index
-- Keep the unique one for data integrity
DROP INDEX IF EXISTS public.idx_tasks_serial_id_site;

-- Verify only the unique index remains
SELECT 
    'AFTER DROP' as status,
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'tasks' 
AND schemaname = 'public' 
AND indexname IN ('idx_tasks_serial_id_site', 'idx_tasks_serial_id_site_unique')
ORDER BY indexname;

-- Final confirmation
SELECT 
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ SUCCESS: Only unique index remains'
        WHEN COUNT(*) = 0 THEN '❌ ERROR: No indexes found'
        ELSE '⚠️ WARNING: Still have duplicates'
    END as result,
    COUNT(*) as remaining_indexes
FROM pg_indexes 
WHERE tablename = 'tasks' 
AND schemaname = 'public' 
AND indexname IN ('idx_tasks_serial_id_site', 'idx_tasks_serial_id_site_unique'); 