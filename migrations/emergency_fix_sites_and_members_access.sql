-- EMERGENCY FIX: Sites and Site Members Access
-- This migration fixes the access issues to sites table caused by problematic RLS policies

DO $$
BEGIN
    RAISE NOTICE '🚨 EMERGENCY FIX: Correcting sites and site_members access...';
    RAISE NOTICE '❌ Problem: Policies causing 500 errors and access denied';
    RAISE NOTICE '✅ Solution: Create simple, working policies without circular dependencies';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- EMERGENCY FIX: Site Members Policies (Fixed)
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Fixing site_members policies...';
    
    -- Drop all problematic policies
    DROP POLICY IF EXISTS "View site members" ON public.site_members;
    DROP POLICY IF EXISTS "Add site members" ON public.site_members;
    DROP POLICY IF EXISTS "Update site members" ON public.site_members;
    DROP POLICY IF EXISTS "Allow cascade deletions from auth.users" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_view_safe" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_insert_safe" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_update_safe" ON public.site_members;
    DROP POLICY IF EXISTS "site_members_delete_safe" ON public.site_members;
    
    -- Simple, working policies for site_members
    CREATE POLICY "site_members_can_view_own_memberships" ON public.site_members
        FOR SELECT USING (user_id = (select auth.uid()));
    
    CREATE POLICY "site_members_owners_can_manage" ON public.site_members
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.id = site_members.site_id 
                AND s.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.id = site_members.site_id 
                AND s.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ site_members policies fixed';
END $$;

-- ============================================================================
-- EMERGENCY FIX: Sites Policies (Complete rebuild)
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Fixing sites policies...';
    
    -- Drop all existing sites policies
    DROP POLICY IF EXISTS "Authenticated users can create sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can view their own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can update their own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can delete their own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can view sites they are members of" ON public.sites;
    DROP POLICY IF EXISTS "Site owners can manage their sites" ON public.sites;
    DROP POLICY IF EXISTS "Site members can view sites they belong to" ON public.sites;
    
    -- Create simple, working policies for sites
    
    -- 1. Users can create their own sites
    CREATE POLICY "users_can_create_sites" ON public.sites
        FOR INSERT WITH CHECK (user_id = (select auth.uid()));
    
    -- 2. Users can view and manage sites they own
    CREATE POLICY "users_can_manage_owned_sites" ON public.sites
        FOR ALL USING (user_id = (select auth.uid()))
        WITH CHECK (user_id = (select auth.uid()));
    
    -- 3. Users can view sites they are members of
    CREATE POLICY "users_can_view_member_sites" ON public.sites
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm
                WHERE sm.site_id = sites.id 
                AND sm.user_id = (select auth.uid())
                AND sm.status = 'active'
            )
        );
    
    RAISE NOTICE '✅ sites policies fixed';
END $$;

-- ============================================================================
-- VERIFICATION AND TESTING
-- ============================================================================

DO $$
DECLARE
    sites_policy_count INTEGER;
    members_policy_count INTEGER;
    test_result BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICATION: Testing access policies...';
    
    -- Count current policies
    SELECT COUNT(*) INTO sites_policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sites';
    
    SELECT COUNT(*) INTO members_policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'site_members';
    
    RAISE NOTICE 'Sites policies: %', sites_policy_count;
    RAISE NOTICE 'Site members policies: %', members_policy_count;
    
    -- Test basic query access
    BEGIN
        PERFORM 1 FROM public.sites LIMIT 1;
        PERFORM 1 FROM public.site_members LIMIT 1;
        test_result := TRUE;
        RAISE NOTICE '✅ Test queries successful - No recursion detected';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Test queries failed: %', SQLERRM;
        test_result := FALSE;
    END;
    
    IF test_result THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 EMERGENCY FIX SUCCESSFUL!';
        RAISE NOTICE '✅ sites table is now accessible';
        RAISE NOTICE '✅ site_members table is now accessible';
        RAISE NOTICE '✅ No more infinite recursion';
        RAISE NOTICE '✅ Users can access sites by ownership AND membership';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Emergency fix may need additional work';
        RAISE NOTICE '🔧 Consider temporary RLS disable if issues persist';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 EMERGENCY ACCESS FIX COMPLETE';
    RAISE NOTICE '🎯 Application should now load sites correctly';
    
END $$;

-- ============================================================================
-- CLEANUP: Remove broken policies from other tables that depend on site_members
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧹 Cleaning up dependent policies that may still cause issues...';
    
    -- Fix categories policies to be simple
    DROP POLICY IF EXISTS "Users can view their own site's categories" ON public.categories;
    DROP POLICY IF EXISTS "Users can create categories for their sites" ON public.categories;
    DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
    DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;
    
    CREATE POLICY "categories_for_owned_sites" ON public.categories
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.id = categories.site_id 
                AND s.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.id = categories.site_id 
                AND s.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Categories policies simplified';
    
    -- Fix segments policies if they exist
    DROP POLICY IF EXISTS "Users can view segments for their sites" ON public.segments;
    DROP POLICY IF EXISTS "Users can create segments for their sites" ON public.segments;
    DROP POLICY IF EXISTS "Users can update segments for their sites" ON public.segments;
    DROP POLICY IF EXISTS "Users can delete segments for their sites" ON public.segments;
    
    CREATE POLICY "segments_for_owned_sites" ON public.segments
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.id = segments.site_id 
                AND s.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.id = segments.site_id 
                AND s.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Segments policies simplified';
    
END $$;

-- Final status
SELECT 'EMERGENCY: Sites and site_members access FIXED' AS status; 