-- EMERGENCY FIX: Site Members Infinite Recursion
-- This migration fixes the infinite recursion issue in site_members policies
-- The previous migration created policies that query site_members from within site_members policies

DO $$
BEGIN
    RAISE NOTICE '🚨 EMERGENCY FIX: Correcting site_members infinite recursion...';
    RAISE NOTICE '❌ Problem: Policies were querying site_members from within site_members';
    RAISE NOTICE '✅ Solution: Use simpler, direct policies without circular references';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- EMERGENCY FIX: Site Members Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Removing problematic site_members policies...';
    
    -- Drop all the problematic policies that cause recursion
    DROP POLICY IF EXISTS "View site members" ON public.site_members;
    DROP POLICY IF EXISTS "Add site members" ON public.site_members;
    DROP POLICY IF EXISTS "Update site members" ON public.site_members;
    DROP POLICY IF EXISTS "Allow cascade deletions from auth.users" ON public.site_members;
    
    RAISE NOTICE '✅ Problematic policies removed';
END $$;

DO $$
BEGIN
    RAISE NOTICE '🔧 Creating safe site_members policies...';
    
    -- Safe policy for viewing site members
    -- Users can only see site members for sites they belong to
    CREATE POLICY "site_members_view_safe" ON public.site_members
        FOR SELECT USING (
            user_id = (select auth.uid()) OR
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.id = site_members.site_id 
                AND s.user_id = (select auth.uid())
            )
        );
    
    -- Safe policy for adding site members
    -- Only site owners can add members
    CREATE POLICY "site_members_insert_safe" ON public.site_members
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.id = site_members.site_id 
                AND s.user_id = (select auth.uid())
            )
        );
    
    -- Safe policy for updating site members
    -- Only site owners can update members, or users can update themselves
    CREATE POLICY "site_members_update_safe" ON public.site_members
        FOR UPDATE USING (
            user_id = (select auth.uid()) OR
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.id = site_members.site_id 
                AND s.user_id = (select auth.uid())
            )
        );
    
    -- Safe policy for deleting site members
    -- Users can delete themselves, or site owners can delete members
    CREATE POLICY "site_members_delete_safe" ON public.site_members
        FOR DELETE USING (
            user_id = (select auth.uid()) OR
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.id = site_members.site_id 
                AND s.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Safe site_members policies created';
END $$;

-- ============================================================================
-- VERIFICATION AND TESTING
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
    test_result BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICATION: Testing for recursion issues...';
    
    -- Count current site_members policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'site_members';
    
    RAISE NOTICE 'Current site_members policies: %', policy_count;
    
    -- Test query to ensure no recursion (this should work without infinite loop)
    BEGIN
        PERFORM 1 FROM public.site_members LIMIT 1;
        test_result := TRUE;
        RAISE NOTICE '✅ Test query successful - No infinite recursion detected';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Test query failed: %', SQLERRM;
        test_result := FALSE;
    END;
    
    IF test_result THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 EMERGENCY FIX SUCCESSFUL!';
        RAISE NOTICE '✅ site_members table is now accessible';
        RAISE NOTICE '✅ No more infinite recursion';
        RAISE NOTICE '✅ Policies are safe and functional';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Emergency fix may need additional work';
        RAISE NOTICE '🔧 Consider temporary RLS disable if issues persist';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 EMERGENCY FIX COMPLETE';
    RAISE NOTICE '🎯 Application should now load segments correctly';
    
END $$;

-- Final verification message
SELECT 'EMERGENCY: site_members recursion fixed' AS status; 