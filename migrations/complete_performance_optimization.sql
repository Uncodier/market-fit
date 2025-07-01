-- Complete Performance Optimization - All Remaining Tables
-- This migration handles any remaining tables that may have RLS performance issues

DO $$
BEGIN
    RAISE NOTICE '🚀 Complete Performance Optimization - Final Sweep...';
    RAISE NOTICE '📊 Target: Fix all remaining RLS performance issues';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 1: Campaigns Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing campaigns table policies...';
    
    DROP POLICY IF EXISTS "Users can view campaigns for their sites" ON public.campaigns;
    DROP POLICY IF EXISTS "Users can create campaigns for their sites" ON public.campaigns;
    DROP POLICY IF EXISTS "Users can update campaigns for their sites" ON public.campaigns;
    DROP POLICY IF EXISTS "Users can delete campaigns for their sites" ON public.campaigns;
    DROP POLICY IF EXISTS "Permitir a los usuarios gestionar campañas de sus sitios" ON public.campaigns;
    
    CREATE POLICY "Users can manage campaigns for their sites" ON public.campaigns
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = campaigns.site_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = campaigns.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Campaigns policies optimized';
END $$;

-- ============================================================================
-- PART 2: Experiments Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing experiments table policies...';
    
    DROP POLICY IF EXISTS "Users can view experiments for their sites" ON public.experiments;
    DROP POLICY IF EXISTS "Users can create experiments for their sites" ON public.experiments;
    DROP POLICY IF EXISTS "Users can update experiments for their sites" ON public.experiments;
    DROP POLICY IF EXISTS "Users can delete experiments for their sites" ON public.experiments;
    DROP POLICY IF EXISTS "Permitir a los usuarios gestionar experimentos de sus sitios" ON public.experiments;
    
    CREATE POLICY "Users can manage experiments for their sites" ON public.experiments
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = experiments.site_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = experiments.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Experiments policies optimized';
END $$;

-- ============================================================================
-- PART 3: Segments Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing segments table policies...';
    
    DROP POLICY IF EXISTS "Users can view segments for their sites" ON public.segments;
    DROP POLICY IF EXISTS "Users can create segments for their sites" ON public.segments;
    DROP POLICY IF EXISTS "Users can update segments for their sites" ON public.segments;
    DROP POLICY IF EXISTS "Users can delete segments for their sites" ON public.segments;
    DROP POLICY IF EXISTS "Permitir a los usuarios gestionar segmentos de sus sitios" ON public.segments;
    
    CREATE POLICY "Users can manage segments for their sites" ON public.segments
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = segments.site_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = segments.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Segments policies optimized';
END $$;

-- ============================================================================
-- PART 4: KPIs Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing kpis table policies...';
    
    DROP POLICY IF EXISTS "Users can view kpis for their sites" ON public.kpis;
    DROP POLICY IF EXISTS "Users can create kpis for their sites" ON public.kpis;
    DROP POLICY IF EXISTS "Users can update kpis for their sites" ON public.kpis;
    DROP POLICY IF EXISTS "Users can delete kpis for their sites" ON public.kpis;
    DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.kpis;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.kpis;
    DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.kpis;
    DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.kpis;
    
    CREATE POLICY "Users can manage kpis for their sites" ON public.kpis
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = kpis.site_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = kpis.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ KPIs policies optimized';
END $$;

-- ============================================================================
-- PART 5: Notifications Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing notifications table policies...';
    
    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON public.notifications;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.notifications;
    DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.notifications;
    DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.notifications;
    
    CREATE POLICY "Users can manage their own notifications" ON public.notifications
        FOR ALL USING (user_id = (select auth.uid()))
        WITH CHECK (user_id = (select auth.uid()));
    
    RAISE NOTICE '✅ Notifications policies optimized';
END $$;

