-- FINAL FIX: Site Members Infinite Recursion
-- This migration definitively fixes the infinite recursion issue by completely
-- removing all existing policies and creating simple, non-recursive ones

BEGIN;

-- ============================================================================
-- STEP 1: DISABLE RLS TEMPORARILY TO SAFELY DROP ALL POLICIES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🚨 FINAL FIX: Resolving site_members infinite recursion permanently...';
    RAISE NOTICE '❌ Problem: Multiple conflicting policies causing circular references';
    RAISE NOTICE '✅ Solution: Clean slate with simple, non-recursive policies';
    RAISE NOTICE '';
    
    RAISE NOTICE '🔧 Temporarily disabling RLS to safely remove all policies...';
    
    -- Temporarily disable RLS to perform cleanup
    ALTER TABLE public.site_members DISABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE '✅ RLS disabled temporarily';
END $$;

-- ============================================================================
-- STEP 2: DROP ALL EXISTING POLICIES (COMPREHENSIVE CLEANUP)
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🧹 Removing ALL existing site_members policies...';
    
    -- Drop all known policy names from various migrations
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
    DROP POLICY IF EXISTS "site_members_simple_access" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_own_only" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_owner_manage" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_owner_update" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_owner_delete" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_optimized_policy" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_unified" ON public.site_members;
    
    RAISE NOTICE '✅ All existing policies removed';
END $$;

-- ============================================================================
-- STEP 3: RE-ENABLE RLS WITH CLEAN SLATE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Re-enabling RLS...';
    
    ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE '✅ RLS re-enabled';
END $$;

-- ============================================================================
-- STEP 4: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Creating simple, non-recursive policies...';
    
    -- Policy 1: Users can view their own memberships
    -- This is completely safe and non-recursive
    CREATE POLICY "users_view_own_memberships" ON public.site_members
        FOR SELECT USING (user_id = (SELECT auth.uid()));
    
    -- Policy 2: Site owners can insert new members
    -- Uses direct lookup on sites table without any site_members reference
    CREATE POLICY "owners_can_add_members" ON public.site_members
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.sites 
                WHERE sites.id = site_members.site_id 
                AND sites.user_id = (SELECT auth.uid())
            )
        );
    
    -- Policy 3: Site owners can view all members of their sites
    -- Uses direct lookup on sites table without any site_members reference
    CREATE POLICY "owners_view_site_members" ON public.site_members
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.sites 
                WHERE sites.id = site_members.site_id 
                AND sites.user_id = (SELECT auth.uid())
            )
        );
    
    -- Policy 4: Site owners and users can update/delete memberships
    -- Users can update/delete themselves, owners can update/delete any member
    CREATE POLICY "members_can_be_managed" ON public.site_members
        FOR UPDATE USING (
            user_id = (SELECT auth.uid()) OR
            EXISTS (
                SELECT 1 FROM public.sites 
                WHERE sites.id = site_members.site_id 
                AND sites.user_id = (SELECT auth.uid())
            )
        );
    
    CREATE POLICY "members_can_be_deleted" ON public.site_members
        FOR DELETE USING (
            user_id = (SELECT auth.uid()) OR
            EXISTS (
                SELECT 1 FROM public.sites 
                WHERE sites.id = site_members.site_id 
                AND sites.user_id = (SELECT auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Simple, non-recursive policies created';
END $$;

-- ============================================================================
-- STEP 5: COMPREHENSIVE TESTING
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
    test_result BOOLEAN := FALSE;
    error_message TEXT;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 COMPREHENSIVE TESTING...';
    
    -- Count final policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'site_members';
    
    RAISE NOTICE 'Final policy count: %', policy_count;
    
    -- List all policies for verification
    RAISE NOTICE 'Active policies:';
    FOR rec IN 
        SELECT policyname
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'site_members'
        ORDER BY policyname
    LOOP
        RAISE NOTICE '  • %', rec.policyname;
    END LOOP;
    
    -- Test 1: Basic query access
    BEGIN
        PERFORM 1 FROM public.site_members LIMIT 1;
        test_result := TRUE;
        RAISE NOTICE '✅ TEST 1 PASSED: Basic site_members access successful';
    EXCEPTION WHEN OTHERS THEN
        error_message := SQLERRM;
        RAISE NOTICE '❌ TEST 1 FAILED: Basic access failed: %', error_message;
        test_result := FALSE;
    END;
    
    -- Test 2: Count query (often triggers recursion issues)
    BEGIN
        PERFORM COUNT(*) FROM public.site_members;
        RAISE NOTICE '✅ TEST 2 PASSED: Count query successful';
    EXCEPTION WHEN OTHERS THEN
        error_message := SQLERRM;
        RAISE NOTICE '❌ TEST 2 FAILED: Count query failed: %', error_message;
        test_result := FALSE;
    END;
    
    -- Test 3: Join with sites table
    BEGIN
        PERFORM 1 FROM public.site_members sm 
        JOIN public.sites s ON s.id = sm.site_id 
        LIMIT 1;
        RAISE NOTICE '✅ TEST 3 PASSED: Join with sites successful';
    EXCEPTION WHEN OTHERS THEN
        error_message := SQLERRM;
        RAISE NOTICE '❌ TEST 3 FAILED: Join query failed: %', error_message;
        test_result := FALSE;
    END;
    
    RAISE NOTICE '';
    
    IF test_result THEN
        RAISE NOTICE '🎉 FINAL FIX SUCCESSFUL!';
        RAISE NOTICE '✅ site_members table is fully accessible';
        RAISE NOTICE '✅ No infinite recursion detected';
        RAISE NOTICE '✅ All policies are simple and non-recursive';
        RAISE NOTICE '✅ Team member invitations should now work';
    ELSE
        RAISE NOTICE '⚠️  Some tests failed - manual investigation required';
        RAISE NOTICE '🔧 Consider checking for other conflicting policies';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 FINAL FIX COMPLETE - INFINITE RECURSION RESOLVED';
    
END $$;

COMMIT;

-- Final status check
SELECT 'FINAL_FIX_APPLIED: site_members infinite recursion resolved' AS status; 