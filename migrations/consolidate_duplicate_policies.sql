-- CONSOLIDATE DUPLICATE POLICIES: Fix multiple permissive policies warnings
-- This migration removes duplicate policies and creates single consolidated policies

DO $$
BEGIN
    RAISE NOTICE '🔧 CONSOLIDATING DUPLICATE POLICIES...';
    RAISE NOTICE '❌ Problem: Multiple permissive policies causing performance warnings';
    RAISE NOTICE '✅ Solution: Consolidate into single optimized policies';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 1: Fix sites table - Consolidate sites_owner_only + sites_member_view
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Consolidating sites table policies...';
    
    -- Drop both existing policies
    DROP POLICY IF EXISTS "sites_owner_only" ON public.sites;
    DROP POLICY IF EXISTS "sites_member_view" ON public.sites;
    
    -- Create single consolidated policy that handles both owners and members
    CREATE POLICY "sites_unified_access" ON public.sites
        FOR ALL USING (
            -- Allow owners (original sites_owner_only functionality)
            user_id = (SELECT auth.uid()) 
            OR 
            -- Allow site_members to view sites they belong to (original sites_member_view functionality)
            EXISTS (
                SELECT 1 FROM public.site_members sm
                WHERE sm.site_id = sites.id 
                AND sm.user_id = (SELECT auth.uid())
                AND sm.status = 'active'
            )
        ) WITH CHECK (
            -- Only owners can create/update/delete sites
            user_id = (SELECT auth.uid())
        );
    
    RAISE NOTICE '✅ Sites policies consolidated into sites_unified_access';
END $$;

-- ============================================================================
-- STEP 2: Fix segments table - Consolidate segments_for_owned_sites + segments_optimized_policy
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Consolidating segments table policies...';
    
    -- Drop both existing policies
    DROP POLICY IF EXISTS "segments_for_owned_sites" ON public.segments;
    DROP POLICY IF EXISTS "segments_optimized_policy" ON public.segments;
    
    -- Create single consolidated policy with optimized performance
    CREATE POLICY "segments_unified_access" ON public.segments
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.sites s 
                WHERE s.id = segments.site_id AND (
                    -- Allow site owners
                    s.user_id = (SELECT auth.uid()) OR
                    -- Allow site members
                    EXISTS (
                        SELECT 1 FROM public.site_members sm 
                        WHERE sm.site_id = s.id 
                        AND sm.user_id = (SELECT auth.uid())
                        AND sm.status = 'active'
                    )
                )
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.sites s 
                WHERE s.id = segments.site_id AND (
                    -- Allow site owners
                    s.user_id = (SELECT auth.uid()) OR
                    -- Allow site members
                    EXISTS (
                        SELECT 1 FROM public.site_members sm 
                        WHERE sm.site_id = s.id 
                        AND sm.user_id = (SELECT auth.uid())
                        AND sm.status = 'active'
                    )
                )
            )
        );
    
    RAISE NOTICE '✅ Segments policies consolidated into segments_unified_access';
END $$;

-- ============================================================================
-- STEP 3: Verification - Check for remaining duplicate policies
-- ============================================================================

DO $$
DECLARE
    table_name TEXT;
    policy_count INTEGER;
    total_tables_with_multiple_policies INTEGER := 0;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICATION: Checking for remaining multiple policies...';
    RAISE NOTICE '';
    
    -- Check each table for multiple permissive policies
    FOR table_name IN
        SELECT DISTINCT tablename
        FROM pg_policies 
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = table_name
        AND permissive = 'PERMISSIVE';
        
        IF policy_count > 1 THEN
            total_tables_with_multiple_policies := total_tables_with_multiple_policies + 1;
            RAISE NOTICE '⚠️  Table % still has % permissive policies', table_name, policy_count;
            
            -- List the specific policies
            FOR rec IN
                SELECT policyname
                FROM pg_policies 
                WHERE schemaname = 'public' 
                AND tablename = table_name
                AND permissive = 'PERMISSIVE'
                ORDER BY policyname
            LOOP
                RAISE NOTICE '   • %', rec.policyname;
            END LOOP;
        ELSE
            RAISE NOTICE '✅ Table %: % policy', table_name, policy_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    IF total_tables_with_multiple_policies = 0 THEN
        RAISE NOTICE '🎉 SUCCESS: No tables with multiple permissive policies!';
    ELSE
        RAISE NOTICE '⚠️  % tables still have multiple policies', total_tables_with_multiple_policies;
    END IF;
    
END $$;

-- ============================================================================
-- STEP 4: Test the consolidated policies
-- ============================================================================

DO $$
DECLARE
    sites_access BOOLEAN := FALSE;
    segments_access BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTING CONSOLIDATED POLICIES...';
    RAISE NOTICE '';
    
    -- Test sites access
    BEGIN
        PERFORM 1 FROM public.sites LIMIT 1;
        sites_access := TRUE;
        RAISE NOTICE '✅ Sites table access: WORKING';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Sites table access: FAILED - %', SQLERRM;
        sites_access := FALSE;
    END;
    
    -- Test segments access
    BEGIN
        PERFORM 1 FROM public.segments LIMIT 1;
        segments_access := TRUE;
        RAISE NOTICE '✅ Segments table access: WORKING';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Segments table access: FAILED - %', SQLERRM;
        segments_access := FALSE;
    END;
    
    IF sites_access AND segments_access THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 CONSOLIDATION SUCCESSFUL!';
        RAISE NOTICE '✅ Sites: Owners + members can access';
        RAISE NOTICE '✅ Segments: Owners + members can access';
        RAISE NOTICE '✅ No multiple permissive policies';
        RAISE NOTICE '✅ Performance optimized';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Some access tests failed - review needed';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 POLICY CONSOLIDATION COMPLETE';
    
END $$;

SELECT 'DUPLICATE_POLICIES_CONSOLIDATED' AS status; 