-- ============================================================================
-- PART 6: Sites Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing sites table policies...';
    
    DROP POLICY IF EXISTS "Allow site members to read site details" ON public.sites;
    DROP POLICY IF EXISTS "Allow site owners to update sites" ON public.sites;
    DROP POLICY IF EXISTS "Allow authenticated users to create sites" ON public.sites;
    DROP POLICY IF EXISTS "Allow site owners to delete sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can view their sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can create sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can update their sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can delete their sites" ON public.sites;
    
    -- Read access for site members
    CREATE POLICY "Users can view sites they are members of" ON public.sites
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = sites.id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    -- Create access for authenticated users
    CREATE POLICY "Authenticated users can create sites" ON public.sites
        FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
    
    -- Update access for site owners/admins
    CREATE POLICY "Site owners can update sites" ON public.sites
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = sites.id 
                AND sm.user_id = (select auth.uid())
                AND sm.role IN ('owner', 'admin')
            )
        );
    
    -- Delete access for site owners
    CREATE POLICY "Site owners can delete sites" ON public.sites
        FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = sites.id 
                AND sm.user_id = (select auth.uid())
                AND sm.role = 'owner'
            )
        );
    
    RAISE NOTICE '✅ Sites policies optimized';
END $$;

-- ============================================================================
-- PART 7: Task Subtasks Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing task_subtasks table policies...';
    
    DROP POLICY IF EXISTS "Users can view subtasks for their tasks" ON public.task_subtasks;
    DROP POLICY IF EXISTS "Users can create subtasks for their tasks" ON public.task_subtasks;
    DROP POLICY IF EXISTS "Users can update subtasks for their tasks" ON public.task_subtasks;
    DROP POLICY IF EXISTS "Users can delete subtasks for their tasks" ON public.task_subtasks;
    DROP POLICY IF EXISTS "Permitir a los usuarios gestionar subtareas de sus tareas" ON public.task_subtasks;
    
    CREATE POLICY "Users can manage subtasks for their tasks" ON public.task_subtasks
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.tasks t
                JOIN public.site_members sm ON sm.site_id = t.site_id
                WHERE t.id = task_subtasks.task_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.tasks t
                JOIN public.site_members sm ON sm.site_id = t.site_id
                WHERE t.id = task_subtasks.task_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Task subtasks policies optimized';
END $$;

-- ============================================================================
-- PART 8: User Profiles Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing user_profiles table policies...';
    
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can create their own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON public.user_profiles;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.user_profiles;
    DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.user_profiles;
    
    CREATE POLICY "Users can manage their own profile" ON public.user_profiles
        FOR ALL USING (user_id = (select auth.uid()))
        WITH CHECK (user_id = (select auth.uid()));
    
    RAISE NOTICE '✅ User profiles policies optimized';
END $$;

-- ============================================================================
-- PART 9: Workspaces Table Policies (if exists)
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing workspaces table policies (if exists)...';
    
    -- Check if workspaces table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces') THEN
        DROP POLICY IF EXISTS "Users can view their workspaces" ON public.workspaces;
        DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
        DROP POLICY IF EXISTS "Users can update their workspaces" ON public.workspaces;
        DROP POLICY IF EXISTS "Users can delete their workspaces" ON public.workspaces;
        
        CREATE POLICY "Users can manage workspaces for their sites" ON public.workspaces
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.site_members sm 
                    WHERE sm.site_id = workspaces.site_id 
                    AND sm.user_id = (select auth.uid())
                )
            ) WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.site_members sm 
                    WHERE sm.site_id = workspaces.site_id 
                    AND sm.user_id = (select auth.uid())
                )
            );
        
        RAISE NOTICE '✅ Workspaces policies optimized';
    ELSE
        RAISE NOTICE 'ℹ️  Workspaces table not found, skipping...';
    END IF;
END $$;

-- ============================================================================
-- PART 10: Lead Segments Table Policies (if exists)
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing lead_segments table policies (if exists)...';
    
    -- Check if lead_segments table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_segments') THEN
        DROP POLICY IF EXISTS "Users can view lead segments for their sites" ON public.lead_segments;
        DROP POLICY IF EXISTS "Users can manage lead segments for their sites" ON public.lead_segments;
        
        CREATE POLICY "Users can manage lead segments for their sites" ON public.lead_segments
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.leads l
                    JOIN public.site_members sm ON sm.site_id = l.site_id
                    WHERE l.id = lead_segments.lead_id 
                    AND sm.user_id = (select auth.uid())
                )
            ) WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.leads l
                    JOIN public.site_members sm ON sm.site_id = l.site_id
                    WHERE l.id = lead_segments.lead_id 
                    AND sm.user_id = (select auth.uid())
                )
            );
        
        RAISE NOTICE '✅ Lead segments policies optimized';
    ELSE
        RAISE NOTICE 'ℹ️  Lead segments table not found, skipping...';
    END IF;
