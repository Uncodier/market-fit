-- DIAGNOSTIC SCRIPT: Current State Analysis
-- This script will show us exactly what's happening with RLS and policies

DO $$
BEGIN
    RAISE NOTICE '🔍 DIAGNOSTIC: Analyzing current database state...';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 1: Check RLS Status
-- ============================================================================

DO $$
DECLARE
    sites_rls BOOLEAN;
    members_rls BOOLEAN;
BEGIN
    RAISE NOTICE '📋 STEP 1: Checking RLS Status';
    RAISE NOTICE '----------------------------';
    
    -- Check RLS status for sites
    SELECT relrowsecurity INTO sites_rls 
    FROM pg_class 
    WHERE relname = 'sites' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    
    -- Check RLS status for site_members
    SELECT relrowsecurity INTO members_rls 
    FROM pg_class 
    WHERE relname = 'site_members' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    
    RAISE NOTICE 'Sites RLS enabled: %', COALESCE(sites_rls::text, 'NOT FOUND');
    RAISE NOTICE 'Site_members RLS enabled: %', COALESCE(members_rls::text, 'NOT FOUND');
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 2: List All Current Policies
-- ============================================================================

DO $$
DECLARE
    policy_record RECORD;
    policy_count INTEGER := 0;
BEGIN
    RAISE NOTICE '📋 STEP 2: Current Policies on sites and site_members';
    RAISE NOTICE '-----------------------------------------------';
    
    -- Show all policies for sites table
    RAISE NOTICE 'SITES table policies:';
    FOR policy_record IN
        SELECT policyname, cmd, permissive, roles, qual, with_check
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'sites'
        ORDER BY policyname
    LOOP
        policy_count := policy_count + 1;
        RAISE NOTICE '  • % | % | % | USING: % | CHECK: %', 
            policy_record.policyname, 
            policy_record.cmd, 
            policy_record.permissive,
            COALESCE(SUBSTRING(policy_record.qual FROM 1 FOR 50), 'NULL'),
            COALESCE(SUBSTRING(policy_record.with_check FROM 1 FOR 50), 'NULL');
    END LOOP;
    
    IF policy_count = 0 THEN
        RAISE NOTICE '  → NO POLICIES FOUND on sites table';
    END IF;
    
    RAISE NOTICE '';
    policy_count := 0;
    
    -- Show all policies for site_members table
    RAISE NOTICE 'SITE_MEMBERS table policies:';
    FOR policy_record IN
        SELECT policyname, cmd, permissive, roles, qual, with_check
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'site_members'
        ORDER BY policyname
    LOOP
        policy_count := policy_count + 1;
        RAISE NOTICE '  • % | % | % | USING: % | CHECK: %', 
            policy_record.policyname, 
            policy_record.cmd, 
            policy_record.permissive,
            COALESCE(SUBSTRING(policy_record.qual FROM 1 FOR 50), 'NULL'),
            COALESCE(SUBSTRING(policy_record.with_check FROM 1 FOR 50), 'NULL');
    END LOOP;
    
    IF policy_count = 0 THEN
        RAISE NOTICE '  → NO POLICIES FOUND on site_members table';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 3: Test Basic Table Access (as admin/bypass RLS)
-- ============================================================================

DO $$
DECLARE
    sites_count INTEGER;
    members_count INTEGER;
    sites_accessible BOOLEAN := FALSE;
    members_accessible BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '📋 STEP 3: Testing Basic Table Access (bypass RLS)';
    RAISE NOTICE '------------------------------------------------';
    
    -- Test sites table access (with RLS bypass)
    BEGIN
        SET ROLE postgres; -- This should bypass RLS
        SELECT COUNT(*) INTO sites_count FROM public.sites;
        sites_accessible := TRUE;
        RAISE NOTICE 'Sites table: ✅ ACCESSIBLE - % total rows', sites_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Sites table: ❌ ERROR - %', SQLERRM;
        sites_accessible := FALSE;
    END;
    
    -- Test site_members table access (with RLS bypass)
    BEGIN
        SET ROLE postgres; -- This should bypass RLS
        SELECT COUNT(*) INTO members_count FROM public.site_members;
        members_accessible := TRUE;
        RAISE NOTICE 'Site_members table: ✅ ACCESSIBLE - % total rows', members_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Site_members table: ❌ ERROR - %', SQLERRM;
        members_accessible := FALSE;
    END;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 4: Test with Specific User Context
-- ============================================================================

DO $$
DECLARE
    test_result INTEGER;
    user_sites_count INTEGER := 0;
BEGIN
    RAISE NOTICE '📋 STEP 4: Testing with Authenticated User Context';
    RAISE NOTICE '-----------------------------------------------';
    
    -- Test sites access as if we were the specific user
    BEGIN
        -- Simulate the auth context
        SET SESSION AUTHORIZATION 'authenticated';
        
        -- Test the query that's failing in the application
        SELECT COUNT(*) INTO user_sites_count 
        FROM public.sites 
        WHERE user_id = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid;
        
        RAISE NOTICE 'User sites query: ✅ SUCCESS - Found % sites for user', user_sites_count;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'User sites query: ❌ ERROR - %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
    END;
    
    -- Reset to default role
    RESET SESSION AUTHORIZATION;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 5: Check for Functions/Triggers That Could Cause Issues
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    trigger_record RECORD;
    func_count INTEGER := 0;
    trigger_count INTEGER := 0;
BEGIN
    RAISE NOTICE '📋 STEP 5: Checking Functions and Triggers';
    RAISE NOTICE '----------------------------------------';
    
    -- Check for functions that might be interfering
    RAISE NOTICE 'Functions with "sites" or "members" in name:';
    FOR func_record IN
        SELECT proname, prosrc
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND (proname ILIKE '%site%' OR proname ILIKE '%member%')
        ORDER BY proname
    LOOP
        func_count := func_count + 1;
        RAISE NOTICE '  • Function: %', func_record.proname;
    END LOOP;
    
    IF func_count = 0 THEN
        RAISE NOTICE '  → No relevant functions found';
    END IF;
    
    RAISE NOTICE '';
    
    -- Check for triggers on sites and site_members
    RAISE NOTICE 'Triggers on sites and site_members tables:';
    FOR trigger_record IN
        SELECT t.tgname, c.relname as tablename, p.proname as funcname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' 
        AND c.relname IN ('sites', 'site_members')
        AND NOT t.tgisinternal
        ORDER BY c.relname, t.tgname
    LOOP
        trigger_count := trigger_count + 1;
        RAISE NOTICE '  • Trigger: % on % → function %', 
            trigger_record.tgname, 
            trigger_record.tablename, 
            trigger_record.funcname;
    END LOOP;
    
    IF trigger_count = 0 THEN
        RAISE NOTICE '  → No triggers found on sites/site_members';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 6: Final Assessment
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 DIAGNOSTIC COMPLETE';
    RAISE NOTICE '===================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps based on results above:';
    RAISE NOTICE '1. If RLS is enabled but no policies → Need to add policies';
    RAISE NOTICE '2. If policies exist but still error → Policy syntax issue';
    RAISE NOTICE '3. If table not accessible even as admin → Table corruption';
    RAISE NOTICE '4. If functions/triggers found → Potential interference';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for targeted fix based on findings.';
END $$;

SELECT 'DIAGNOSTIC COMPLETE - Review output above' AS status; 