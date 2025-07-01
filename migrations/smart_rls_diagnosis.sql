-- SMART RLS DIAGNOSIS
-- Identifies REAL problems, not just multiple policies
-- Some tables legitimately need multiple policies (SELECT, INSERT, UPDATE, DELETE)

-- ============================================================================
-- PART 1: IDENTIFY REAL POLICY CONFLICTS (NOT JUST MULTIPLE POLICIES)
-- ============================================================================

DO $$
DECLARE
    table_record RECORD;
    conflict_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 SMART RLS ANALYSIS - REAL CONFLICTS ONLY';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Analyzing policy conflicts vs. legitimate multiple policies...';
    RAISE NOTICE '';
    
    -- Look for REAL conflicts: multiple policies for the SAME operation
    FOR table_record IN
        SELECT 
            tablename,
            cmd,
            COUNT(*) as policy_count,
            string_agg(policyname, ', ') as conflicting_policies
        FROM pg_policies 
        WHERE schemaname = 'public'
        GROUP BY tablename, cmd
        HAVING COUNT(*) > 1  -- Multiple policies for the SAME operation = conflict
        ORDER BY COUNT(*) DESC, tablename, cmd
    LOOP
        conflict_count := conflict_count + 1;
        RAISE NOTICE '🚨 REAL CONFLICT #%: TABLE % has % policies for % operation', 
            conflict_count,
            table_record.tablename, 
            table_record.policy_count,
            table_record.cmd;
        RAISE NOTICE '    Conflicting policies: %', table_record.conflicting_policies;
        RAISE NOTICE '';
    END LOOP;
    
    IF conflict_count = 0 THEN
        RAISE NOTICE '✅ No conflicting policies found for same operations!';
        RAISE NOTICE '    Multiple policies per table are OK if they handle different operations.';
    END IF;
END $$;

-- ============================================================================
-- PART 2: ANALYZE POLICY PATTERNS TO DETECT POTENTIAL ISSUES
-- ============================================================================

DO $$
DECLARE
    problem_record RECORD;
    issue_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔎 ANALYZING POLICY PATTERNS FOR POTENTIAL ISSUES';
    RAISE NOTICE '================================================================';
    
    -- Look for suspicious patterns that often indicate problems
    FOR problem_record IN
        SELECT 
            tablename,
            policyname,
            cmd,
            CASE 
                WHEN policyname ILIKE '%optimized%' AND EXISTS (
                    SELECT 1 FROM pg_policies p2 
                    WHERE p2.tablename = pg_policies.tablename 
                    AND p2.policyname ILIKE '%unified%'
                ) THEN 'Has both optimized and unified policies'
                
                WHEN policyname ILIKE '%final%' AND EXISTS (
                    SELECT 1 FROM pg_policies p2 
                    WHERE p2.tablename = pg_policies.tablename 
                    AND p2.policyname NOT ILIKE '%final%'
                ) THEN 'Has final policy plus other policies'
                
                WHEN policyname ILIKE '%simple%' AND EXISTS (
                    SELECT 1 FROM pg_policies p2 
                    WHERE p2.tablename = pg_policies.tablename 
                    AND p2.policyname ILIKE '%complex%'
                ) THEN 'Has both simple and complex policies'
                
                WHEN qual ILIKE '%auth.uid()%auth.uid()%' THEN 'Multiple auth.uid() calls (performance issue)'
                
                ELSE NULL
            END as issue_type
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND (
            (policyname ILIKE '%optimized%' OR policyname ILIKE '%unified%' OR 
             policyname ILIKE '%final%' OR policyname ILIKE '%simple%') OR
            qual ILIKE '%auth.uid()%auth.uid()%'
        )
    LOOP
        IF problem_record.issue_type IS NOT NULL THEN
            issue_count := issue_count + 1;
            RAISE NOTICE '⚠️  ISSUE #%: TABLE %', issue_count, problem_record.tablename;
            RAISE NOTICE '    Policy: % (%)', problem_record.policyname, problem_record.cmd;
            RAISE NOTICE '    Problem: %', problem_record.issue_type;
            RAISE NOTICE '';
        END IF;
    END LOOP;
    
    IF issue_count = 0 THEN
        RAISE NOTICE '✅ No suspicious policy patterns detected!';
    END IF;
END $$;

-- ============================================================================
-- PART 3: TEST FOR ACTUAL FUNCTIONAL PROBLEMS
-- ============================================================================

