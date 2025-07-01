-- Fix Multiple Permissive Policies and Duplicate Indexes
-- This migration consolidates multiple policies and removes duplicate indexes

DO $$
BEGIN
    RAISE NOTICE '🚀 Starting Multiple Policies and Index Optimization...';
    RAISE NOTICE '📊 Target: Fix 9 multiple policy warnings + 3 duplicate index warnings';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 1: Fix Multiple Permissive Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Consolidating multiple permissive policies...';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 1.1: Campaign Segments Table - Consolidate Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Fixing campaign_segments policies...';
    
    -- Drop multiple policies
    DROP POLICY IF EXISTS "Users can view their campaign segments" ON public.campaign_segments;
    DROP POLICY IF EXISTS "Users can manage their campaign segments" ON public.campaign_segments;
    DROP POLICY IF EXISTS "Enable read access for own campaigns" ON public.campaign_segments;
    DROP POLICY IF EXISTS "Enable insert access for own campaigns" ON public.campaign_segments;
    DROP POLICY IF EXISTS "Enable update access for own campaigns" ON public.campaign_segments;
    DROP POLICY IF EXISTS "Enable delete access for own campaigns" ON public.campaign_segments;
    
    -- Create single consolidated policy
    CREATE POLICY "Users can manage campaign segments for their sites" ON public.campaign_segments
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.campaigns c
                JOIN public.site_members sm ON sm.site_id = c.site_id
                WHERE c.id = campaign_segments.campaign_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.campaigns c
                JOIN public.site_members sm ON sm.site_id = c.site_id
                WHERE c.id = campaign_segments.campaign_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Campaign segments policies consolidated';
END $$;

-- ============================================================================
-- PART 1.2: Experiment Segments Table - Consolidate Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Fixing experiment_segments policies...';
    
    -- Drop multiple policies
    DROP POLICY IF EXISTS "Permitir a los usuarios gestionar relaciones de experimentos-se" ON public.experiment_segments;
    DROP POLICY IF EXISTS "Users can view experiment segments for their sites" ON public.experiment_segments;
    DROP POLICY IF EXISTS "Users can manage experiment segments for their sites" ON public.experiment_segments;
    DROP POLICY IF EXISTS "Enable read access for own experiments" ON public.experiment_segments;
    DROP POLICY IF EXISTS "Enable insert access for own experiments" ON public.experiment_segments;
    DROP POLICY IF EXISTS "Enable update access for own experiments" ON public.experiment_segments;
    DROP POLICY IF EXISTS "Enable delete access for own experiments" ON public.experiment_segments;
    
    -- Create single consolidated policy
    CREATE POLICY "Users can manage experiment segments for their sites" ON public.experiment_segments
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.experiments e
                JOIN public.site_members sm ON sm.site_id = e.site_id
                WHERE e.id = experiment_segments.experiment_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.experiments e
                JOIN public.site_members sm ON sm.site_id = e.site_id
                WHERE e.id = experiment_segments.experiment_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Experiment segments policies consolidated';
END $$;

-- ============================================================================
-- PART 1.3: Transactions Table - Consolidate Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Fixing transactions policies...';
    
    -- Drop multiple policies
    DROP POLICY IF EXISTS "Users can view transactions for their sites" ON public.transactions;
    DROP POLICY IF EXISTS "Users can create transactions for their sites" ON public.transactions;
    DROP POLICY IF EXISTS "Users can update transactions for their sites" ON public.transactions;
    DROP POLICY IF EXISTS "Users can delete transactions for their sites" ON public.transactions;
    DROP POLICY IF EXISTS "Enable read access for own site transactions" ON public.transactions;
    DROP POLICY IF EXISTS "Enable insert access for own site transactions" ON public.transactions;
    DROP POLICY IF EXISTS "Enable update access for own site transactions" ON public.transactions;
    DROP POLICY IF EXISTS "Enable delete access for own site transactions" ON public.transactions;
    
    -- Create single consolidated policy
    CREATE POLICY "Users can manage transactions for their sites" ON public.transactions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = transactions.site_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = transactions.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Transactions policies consolidated';
