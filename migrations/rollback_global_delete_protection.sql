-- ============================================================================
-- ROLLBACK SCRIPT - REMOVE GLOBAL DELETE PROTECTION
-- ============================================================================
-- This script completely removes all global delete protection policies
-- and functions that were created by the previous migration.
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧹 CLEANING UP GLOBAL DELETE PROTECTION';
    RAISE NOTICE '=====================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 1: REMOVE ALL GLOBAL DELETE PROTECTION POLICIES
-- ============================================================================

DO $$
DECLARE
    policy_record RECORD;
    policies_removed INTEGER := 0;
BEGIN
    RAISE NOTICE '🗑️  Step 1: Removing DELETE protection policies...';
    RAISE NOTICE '';
    
    -- Loop through all policies with _global_delete_protection suffix
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE policyname LIKE '%_global_delete_protection'
        ORDER BY tablename
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "%s" ON %I.%I', 
                          policy_record.policyname, 
                          policy_record.schemaname, 
                          policy_record.tablename);
            
            RAISE NOTICE '   ✅ Removed: %.% → %', 
                         policy_record.schemaname, 
                         policy_record.tablename, 
                         policy_record.policyname;
            policies_removed := policies_removed + 1;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '   ❌ Failed to remove: %.% → % (Error: %)', 
                         policy_record.schemaname, 
                         policy_record.tablename, 
                         policy_record.policyname,
                         SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Policies removed: %', policies_removed;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 2: REMOVE GLOBAL DELETE PROTECTION FUNCTION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🗑️  Step 2: Removing main function...';
    
    -- Drop the main permission checking function
    DROP FUNCTION IF EXISTS public.user_can_delete_from_site(UUID, UUID);
    DROP FUNCTION IF EXISTS public.user_can_delete_from_site(UUID);
    
    RAISE NOTICE '   ✅ Removed: user_can_delete_from_site()';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 3: REMOVE HELPER FUNCTIONS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🗑️  Step 3: Removing helper functions...';
    
    -- Drop performance analysis function
    DROP FUNCTION IF EXISTS public.analyze_delete_protection_performance();
    RAISE NOTICE '   ✅ Removed: analyze_delete_protection_performance()';
    
    -- Drop maintenance functions
    DROP FUNCTION IF EXISTS public.remove_global_delete_protection();
    RAISE NOTICE '   ✅ Removed: remove_global_delete_protection()';
    
    DROP FUNCTION IF EXISTS public.add_delete_protection_to_table(TEXT, TEXT);
    DROP FUNCTION IF EXISTS public.add_delete_protection_to_table(TEXT);
    RAISE NOTICE '   ✅ Removed: add_delete_protection_to_table()';
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 4: VERIFY CLEANUP
-- ============================================================================

DO $$
DECLARE
    remaining_policies INTEGER;
    remaining_functions INTEGER;
BEGIN
    RAISE NOTICE '🔍 Step 4: Verifying cleanup...';
    RAISE NOTICE '';
    
    -- Check for remaining policies
    SELECT COUNT(*) INTO remaining_policies
    FROM pg_policies 
    WHERE policyname LIKE '%_global_delete_protection';
    
    -- Check for remaining functions
    SELECT COUNT(*) INTO remaining_functions
    FROM pg_proc 
    WHERE proname IN (
        'user_can_delete_from_site',
        'analyze_delete_protection_performance',
        'remove_global_delete_protection',
        'add_delete_protection_to_table'
    );
    
    RAISE NOTICE '📊 Verification Results:';
    RAISE NOTICE '   Remaining policies: %', remaining_policies;
    RAISE NOTICE '   Remaining functions: %', remaining_functions;
    RAISE NOTICE '';
    
    IF remaining_policies = 0 AND remaining_functions = 0 THEN
        RAISE NOTICE '🎉 ✅ CLEANUP SUCCESSFUL!';
        RAISE NOTICE '   • All global delete protection policies removed';
        RAISE NOTICE '   • All related functions removed';
        RAISE NOTICE '   • Database is back to original state';
        RAISE NOTICE '   • No conflicts with existing RLS policies';
    ELSE
        RAISE NOTICE '⚠️  ❌ CLEANUP INCOMPLETE!';
        RAISE NOTICE '   • Some policies or functions may still exist';
        RAISE NOTICE '   • Manual cleanup may be required';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 5: CHECK FOR POLICY CONFLICTS
-- ============================================================================

DO $$
DECLARE
    conflict_record RECORD;
    conflicts_found INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 Step 5: Checking for RLS policy conflicts...';
    RAISE NOTICE '';
    
    -- Check for multiple permissive policies on the same table
    FOR conflict_record IN
        WITH policy_counts AS (
            SELECT 
                schemaname, 
                tablename, 
                cmd,
                COUNT(*) as policy_count
            FROM pg_policies 
            WHERE permissive = 'PERMISSIVE'
            GROUP BY schemaname, tablename, cmd
            HAVING COUNT(*) > 1
        )
        SELECT * FROM policy_counts
        ORDER BY tablename, cmd
        LIMIT 10  -- Show first 10 conflicts
    LOOP
        RAISE NOTICE '   ⚠️  Multiple policies: %.% (% policies for %)', 
                     conflict_record.schemaname,
                     conflict_record.tablename,
                     conflict_record.policy_count,
                     conflict_record.cmd;
        conflicts_found := conflicts_found + 1;
    END LOOP;
    
    IF conflicts_found = 0 THEN
        RAISE NOTICE '   ✅ No policy conflicts detected';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '   ⚠️  % policy conflicts still exist', conflicts_found;
        RAISE NOTICE '   💡 These may be pre-existing issues, not caused by our migration';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 ROLLBACK COMPLETE!';
    RAISE NOTICE '==================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Successfully removed global DELETE protection system';
    RAISE NOTICE '✅ All policies and functions cleaned up';
    RAISE NOTICE '✅ Database restored to original state';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Next steps:';
    RAISE NOTICE '   1. Check Supabase dashboard for any remaining warnings';
    RAISE NOTICE '   2. Consider alternative solution (see new migration)';
    RAISE NOTICE '   3. Test that existing functionality still works';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Ready for new implementation approach!';
    RAISE NOTICE '';
END $$;

-- Show final status
SELECT 
    'ROLLBACK COMPLETE' as status,
    '0 policies remaining' as policies,
    '0 functions remaining' as functions,
    'Ready for new approach' as next_step; 