END $$;

-- ============================================================================
-- FINAL COMPREHENSIVE VERIFICATION
-- ============================================================================

DO $$
DECLARE
    unoptimized_policies INTEGER;
    total_policies INTEGER;
    optimization_percentage NUMERIC;
    table_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 COMPREHENSIVE VERIFICATION';
    RAISE NOTICE '========================';
    
    -- Count total and unoptimized policies
    SELECT COUNT(*) INTO total_policies
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    SELECT COUNT(*) INTO unoptimized_policies
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND NOT (qual LIKE '%(select auth.%' OR with_check LIKE '%(select auth.%')
    AND (qual LIKE '%auth.%' OR with_check LIKE '%auth.%');
    
    -- Calculate optimization percentage
    IF total_policies > 0 THEN
        optimization_percentage := ROUND(((total_policies - unoptimized_policies)::NUMERIC / total_policies::NUMERIC) * 100, 2);
    ELSE
        optimization_percentage := 100;
    END IF;
    
    RAISE NOTICE '📊 STATISTICS:';
    RAISE NOTICE '  • Total RLS policies: %', total_policies;
    RAISE NOTICE '  • Policies still needing optimization: %', unoptimized_policies;
    RAISE NOTICE '  • Optimization coverage: %% %', optimization_percentage;
    RAISE NOTICE '';
    
    -- List tables that might still need attention
    IF unoptimized_policies > 0 THEN
        RAISE NOTICE '⚠️  Tables that may still need optimization:';
        FOR table_record IN
            SELECT DISTINCT tablename
            FROM pg_policies 
            WHERE schemaname = 'public' 
            AND NOT (qual LIKE '%(select auth.%' OR with_check LIKE '%(select auth.%')
            AND (qual LIKE '%auth.%' OR with_check LIKE '%auth.%')
            ORDER BY tablename
        LOOP
            RAISE NOTICE '    • %', table_record.tablename;
        END LOOP;
        RAISE NOTICE '';
    END IF;
    
    IF optimization_percentage >= 95 THEN
        RAISE NOTICE '🎉 EXCELLENT: Performance optimization is nearly complete!';
        RAISE NOTICE '📈 Expected performance improvements:';
        RAISE NOTICE '   • Significantly faster queries on large datasets';
        RAISE NOTICE '   • Reduced CPU usage for auth function evaluations';
        RAISE NOTICE '   • Better scalability as your data grows';
        RAISE NOTICE '   • Cleaner and more maintainable policy structure';
    ELSE
        RAISE NOTICE '⚠️  More optimization may be needed for optimal performance';
        RAISE NOTICE '🔧 Consider reviewing the policies listed above';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 SUMMARY: Complete Performance Optimization Finished';
    RAISE NOTICE '🎯 Run the monitoring queries to track ongoing performance';
    
END $$;

-- Create a quick performance check function
CREATE OR REPLACE FUNCTION check_rls_performance() RETURNS TABLE (
    table_name TEXT,
    policy_name TEXT,
    performance_status TEXT,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.tablename::TEXT,
        p.policyname::TEXT,
        CASE 
            WHEN p.qual LIKE '%(select auth.%' OR p.with_check LIKE '%(select auth.%' 
            THEN '✅ Optimized'::TEXT
            WHEN p.qual LIKE '%auth.%' OR p.with_check LIKE '%auth.%' 
            THEN '⚠️  Needs optimization'::TEXT
            ELSE '🔍 Review needed'::TEXT
        END as performance_status,
        CASE 
            WHEN p.qual LIKE '%(select auth.%' OR p.with_check LIKE '%(select auth.%' 
            THEN 'Already optimized'::TEXT
            WHEN p.qual LIKE '%auth.%' OR p.with_check LIKE '%auth.%' 
            THEN 'Replace auth.uid() with (select auth.uid())'::TEXT
            ELSE 'Manual review recommended'::TEXT
        END as recommendation
    FROM pg_policies p
    WHERE p.schemaname = 'public'
    ORDER BY p.tablename, p.policyname;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE '✅ Created function: check_rls_performance() - Use this to monitor optimization status';

SELECT 'Complete performance optimization finished' AS status; 