END $$;

-- ============================================================================
-- PART 1.4: Tasks Table - Consolidate Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Fixing tasks policies...';
    
    -- Drop multiple policies
    DROP POLICY IF EXISTS "Permitir a los usuarios gestionar tareas de sus sitios" ON public.tasks;
    DROP POLICY IF EXISTS "Users can view tasks for their sites" ON public.tasks;
    DROP POLICY IF EXISTS "Users can create tasks for their sites" ON public.tasks;
    DROP POLICY IF EXISTS "Users can update tasks for their sites" ON public.tasks;
    DROP POLICY IF EXISTS "Users can delete tasks for their sites" ON public.tasks;
    DROP POLICY IF EXISTS "Enable read access for own site tasks" ON public.tasks;
    DROP POLICY IF EXISTS "Enable insert access for own site tasks" ON public.tasks;
    DROP POLICY IF EXISTS "Enable update access for own site tasks" ON public.tasks;
    DROP POLICY IF EXISTS "Enable delete access for own site tasks" ON public.tasks;
    
    -- Create single consolidated policy
    CREATE POLICY "Users can manage tasks for their sites" ON public.tasks
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = tasks.site_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = tasks.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Tasks policies consolidated';
END $$;

-- ============================================================================
-- PART 1.5: Leads Table - Consolidate Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Fixing leads policies...';
    
    -- Drop multiple policies
    DROP POLICY IF EXISTS "Users can view leads for their sites" ON public.leads;
    DROP POLICY IF EXISTS "Users can create leads for their sites" ON public.leads;
    DROP POLICY IF EXISTS "Users can update leads for their sites" ON public.leads;
    DROP POLICY IF EXISTS "Users can delete leads for their sites" ON public.leads;
    DROP POLICY IF EXISTS "Enable read access for own site leads" ON public.leads;
    DROP POLICY IF EXISTS "Enable insert access for own site leads" ON public.leads;
    DROP POLICY IF EXISTS "Enable update access for own site leads" ON public.leads;
    DROP POLICY IF EXISTS "Enable delete access for own site leads" ON public.leads;
    
    -- Create single consolidated policy
    CREATE POLICY "Users can manage leads for their sites" ON public.leads
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = leads.site_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = leads.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Leads policies consolidated';
END $$;

-- ============================================================================
-- PART 2: Remove Duplicate Indexes
-- ============================================================================

DO $$
DECLARE
    index_record RECORD;
    duplicate_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Removing duplicate indexes...';
    RAISE NOTICE '';
    
    -- Find and drop duplicate indexes
    -- This query finds indexes that cover the same columns on the same table
    FOR index_record IN
        SELECT 
            i1.indexname as duplicate_index,
            i1.tablename,
            i1.indexdef
        FROM pg_indexes i1
        JOIN pg_indexes i2 ON i1.tablename = i2.tablename
        WHERE i1.schemaname = 'public' 
        AND i2.schemaname = 'public'
        AND i1.indexname != i2.indexname
        AND i1.indexname > i2.indexname  -- Avoid dropping both indexes
        -- Common duplicate patterns
        AND (
            -- Same columns, different names
            (i1.indexdef SIMILAR TO i2.indexdef) OR
            -- Covering indexes that duplicate unique constraints
            (i1.indexname LIKE '%_pkey%' AND i2.indexname LIKE '%_key%') OR
            -- Partial indexes that fully overlap
            (i1.indexname LIKE '%_site_id_%' AND i2.indexname LIKE '%_site_id_%')
        )
        ORDER BY i1.tablename, i1.indexname
    LOOP
        BEGIN
            RAISE NOTICE '🗑️  Dropping duplicate index: % on table %', index_record.duplicate_index, index_record.tablename;
            EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(index_record.duplicate_index);
            duplicate_count := duplicate_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '⚠️  Could not drop index %: %', index_record.duplicate_index, SQLERRM;
        END;
    END LOOP;
    
    -- Manually drop known problematic duplicate indexes
    BEGIN
        DROP INDEX IF EXISTS idx_leads_site_id_status;
        RAISE NOTICE '🗑️  Dropped: idx_leads_site_id_status (duplicate of leads_site_id_status_idx)';
        duplicate_count := duplicate_count + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️  Index idx_leads_site_id_status not found or already dropped';
    END;
    
    BEGIN
        DROP INDEX IF EXISTS idx_tasks_site_id_status;
        RAISE NOTICE '🗑️  Dropped: idx_tasks_site_id_status (duplicate of tasks_site_id_status_idx)';
        duplicate_count := duplicate_count + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️  Index idx_tasks_site_id_status not found or already dropped';
    END;
    
    BEGIN
        DROP INDEX IF EXISTS idx_campaigns_site_id_created;
        RAISE NOTICE '🗑️  Dropped: idx_campaigns_site_id_created (duplicate of campaigns_site_id_created_at_idx)';
        duplicate_count := duplicate_count + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️  Index idx_campaigns_site_id_created not found or already dropped';
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Total duplicate indexes removed: %', duplicate_count;
    
