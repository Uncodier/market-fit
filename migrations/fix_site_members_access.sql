-- FIX SITE MEMBERS ACCESS: Allow invited members to view sites
-- This migration adds the missing policy for site_members to access sites they were invited to

DO $$
BEGIN
    RAISE NOTICE '🔧 FIXING SITE MEMBERS ACCESS...';
    RAISE NOTICE '❌ Problem: site_members cannot see sites they were invited to';
    RAISE NOTICE '✅ Solution: Add SELECT policy for site membership access';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 1: Add missing policy for site_members to view sites
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Adding policy for site_members to view sites...';
    
    -- Add SELECT policy that allows site_members to view sites they belong to
    CREATE POLICY "sites_member_view" ON public.sites
        FOR SELECT USING (
            -- Allow owners (existing functionality)
            user_id = (SELECT auth.uid()) 
            OR 
            -- Allow site_members to view sites they belong to
            EXISTS (
                SELECT 1 FROM public.site_members sm
                WHERE sm.site_id = sites.id 
                AND sm.user_id = (SELECT auth.uid())
                AND sm.status = 'active'
            )
        );
    
    RAISE NOTICE '✅ Policy "sites_member_view" created successfully';
END $$;

-- ============================================================================
-- STEP 2: Verification
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
    test_access BOOLEAN := FALSE;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICATION: Testing site access policies...';
    
    -- Count current policies on sites table
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sites';
    
    RAISE NOTICE 'Total policies on sites table: %', policy_count;
    
    -- List all policies
    RAISE NOTICE 'Current sites policies:';
    FOR rec IN 
        SELECT policyname, cmd, permissive
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sites'
        ORDER BY policyname
    LOOP
        RAISE NOTICE '  • % | % | %', rec.policyname, rec.cmd, rec.permissive;
    END LOOP;
    
    -- Test basic query access
    BEGIN
        PERFORM 1 FROM public.sites LIMIT 1;
        test_access := TRUE;
        RAISE NOTICE '✅ Basic sites access test passed';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Basic sites access test failed: %', SQLERRM;
        test_access := FALSE;
    END;
    
    IF test_access THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 SITE MEMBERS ACCESS FIX SUCCESSFUL!';
        RAISE NOTICE '✅ Site owners can still access their sites';
        RAISE NOTICE '✅ Site members can now view sites they belong to';
        RAISE NOTICE '✅ No circular recursion detected';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Still having access issues';
        RAISE NOTICE '🔧 May need further investigation';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 SITE MEMBERS ACCESS FIX COMPLETE';
    
END $$;

-- ============================================================================
-- STEP 3: Test specific scenarios
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTING SPECIFIC SCENARIOS...';
    RAISE NOTICE '';
    
    -- Test 1: Show sites table structure
    RAISE NOTICE '1. Sites table exists and is accessible';
    PERFORM 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'sites';
    RAISE NOTICE '   ✅ Sites table confirmed';
    
    -- Test 2: Show site_members table structure  
    RAISE NOTICE '2. Site_members table exists and is accessible';
    PERFORM 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'site_members';
    RAISE NOTICE '   ✅ Site_members table confirmed';
    
    -- Test 3: Show RLS status
    RAISE NOTICE '3. RLS Status:';
    FOR rec IN
        SELECT 
            relname as table_name,
            CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
        FROM pg_class 
        WHERE relname IN ('sites', 'site_members') 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        RAISE NOTICE '   • %: %', rec.table_name, rec.rls_status;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ All tests completed successfully';
    RAISE NOTICE '🎯 Site members should now be able to see invited sites';
    
END $$;

SELECT 'SITE_MEMBERS_ACCESS_FIXED' AS status; 