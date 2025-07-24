-- VALIDATION SCRIPT: Check site_members table and prevent_last_admin_role_change function status
-- This script diagnoses the current state of the database to understand what's missing
-- Date: 2025-01-24
-- Run this BEFORE executing any migrations

-- ============================================================================
-- STEP 1: CHECK TABLE EXISTENCE
-- ============================================================================

DO $$
DECLARE
    table_exists BOOLEAN;
    table_info RECORD;
    column_count INTEGER;
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔍 CHECKING site_members TABLE STATUS';
    RAISE NOTICE '==========================================';
    
    -- Check if site_members table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'site_members'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ site_members table: EXISTS';
        
        -- Get table details
        SELECT COUNT(*) INTO column_count
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'site_members';
        
        RAISE NOTICE '📊 Columns in site_members: %', column_count;
        
        -- List all columns
        FOR table_info IN 
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'site_members'
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '   - %: % (nullable: %)', table_info.column_name, table_info.data_type, table_info.is_nullable;
        END LOOP;
        
        -- Check if RLS is enabled
        SELECT rls.rowsecurity INTO table_info
        FROM pg_class rls
        JOIN pg_namespace n ON n.oid = rls.relnamespace
        WHERE n.nspname = 'public' AND rls.relname = 'site_members';
        
        RAISE NOTICE '🔒 RLS enabled: %', CASE WHEN table_info.rowsecurity THEN 'YES' ELSE 'NO' END;
        
    ELSE
        RAISE NOTICE '❌ site_members table: DOES NOT EXIST';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: CHECK FUNCTION EXISTENCE
-- ============================================================================

DO $$
DECLARE
    function_exists BOOLEAN;
    function_info RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔍 CHECKING FUNCTIONS STATUS';
    RAISE NOTICE '==========================================';
    
    -- Check prevent_last_admin_role_change function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'prevent_last_admin_role_change'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ prevent_last_admin_role_change function: EXISTS';
        
        -- Get function details
        SELECT routine_type, security_type, routine_definition
        INTO function_info
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'prevent_last_admin_role_change';
        
        RAISE NOTICE '📝 Function type: %', function_info.routine_type;
        RAISE NOTICE '🔐 Security: %', function_info.security_type;
        
    ELSE
        RAISE NOTICE '❌ prevent_last_admin_role_change function: DOES NOT EXIST';
    END IF;
    
    -- Check prevent_last_admin_deletion function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'prevent_last_admin_deletion'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ prevent_last_admin_deletion function: EXISTS';
    ELSE
        RAISE NOTICE '❌ prevent_last_admin_deletion function: DOES NOT EXIST';
    END IF;
    
END $$;

-- ============================================================================
-- STEP 3: CHECK TRIGGERS EXISTENCE
-- ============================================================================

DO $$
DECLARE
    trigger_exists BOOLEAN;
    trigger_info RECORD;
    trigger_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔍 CHECKING TRIGGERS STATUS';
    RAISE NOTICE '==========================================';
    
    -- Check role change trigger
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_schema = 'public' 
        AND trigger_name = 'prevent_last_admin_role_change_trigger'
    ) INTO trigger_exists;
    
    IF trigger_exists THEN
        RAISE NOTICE '✅ prevent_last_admin_role_change_trigger: EXISTS';
        trigger_count := trigger_count + 1;
    ELSE
        RAISE NOTICE '❌ prevent_last_admin_role_change_trigger: DOES NOT EXIST';
    END IF;
    
    -- Check deletion trigger
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_schema = 'public' 
        AND trigger_name = 'prevent_last_admin_deletion_trigger'
    ) INTO trigger_exists;
    
    IF trigger_exists THEN
        RAISE NOTICE '✅ prevent_last_admin_deletion_trigger: EXISTS';
        trigger_count := trigger_count + 1;
    ELSE
        RAISE NOTICE '❌ prevent_last_admin_deletion_trigger: DOES NOT EXIST';
    END IF;
    
    -- List all triggers on site_members table
    RAISE NOTICE '';
    RAISE NOTICE '📋 All triggers on site_members table:';
    
    FOR trigger_info IN 
        SELECT trigger_name, event_manipulation, action_timing
        FROM information_schema.triggers 
        WHERE event_object_schema = 'public' 
        AND event_object_table = 'site_members'
        ORDER BY trigger_name
    LOOP
        RAISE NOTICE '   - %: % %', trigger_info.trigger_name, trigger_info.action_timing, trigger_info.event_manipulation;
    END LOOP;
    
    -- If no triggers found
    IF NOT FOUND THEN
        RAISE NOTICE '   (No triggers found on site_members table)';
    END IF;
    
