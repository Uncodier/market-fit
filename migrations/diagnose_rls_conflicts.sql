-- RLS CONFLICTS DIAGNOSTIC SCRIPT
-- Identifies tables with potential RLS policy conflicts that could cause similar issues

-- ============================================================================
-- STEP 1: TABLES WITH MULTIPLE POLICIES (POTENTIAL CONFLICTS)
-- ============================================================================

DO $$
DECLARE
    table_info RECORD;
    policy_count INTEGER;
BEGIN
    RAISE NOTICE '🔍 TABLES WITH MULTIPLE RLS POLICIES (POTENTIAL CONFLICTS)';
    RAISE NOTICE '================================================================';
    
    FOR table_info IN
        SELECT schemaname, tablename, COUNT(*) as policy_count
        FROM pg_policies 
        WHERE schemaname = 'public'
        GROUP BY schemaname, tablename
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC, tablename
    LOOP
        RAISE NOTICE '⚠️  TABLE: % has % policies', 
            table_info.tablename, 
            table_info.policy_count;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 2: DETAILED VIEW OF PROBLEMATIC POLICIES
-- ============================================================================

DO $$
DECLARE
    policy_info RECORD;
    current_table TEXT := '';
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 DETAILED POLICY BREAKDOWN';
    RAISE NOTICE '================================================================';
    
    FOR policy_info IN
        SELECT schemaname, tablename, policyname, cmd, permissive
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename IN (
            SELECT tablename 
            FROM pg_policies 
            WHERE schemaname = 'public'
            GROUP BY tablename 
            HAVING COUNT(*) > 1
        )
        ORDER BY tablename, policyname
    LOOP
        IF current_table != policy_info.tablename THEN
            current_table := policy_info.tablename;
            RAISE NOTICE '';
            RAISE NOTICE '🔧 TABLE: %', current_table;
            RAISE NOTICE '  ┌─────────────────────────────────────────────────────────';
        END IF;
        
        RAISE NOTICE '  │ POLICY: % | CMD: % | PERMISSIVE: %', 
            policy_info.policyname,
            policy_info.cmd,
            policy_info.permissive;
    END LOOP;
    
    IF current_table != '' THEN
        RAISE NOTICE '  └─────────────────────────────────────────────────────────';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: IDENTIFY DUPLICATE/SIMILAR POLICY NAMES
-- ============================================================================

DO $$
DECLARE
    duplicate_info RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔄 POTENTIAL DUPLICATE/SIMILAR POLICIES';
    RAISE NOTICE '================================================================';
    
    -- Look for policies with similar names that might be duplicates
    FOR duplicate_info IN
        SELECT tablename, 
               array_agg(policyname) as similar_policies,
               COUNT(*) as count
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND (
            policyname ILIKE '%optimized%' OR
            policyname ILIKE '%unified%' OR
            policyname ILIKE '%simple%' OR
            policyname ILIKE '%final%' OR
            policyname ILIKE '%access%' OR
            policyname ILIKE '%policy%'
        )
        GROUP BY tablename
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
    LOOP
        RAISE NOTICE '⚠️  TABLE: % has % similar policies:', 
            duplicate_info.tablename, 
            duplicate_info.count;
        RAISE NOTICE '    Policies: %', duplicate_info.similar_policies;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 4: TABLES WITH RLS ENABLED BUT NO POLICIES
-- ============================================================================

DO $$
DECLARE
    orphan_table RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🚨 TABLES WITH RLS ENABLED BUT NO POLICIES';
    RAISE NOTICE '================================================================';
    
    FOR orphan_table IN
        SELECT c.relname as tablename
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
        ORDER BY c.relname
    LOOP
        RAISE NOTICE '❌ TABLE: % (RLS enabled but no policies)', orphan_table.tablename;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 5: PERFORMANCE PROBLEMATIC PATTERNS
-- ============================================================================

DO $$
DECLARE
    perf_issue RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🐌 POTENTIAL PERFORMANCE ISSUES';
    RAISE NOTICE '================================================================';
    
    -- Look for policies that might cause performance issues
    FOR perf_issue IN
        SELECT tablename, policyname, cmd
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND (
            -- Multiple auth.uid() calls
            qual ILIKE '%auth.uid()%auth.uid()%' OR
            -- Nested EXISTS without optimization
            qual ILIKE '%EXISTS%EXISTS%' OR
            -- Missing indexes hint (site_id patterns)
            (qual ILIKE '%site_id%' AND qual ILIKE '%EXISTS%')
        )
        ORDER BY tablename, policyname
    LOOP
        RAISE NOTICE '⚡ TABLE: % | POLICY: % | CMD: % (performance concern)', 
            perf_issue.tablename,
            perf_issue.policyname,
            perf_issue.cmd;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 6: SUMMARY AND RECOMMENDATIONS
-- ============================================================================

DO $$
DECLARE
    total_tables INTEGER;
    problematic_tables INTEGER;
    total_policies INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 SUMMARY';
    RAISE NOTICE '================================================================';
    
    -- Count total tables with RLS
    SELECT COUNT(DISTINCT c.relname) INTO total_tables
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true;
    
    -- Count tables with multiple policies
    SELECT COUNT(DISTINCT tablename) INTO problematic_tables
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename IN (
        SELECT tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
        GROUP BY tablename 
        HAVING COUNT(*) > 1
    );
    
    -- Count total policies
    SELECT COUNT(*) INTO total_policies
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    RAISE NOTICE '📈 Total tables with RLS: %', total_tables;
    RAISE NOTICE '⚠️  Tables with multiple policies: %', problematic_tables;
    RAISE NOTICE '📋 Total RLS policies: %', total_policies;
    RAISE NOTICE '';
    
    IF problematic_tables > 0 THEN
        RAISE NOTICE '🔧 RECOMMENDATIONS:';
        RAISE NOTICE '  1. Review tables with multiple policies for conflicts';
        RAISE NOTICE '  2. Consolidate duplicate/similar policies';
        RAISE NOTICE '  3. Test INSERT/UPDATE operations on flagged tables';
        RAISE NOTICE '  4. Consider using the pattern from fix_allowed_domains_rls.sql';
    ELSE
        RAISE NOTICE '✅ No obvious policy conflicts detected';
    END IF;
END $$;

-- ============================================================================
-- STEP 7: EXPORT PROBLEMATIC TABLES LIST FOR MANUAL REVIEW
-- ============================================================================

SELECT 'TABLES_NEEDING_REVIEW' as category, tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, tablename; 