DO $$
DECLARE
    test_table RECORD;
    test_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 FUNCTIONAL TESTS - TABLES THAT MIGHT HAVE INSERT/UPDATE ISSUES';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'These tables should be tested manually for INSERT/UPDATE operations:';
    RAISE NOTICE '';
    
    -- Focus on tables that are most likely to have the "allowed_domains" problem
    FOR test_table IN
        SELECT DISTINCT tablename
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename IN (
            -- Tables with multiple policies for same operation (real conflicts)
            SELECT tablename
            FROM pg_policies 
            WHERE schemaname = 'public'
            GROUP BY tablename, cmd
            HAVING COUNT(*) > 1
        )
        AND EXISTS (
            -- Tables with site_id column (similar pattern to allowed_domains)
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = pg_policies.tablename
            AND c.column_name = 'site_id'
        )
        ORDER BY tablename
    LOOP
        test_count := test_count + 1;
        RAISE NOTICE '🔧 TEST TABLE #%: %', test_count, test_table.tablename;
        RAISE NOTICE '    Reason: Has conflicting policies + site_id column';
        RAISE NOTICE '    Test: Try INSERT/UPDATE operations';
        RAISE NOTICE '    Pattern: Similar to allowed_domains issue';
        RAISE NOTICE '';
    END LOOP;
    
    IF test_count = 0 THEN
        RAISE NOTICE '✅ No tables identified as high-risk for INSERT/UPDATE issues!';
    ELSE
        RAISE NOTICE '📋 RECOMMENDATION: Test the % tables above manually', test_count;
        RAISE NOTICE '    If they fail, use the pattern from fix_allowed_domains_rls.sql';
    END IF;
END $$;

-- ============================================================================
-- PART 4: LEGITIMATE MULTIPLE POLICIES (WORKING CORRECTLY)
-- ============================================================================

DO $$
DECLARE
    good_table RECORD;
    good_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ TABLES WITH LEGITIMATE MULTIPLE POLICIES (WORKING CORRECTLY)';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'These tables have multiple policies but are likely working fine:';
    RAISE NOTICE '';
    
    -- Tables with different policies for different operations (SELECT, INSERT, UPDATE, DELETE)
    FOR good_table IN
        SELECT 
            tablename,
            COUNT(DISTINCT cmd) as operation_count,
            COUNT(*) as total_policies,
            string_agg(DISTINCT cmd, ', ') as operations
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename NOT IN (
            -- Exclude tables with conflicts (multiple policies for same operation)
            SELECT tablename
            FROM pg_policies 
            WHERE schemaname = 'public'
            GROUP BY tablename, cmd
            HAVING COUNT(*) > 1
        )
        GROUP BY tablename
        HAVING COUNT(*) > 1  -- Multiple policies but different operations
        ORDER BY COUNT(*) DESC, tablename
    LOOP
        good_count := good_count + 1;
        RAISE NOTICE '✅ GOOD TABLE #%: % (% policies for % operations)', 
            good_count,
            good_table.tablename, 
            good_table.total_policies,
            good_table.operation_count;
        RAISE NOTICE '    Operations: %', good_table.operations;
        RAISE NOTICE '    Status: Different policies for different operations = OK';
        RAISE NOTICE '';
    END LOOP;
    
    IF good_count = 0 THEN
        RAISE NOTICE 'No tables with legitimate multiple policies found.';
    END IF;
END $$;

-- ============================================================================
-- PART 5: SUMMARY AND ACTIONABLE RECOMMENDATIONS
-- ============================================================================

DO $$
DECLARE
    conflict_tables INTEGER;
    pattern_issues INTEGER;
    test_needed INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 SMART DIAGNOSIS SUMMARY';
    RAISE NOTICE '================================================================';
    
    -- Count real conflicts
    SELECT COUNT(DISTINCT tablename) INTO conflict_tables
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename IN (
        SELECT tablename
        FROM pg_policies 
        WHERE schemaname = 'public'
        GROUP BY tablename, cmd
        HAVING COUNT(*) > 1
    );
    
    -- Count pattern issues
    SELECT COUNT(DISTINCT tablename) INTO pattern_issues
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND (
        qual ILIKE '%auth.uid()%auth.uid()%' OR
        (policyname ILIKE '%final%' AND EXISTS (
            SELECT 1 FROM pg_policies p2 
            WHERE p2.tablename = pg_policies.tablename 
            AND p2.policyname NOT ILIKE '%final%'
        ))
    );
    
    -- Count tables needing manual testing
    SELECT COUNT(DISTINCT tablename) INTO test_needed
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename IN (
        SELECT tablename
        FROM pg_policies 
        WHERE schemaname = 'public'
        GROUP BY tablename, cmd
        HAVING COUNT(*) > 1
    )
    AND EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        AND c.table_name = pg_policies.tablename
        AND c.column_name = 'site_id'
    );
    
    RAISE NOTICE '🚨 Real conflicts (multiple policies same operation): %', conflict_tables;
    RAISE NOTICE '⚠️  Pattern issues (performance/logic problems): %', pattern_issues;
    RAISE NOTICE '🧪 Tables needing manual testing: %', test_needed;
    RAISE NOTICE '';
    
    IF conflict_tables > 0 OR pattern_issues > 0 OR test_needed > 0 THEN
        RAISE NOTICE '🔧 ACTION REQUIRED:';
        IF conflict_tables > 0 THEN
            RAISE NOTICE '  1. Fix tables with real conflicts (same operation, multiple policies)';
        END IF;
        IF pattern_issues > 0 THEN
            RAISE NOTICE '  2. Optimize tables with performance/logic issues';
        END IF;
        IF test_needed > 0 THEN
            RAISE NOTICE '  3. Manually test INSERT/UPDATE operations on flagged tables';
        END IF;
    ELSE
        RAISE NOTICE '🎉 ALL CLEAR! Your RLS policies look good.';
        RAISE NOTICE '    Multiple policies per table are fine when they handle different operations.';
    END IF;
END $$; 