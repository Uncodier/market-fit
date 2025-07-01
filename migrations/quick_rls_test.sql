-- QUICK RLS PROBLEMS TEST
-- Fast check to identify tables with potential issues like allowed_domains

-- ============================================================================
-- QUICK SUMMARY: TABLES WITH POTENTIAL ISSUES
-- ============================================================================

-- Show tables with multiple policies (HIGH PRIORITY)
SELECT 
    '🚨 HIGH PRIORITY' as alert_level,
    tablename,
    COUNT(*) as policy_count,
    'Multiple policies may conflict' as issue_type
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC

UNION ALL

-- Show tables with RLS enabled but no policies (MEDIUM PRIORITY)
SELECT 
    '⚠️ MEDIUM PRIORITY' as alert_level,
    c.relname as tablename,
    0 as policy_count,
    'RLS enabled but no policies' as issue_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'r'
AND c.relrowsecurity = true
AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.schemaname = 'public' 
    AND p.tablename = c.relname
)

ORDER BY 
    CASE 
        WHEN alert_level = '🚨 HIGH PRIORITY' THEN 1
        WHEN alert_level = '⚠️ MEDIUM PRIORITY' THEN 2
        ELSE 3
    END,
    policy_count DESC,
    tablename;

-- ============================================================================
-- DETAILED BREAKDOWN: WHICH SPECIFIC TABLES NEED IMMEDIATE ATTENTION
-- ============================================================================

-- Tables with the most policies (likely to have conflicts)
SELECT 
    'TOP_PROBLEMATIC_TABLES' as category,
    tablename,
    COUNT(*) as policy_count,
    string_agg(policyname, ', ') as all_policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) >= 3  -- 3 or more policies is almost certainly problematic
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- TEST QUERY: CHECK IF YOUR CURRENT USER CAN INSERT
-- ============================================================================

-- This will help identify which tables might have INSERT issues like allowed_domains
-- NOTE: Replace 'your-site-id-here' with an actual site_id you own

DO $$
DECLARE
    table_record RECORD;
    test_result TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTING INSERT PERMISSIONS (requires site_id)';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'NOTE: You need to replace site_id values with actual IDs you own';
    RAISE NOTICE '';
    
    -- Loop through tables with site_id column that have multiple policies
    FOR table_record IN
        SELECT DISTINCT p.tablename
        FROM pg_policies p
        WHERE p.schemaname = 'public'
        AND p.tablename IN (
            SELECT tablename 
            FROM pg_policies 
            WHERE schemaname = 'public'
            GROUP BY tablename 
            HAVING COUNT(*) > 1
        )
        AND EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = p.tablename
            AND c.column_name = 'site_id'
        )
        ORDER BY p.tablename
    LOOP
        RAISE NOTICE 'TABLE: % - Test with your site_id', table_record.tablename;
        RAISE NOTICE '  Check permissions with: SELECT current_user, auth.uid();';
        RAISE NOTICE '  Sample test: SELECT * FROM % WHERE site_id = ''your-site-id'';', table_record.tablename;
        RAISE NOTICE '';
    END LOOP;
END $$; 