END $$;

-- ============================================================================
-- STEP 4: CHECK RLS POLICIES
-- ============================================================================

DO $$
DECLARE
    policy_info RECORD;
    policy_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔍 CHECKING RLS POLICIES STATUS';
    RAISE NOTICE '==========================================';
    
    -- List all policies on site_members table
    FOR policy_info IN 
        SELECT policyname, cmd, permissive, qual
        FROM pg_policies 
        WHERE tablename = 'site_members'
        ORDER BY policyname
    LOOP
        RAISE NOTICE '✅ Policy: % (%, %)', policy_info.policyname, policy_info.cmd, CASE WHEN policy_info.permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;
        policy_count := policy_count + 1;
    END LOOP;
    
    IF policy_count = 0 THEN
        RAISE NOTICE '❌ No RLS policies found on site_members table';
    ELSE
        RAISE NOTICE '📊 Total policies on site_members: %', policy_count;
    END IF;
    
END $$;

-- ============================================================================
-- STEP 5: TEST QUERY TO REPRODUCE ERROR
-- ============================================================================

DO $$
DECLARE
    test_result TEXT;
    error_occurred BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🧪 TESTING QUERY THAT CAUSES ERROR';
    RAISE NOTICE '==========================================';
    
    -- Try to execute a query similar to the one that's failing
    BEGIN
        -- This simulates the query that's failing in the function
        EXECUTE 'SELECT COUNT(*) FROM public.site_members WHERE site_id = $1 AND role IN (''admin'', ''owner'') AND id != $2'
        USING '00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000001'::uuid;
        
        RAISE NOTICE '✅ Query executed successfully - site_members table is accessible';
        
    EXCEPTION 
        WHEN undefined_table THEN
            RAISE NOTICE '❌ ERROR: relation "site_members" does not exist';
            error_occurred := TRUE;
        WHEN OTHERS THEN
            RAISE NOTICE '❌ ERROR: %', SQLERRM;
            error_occurred := TRUE;
    END;
    
    IF NOT error_occurred THEN
        RAISE NOTICE '✅ No errors detected in site_members access';
    END IF;
    
END $$;

-- ============================================================================
-- STEP 6: FINAL SUMMARY AND RECOMMENDATIONS
-- ============================================================================

DO $$
DECLARE
    table_exists BOOLEAN;
    function_exists BOOLEAN;
    role_trigger_exists BOOLEAN;
    delete_trigger_exists BOOLEAN;
    recommendation TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '📋 FINAL SUMMARY & RECOMMENDATIONS';
    RAISE NOTICE '==========================================';
    
    -- Check current status
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'site_members'
    ) INTO table_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' AND routine_name = 'prevent_last_admin_role_change'
    ) INTO function_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_schema = 'public' AND trigger_name = 'prevent_last_admin_role_change_trigger'
    ) INTO role_trigger_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_schema = 'public' AND trigger_name = 'prevent_last_admin_deletion_trigger'
    ) INTO delete_trigger_exists;
    
    -- Provide recommendations
    IF table_exists AND function_exists AND role_trigger_exists AND delete_trigger_exists THEN
        recommendation := '🎉 Everything appears to be in place. The error might be a permissions issue.';
    ELSIF table_exists AND NOT function_exists THEN
        recommendation := '🔧 Run create_missing_prevent_last_admin_function.sql to create missing functions.';
    ELSIF NOT table_exists THEN
        recommendation := '🚨 site_members table is missing. Check if you''re connected to the right database.';
    ELSE
        recommendation := '🔧 Some components are missing. Run create_missing_prevent_last_admin_function.sql.';
    END IF;
    
    RAISE NOTICE 'Status:';
    RAISE NOTICE '  📦 Table site_members: %', CASE WHEN table_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE '  ⚙️  Function prevent_last_admin_role_change: %', CASE WHEN function_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE '  🎯 Role change trigger: %', CASE WHEN role_trigger_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE '  🛡️  Delete protection trigger: %', CASE WHEN delete_trigger_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE '';
    RAISE NOTICE 'Recommendation: %', recommendation;
    RAISE NOTICE '==========================================';
    
END $$; 