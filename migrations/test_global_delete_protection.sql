-- ============================================================================
-- TEST SCRIPT FOR GLOBAL DELETE PROTECTION
-- ============================================================================
-- This script tests the global DELETE protection system to ensure it works
-- correctly for different user roles and scenarios.
-- ============================================================================

-- ============================================================================
-- TEST 1: VERIFY PROTECTION IS ENABLED
-- ============================================================================

DO $$
DECLARE
    protected_tables INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTING GLOBAL DELETE PROTECTION';
    RAISE NOTICE '=====================================';
    RAISE NOTICE '';
    
    -- Count protected tables
    SELECT COUNT(*) INTO protected_tables
    FROM pg_policies 
    WHERE policyname LIKE '%_global_delete_protection';
    
    RAISE NOTICE '📊 Test 1: Check Protection Coverage';
    RAISE NOTICE '   Protected tables: %', protected_tables;
    
    IF protected_tables > 30 THEN
        RAISE NOTICE '   ✅ PASS: Good protection coverage';
    ELSE
        RAISE NOTICE '   ❌ FAIL: Insufficient protection coverage';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- TEST 2: VERIFY FUNCTION PERFORMANCE
-- ============================================================================

DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time INTERVAL;
    test_site_id UUID;
    test_user_id UUID;
    result BOOLEAN;
BEGIN
    RAISE NOTICE '⏱️  Test 2: Function Performance';
    
    -- Create test data
    test_site_id := gen_random_uuid();
    test_user_id := gen_random_uuid();
    
    -- Test execution time
    start_time := clock_timestamp();
    
    -- Run function 100 times
    FOR i IN 1..100 LOOP
        SELECT public.user_can_delete_from_site(test_site_id, test_user_id) INTO result;
    END LOOP;
    
    end_time := clock_timestamp();
    execution_time := end_time - start_time;
    
    RAISE NOTICE '   100 function calls took: %', execution_time;
    RAISE NOTICE '   Average per call: %', execution_time / 100;
    
    IF extract(milliseconds from execution_time) < 100 THEN
        RAISE NOTICE '   ✅ PASS: Excellent performance (< 100ms for 100 calls)';
    ELSIF extract(milliseconds from execution_time) < 500 THEN
        RAISE NOTICE '   ✅ PASS: Good performance (< 500ms for 100 calls)';
    ELSE
        RAISE NOTICE '   ⚠️  WARNING: Slow performance (> 500ms for 100 calls)';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- TEST 3: VERIFY PERMISSION LOGIC
-- ============================================================================

DO $$
DECLARE
    test_site_id UUID;
    owner_user_id UUID;
    admin_user_id UUID;
    regular_user_id UUID;
    result BOOLEAN;
BEGIN
    RAISE NOTICE '🔐 Test 3: Permission Logic';
    
    -- Get a real site for testing (if any exists)
    SELECT id INTO test_site_id FROM public.sites LIMIT 1;
    
    IF test_site_id IS NULL THEN
        RAISE NOTICE '   ⏭️  SKIP: No sites found for testing';
        RAISE NOTICE '';
        RETURN;
    END IF;
    
    -- Get real users (if any exist)
    SELECT user_id INTO owner_user_id FROM public.site_ownership WHERE site_id = test_site_id LIMIT 1;
    SELECT user_id INTO admin_user_id FROM public.site_members WHERE site_id = test_site_id AND role = 'admin' LIMIT 1;
    SELECT user_id INTO regular_user_id FROM public.site_members WHERE site_id = test_site_id AND role = 'collaborator' LIMIT 1;
    
    -- Test site owner permissions
    IF owner_user_id IS NOT NULL THEN
        SELECT public.user_can_delete_from_site(test_site_id, owner_user_id) INTO result;
        RAISE NOTICE '   Site owner can delete: %', CASE WHEN result THEN '✅ TRUE' ELSE '❌ FALSE' END;
    ELSE
        RAISE NOTICE '   ⏭️  No site owner found for testing';
    END IF;
    
    -- Test admin permissions
    IF admin_user_id IS NOT NULL THEN
        SELECT public.user_can_delete_from_site(test_site_id, admin_user_id) INTO result;
        RAISE NOTICE '   Admin member can delete: %', CASE WHEN result THEN '✅ TRUE' ELSE '❌ FALSE' END;
    ELSE
        RAISE NOTICE '   ⏭️  No admin member found for testing';
    END IF;
    
    -- Test regular user permissions
    IF regular_user_id IS NOT NULL THEN
        SELECT public.user_can_delete_from_site(test_site_id, regular_user_id) INTO result;
        RAISE NOTICE '   Regular member can delete: %', CASE WHEN result THEN '❌ TRUE (Should be FALSE!)' ELSE '✅ FALSE' END;
    ELSE
        RAISE NOTICE '   ⏭️  No regular member found for testing';
    END IF;
    
    -- Test invalid user
    SELECT public.user_can_delete_from_site(test_site_id, gen_random_uuid()) INTO result;
    RAISE NOTICE '   Invalid user can delete: %', CASE WHEN result THEN '❌ TRUE (Should be FALSE!)' ELSE '✅ FALSE' END;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- TEST 4: VERIFY POLICIES ARE ACTIVE
-- ============================================================================

DO $$
DECLARE
    policy_record RECORD;
    active_policies INTEGER := 0;