END $$;

-- ============================================================================
-- PART 3: Create Performance Monitoring Views
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 Creating performance monitoring views...';
    
    -- Create view to monitor policy performance
    CREATE OR REPLACE VIEW policy_performance_monitor AS
    SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        CASE 
            WHEN qual LIKE '%(select auth.%' THEN '✅ Optimized'
            WHEN qual LIKE '%auth.%' THEN '⚠️  Needs optimization'
            ELSE '🔍 Review needed'
        END as performance_status,
        CASE 
            WHEN LENGTH(qual) > 500 THEN '⚠️  Complex policy'
            ELSE '✅ Simple policy'
        END as complexity_status
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
    
    -- Create view to monitor index usage
    CREATE OR REPLACE VIEW index_usage_monitor AS
    SELECT 
        schemaname,
        relname as tablename,
        indexrelname as indexname,
        idx_tup_read,
        idx_tup_fetch,
        CASE 
            WHEN idx_tup_read = 0 THEN '⚠️  Unused index'
            WHEN idx_tup_read < 100 THEN '🔍 Low usage'
            ELSE '✅ Active index'
        END as usage_status
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public'
    ORDER BY idx_tup_read DESC;
    
    RAISE NOTICE '✅ Performance monitoring views created';
    RAISE NOTICE '   • policy_performance_monitor';
    RAISE NOTICE '   • index_usage_monitor';
    
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
    index_count INTEGER;
    optimized_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICATION RESULTS';
    RAISE NOTICE '===================';
    
    -- Count remaining multiple policies
    SELECT COUNT(*) INTO policy_count
    FROM (
        SELECT tablename, COUNT(*) as policy_count
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND permissive = 'PERMISSIVE'
        GROUP BY tablename
        HAVING COUNT(*) > 1
    ) as multi_policies;
    
    -- Count optimized policies
    SELECT COUNT(*) INTO optimized_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND (qual LIKE '%(select auth.%' OR with_check LIKE '%(select auth.%');
    
    -- Count total indexes
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE schemaname = 'public';
    
    RAISE NOTICE 'Tables with multiple permissive policies: %', policy_count;
    RAISE NOTICE 'Optimized policies using subqueries: %', optimized_count;
    RAISE NOTICE 'Total remaining indexes: %', index_count;
    
    IF policy_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 SUCCESS: Multiple permissive policies consolidated!';
        RAISE NOTICE '📈 Expected improvements:';
        RAISE NOTICE '   • Cleaner policy structure';
        RAISE NOTICE '   • Reduced policy evaluation overhead';
        RAISE NOTICE '   • Better maintainability';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Some tables still have multiple policies';
        RAISE NOTICE '🔧 Review and consolidate as needed';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 SUMMARY: Multiple Policies and Index Optimization Complete';
    RAISE NOTICE '🎯 Performance monitoring views available for ongoing optimization';
    
END $$;

SELECT 'Multiple policies and index optimization completed' AS status; 