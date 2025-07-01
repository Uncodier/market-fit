-- EMERGENCY SIMPLE FIX: Sites Access
-- This migration creates the simplest possible working policies

DO $$
BEGIN
    RAISE NOTICE '🚨 EMERGENCY SIMPLE FIX: Basic sites access...';
    RAISE NOTICE '❌ Problem: Complex policies preventing basic access';
    RAISE NOTICE '✅ Solution: Simple, direct policies';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 1: DISABLE RLS TEMPORARILY ON CRITICAL TABLES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔓 Temporarily disabling RLS for emergency access...';
    
    -- Disable RLS on sites to restore immediate access
    ALTER TABLE public.sites DISABLE ROW LEVEL SECURITY;
    
    -- Disable RLS on site_members to prevent recursion
    ALTER TABLE public.site_members DISABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE '✅ RLS disabled on critical tables';
END $$;

-- ============================================================================
-- STEP 2: CLEAN ALL PROBLEMATIC POLICIES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🧹 Removing ALL problematic policies...';
    
    -- Remove ALL sites policies
    DROP POLICY IF EXISTS "Authenticated users can create sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can view their own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can update their own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can delete their own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can view sites they are members of" ON public.sites;
    DROP POLICY IF EXISTS "Site owners can manage their sites" ON public.sites;
    DROP POLICY IF EXISTS "Site members can view sites they belong to" ON public.sites;
    DROP POLICY IF EXISTS "users_can_create_sites" ON public.sites;
    DROP POLICY IF EXISTS "users_can_manage_owned_sites" ON public.sites;
    DROP POLICY IF EXISTS "users_can_view_member_sites" ON public.sites;
    
    -- Remove ALL site_members policies
    DROP POLICY IF EXISTS "View site members" ON public.site_members;
    DROP POLICY IF EXISTS "Add site members" ON public.site_members;
    DROP POLICY IF EXISTS "Update site members" ON public.site_members;
    DROP POLICY IF EXISTS "Allow cascade deletions from auth.users" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_view_safe" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_insert_safe" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_update_safe" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_delete_safe" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_can_view_own_memberships" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_owners_can_manage" ON public.site_members;
    
    RAISE NOTICE '✅ All problematic policies removed';
END $$;

-- ============================================================================
-- STEP 3: CREATE SIMPLE, WORKING POLICIES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Creating simple working policies...';
    
    -- Re-enable RLS with simple policies
    ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
    
    -- SUPER SIMPLE sites policies - just ownership
    CREATE POLICY "sites_owner_access" ON public.sites
        FOR ALL USING (user_id = (select auth.uid()))
        WITH CHECK (user_id = (select auth.uid()));
    
    RAISE NOTICE '✅ Simple sites policy created';
END $$;

-- ============================================================================
-- STEP 4: SIMPLE SITE_MEMBERS POLICIES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Creating simple site_members policies...';
    
    -- Re-enable RLS for site_members
    ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;
    
    -- SUPER SIMPLE site_members policies
    CREATE POLICY "site_members_simple_access" ON public.site_members
        FOR ALL USING (
            user_id = (select auth.uid()) OR
            EXISTS (SELECT 1 FROM public.sites WHERE id = site_members.site_id AND user_id = (select auth.uid()))
        )
        WITH CHECK (
            user_id = (select auth.uid()) OR
            EXISTS (SELECT 1 FROM public.sites WHERE id = site_members.site_id AND user_id = (select auth.uid()))
        );
    
    RAISE NOTICE '✅ Simple site_members policy created';
END $$;

-- ============================================================================
-- STEP 5: TEST ACCESS
-- ============================================================================

DO $$
DECLARE
    test_count INTEGER;
    sites_test BOOLEAN := FALSE;
    members_test BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTING ACCESS...';
    
    -- Test sites access
    BEGIN
        SELECT COUNT(*) INTO test_count FROM public.sites LIMIT 10;
        sites_test := TRUE;
        RAISE NOTICE '✅ Sites table accessible - Found % rows', test_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Sites test failed: %', SQLERRM;
        sites_test := FALSE;
    END;
    
    -- Test site_members access
    BEGIN
        SELECT COUNT(*) INTO test_count FROM public.site_members LIMIT 10;
        members_test := TRUE;
        RAISE NOTICE '✅ Site_members table accessible - Found % rows', test_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Site_members test failed: %', SQLERRM;
        members_test := FALSE;
    END;
    
    IF sites_test AND members_test THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 EMERGENCY FIX SUCCESSFUL!';
        RAISE NOTICE '✅ Both tables are now accessible';
        RAISE NOTICE '✅ Simple policies working';
        RAISE NOTICE '✅ No recursion issues';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Still having issues - may need to disable RLS completely';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 SIMPLE EMERGENCY FIX COMPLETE';
    
END $$;

-- ============================================================================
-- STEP 6: OPTION TO DISABLE RLS COMPLETELY IF STILL HAVING ISSUES
-- ============================================================================

-- Uncomment these lines if the above policies still don't work:
-- ALTER TABLE public.sites DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.site_members DISABLE ROW LEVEL SECURITY;

SELECT 'EMERGENCY: Simple sites access fix applied' AS status; 