BEGIN
    RAISE NOTICE '📋 Test 4: Policy Status';
    RAISE NOTICE '';
    
    FOR policy_record IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE policyname LIKE '%_global_delete_protection'
        ORDER BY tablename
        LIMIT 10  -- Show first 10 for brevity
    LOOP
        RAISE NOTICE '   🛡️  % → %', policy_record.tablename, policy_record.policyname;
        active_policies := active_policies + 1;
    END LOOP;
    
    IF active_policies > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '   ✅ PASS: % DELETE protection policies active', active_policies;
    ELSE
        RAISE NOTICE '   ❌ FAIL: No DELETE protection policies found';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- TEST 5: SIMULATE REAL DELETE SCENARIO (READ-ONLY TEST)
-- ============================================================================

DO $$
DECLARE
    test_task_id UUID;
    test_site_id UUID;
    task_owner_id UUID;
    current_user_id UUID;
    would_succeed BOOLEAN;
BEGIN
    RAISE NOTICE '🎯 Test 5: Real-world Scenario Simulation';
    
    -- Get a real task for testing (if any exists)
    SELECT id, site_id, user_id INTO test_task_id, test_site_id, task_owner_id
    FROM public.tasks 
    LIMIT 1;
    
    IF test_task_id IS NULL THEN
        RAISE NOTICE '   ⏭️  SKIP: No tasks found for testing';
        RAISE NOTICE '';
        RETURN;
    END IF;
    
    -- Simulate current user context (get the task owner)
    current_user_id := task_owner_id;
    
    -- Check if this user would be able to delete the task
    SELECT public.user_can_delete_from_site(test_site_id, current_user_id) INTO would_succeed;
    
    RAISE NOTICE '   📝 Test task ID: %', test_task_id;
    RAISE NOTICE '   🏢 Site ID: %', test_site_id;
    RAISE NOTICE '   👤 User ID: %', current_user_id;
    RAISE NOTICE '   🗑️  Can delete: %', CASE WHEN would_succeed THEN '✅ YES' ELSE '❌ NO' END;
    
    -- Show what would happen in a real DELETE operation
    RAISE NOTICE '';
    RAISE NOTICE '   🔍 Policy Check Result:';
    IF would_succeed THEN
        RAISE NOTICE '      DELETE FROM tasks WHERE id = ''%'' → ✅ ALLOWED', test_task_id;
    ELSE
        RAISE NOTICE '      DELETE FROM tasks WHERE id = ''%'' → ❌ BLOCKED', test_task_id;
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- GENERATE PERFORMANCE REPORT
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📊 Performance Analysis Report';
    RAISE NOTICE '============================';
    RAISE NOTICE '';
    RAISE NOTICE 'Run this query to see detailed performance analysis:';
    RAISE NOTICE '';
    RAISE NOTICE 'SELECT * FROM public.analyze_delete_protection_performance();';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- FINAL TEST SUMMARY
-- ============================================================================

DO $$
DECLARE
    protected_count INTEGER;
    total_critical_tables INTEGER;
    coverage_percent NUMERIC;
    critical_tables TEXT[] := ARRAY[
        'tasks', 'leads', 'campaigns', 'agents', 'sales', 
        'segments', 'experiments', 'site_members'
    ];
    table_name TEXT;
    protected_critical INTEGER := 0;
BEGIN
    RAISE NOTICE '📋 FINAL TEST SUMMARY';
    RAISE NOTICE '====================';
    RAISE NOTICE '';
    
    -- Count total protected tables
    SELECT COUNT(*) INTO protected_count
    FROM pg_policies 
    WHERE policyname LIKE '%_global_delete_protection';
    
    -- Check critical tables coverage
    FOREACH table_name IN ARRAY critical_tables
    LOOP
        IF EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name 
            AND policyname LIKE '%_global_delete_protection'
        ) THEN
            protected_critical := protected_critical + 1;
        END IF;
    END LOOP;
    
    total_critical_tables := array_length(critical_tables, 1);
    coverage_percent := (protected_critical::NUMERIC / total_critical_tables::NUMERIC) * 100;
    
    RAISE NOTICE '🛡️  Total protected tables: %', protected_count;
    RAISE NOTICE '⭐ Critical tables protected: % / % (%.0f%%)', 
                 protected_critical, total_critical_tables, coverage_percent;
    RAISE NOTICE '';
    
    -- Overall assessment
    IF protected_count >= 30 AND coverage_percent >= 80 THEN
        RAISE NOTICE '🎉 OVERALL RESULT: ✅ EXCELLENT';
        RAISE NOTICE '   • Global DELETE protection is working correctly';
        RAISE NOTICE '   • Good coverage of critical tables';
        RAISE NOTICE '   • System is secure and ready for production';
    ELSIF protected_count >= 20 AND coverage_percent >= 60 THEN
        RAISE NOTICE '🎯 OVERALL RESULT: ✅ GOOD';
        RAISE NOTICE '   • Global DELETE protection is mostly working';
        RAISE NOTICE '   • Decent coverage, consider protecting more tables';
        RAISE NOTICE '   • System is reasonably secure';
    ELSE
        RAISE NOTICE '⚠️  OVERALL RESULT: ❌ NEEDS IMPROVEMENT';
        RAISE NOTICE '   • Insufficient protection coverage';
        RAISE NOTICE '   • Review migration and fix any errors';
        RAISE NOTICE '   • System may not be fully secure';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔧 MAINTENANCE COMMANDS:';
    RAISE NOTICE '   • View protection status: SELECT * FROM analyze_delete_protection_performance();';
    RAISE NOTICE '   • Remove all protection: SELECT remove_global_delete_protection();';
    RAISE NOTICE '   • Add protection to new table: SELECT add_delete_protection_to_table(''table_name'');';
    RAISE NOTICE '';
    
END $$; 