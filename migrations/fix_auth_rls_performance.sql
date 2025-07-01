-- Fix Auth RLS Performance Issues
-- This migration optimizes RLS policies to use (select auth.uid()) instead of auth.uid()
-- This prevents re-evaluation of auth functions for each row, significantly improving performance

DO $$
BEGIN
    RAISE NOTICE '🚀 Starting Auth RLS Performance Optimization...';
    RAISE NOTICE '📊 Target: Fix 66 RLS policies with performance issues';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 1: Categories Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing categories table policies...';
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view their own site's categories" ON public.categories;
    DROP POLICY IF EXISTS "Users can create categories for their sites" ON public.categories;
    DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
    DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;
    
    -- Create optimized policies with subqueries
    CREATE POLICY "Users can view their own site's categories" ON public.categories
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = categories.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can create categories for their sites" ON public.categories
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = categories.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can update their own categories" ON public.categories
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = categories.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can delete their own categories" ON public.categories
        FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = categories.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Categories policies optimized';
END $$;

-- ============================================================================
-- PART 2: Site Ownership Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing site_ownership table policies...';
    
    DROP POLICY IF EXISTS "Authenticated users can insert site ownership" ON public.site_ownership;
    DROP POLICY IF EXISTS "Users can update their own site ownership" ON public.site_ownership;
    DROP POLICY IF EXISTS "Users can delete their own site ownership" ON public.site_ownership;
    
    CREATE POLICY "Authenticated users can insert site ownership" ON public.site_ownership
        FOR INSERT WITH CHECK (user_id = (select auth.uid()));
    
    CREATE POLICY "Users can update their own site ownership" ON public.site_ownership
        FOR UPDATE USING (user_id = (select auth.uid()));
    
    CREATE POLICY "Users can delete their own site ownership" ON public.site_ownership
        FOR DELETE USING (user_id = (select auth.uid()));
    
    RAISE NOTICE '✅ Site ownership policies optimized';
END $$;

-- ============================================================================
-- PART 3: Task Categories Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing task_categories table policies...';
    
    DROP POLICY IF EXISTS "Users can view their own task categories" ON public.task_categories;
    DROP POLICY IF EXISTS "Users can manage their own task categories" ON public.task_categories;
    
    -- task_categories is a junction table, access site_id through tasks
    CREATE POLICY "Users can view their own task categories" ON public.task_categories
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.tasks t
                JOIN public.site_members sm ON sm.site_id = t.site_id
                WHERE t.id = task_categories.task_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can manage their own task categories" ON public.task_categories
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.tasks t
                JOIN public.site_members sm ON sm.site_id = t.site_id
                WHERE t.id = task_categories.task_id 
                AND sm.user_id = (select auth.uid())
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.tasks t
                JOIN public.site_members sm ON sm.site_id = t.site_id
                WHERE t.id = task_categories.task_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Task categories policies optimized';
END $$;

-- ============================================================================
-- PART 4: Task Comments Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing task_comments table policies...';
    
    DROP POLICY IF EXISTS "Users can view comments on tasks they have access to" ON public.task_comments;
    DROP POLICY IF EXISTS "Users can create comments on tasks they have access to" ON public.task_comments;
    DROP POLICY IF EXISTS "Users can update their own comments" ON public.task_comments;
    DROP POLICY IF EXISTS "Users can delete their own comments" ON public.task_comments;
    DROP POLICY IF EXISTS "Permitir a los usuarios leer comentarios de sus tareas o tareas" ON public.task_comments;
    
    CREATE POLICY "Users can view comments on tasks they have access to" ON public.task_comments
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.tasks t
                JOIN public.site_members sm ON sm.site_id = t.site_id
                WHERE t.id = task_comments.task_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can create comments on tasks they have access to" ON public.task_comments
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.tasks t
                JOIN public.site_members sm ON sm.site_id = t.site_id
                WHERE t.id = task_comments.task_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can update their own comments" ON public.task_comments
        FOR UPDATE USING (user_id = (select auth.uid()));
    
    CREATE POLICY "Users can delete their own comments" ON public.task_comments
        FOR DELETE USING (user_id = (select auth.uid()));
    
    RAISE NOTICE '✅ Task comments policies optimized';
END $$;

-- ============================================================================
-- PART 5: API Keys Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing api_keys table policies...';
    
    DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
    DROP POLICY IF EXISTS "Users can create their own API keys" ON public.api_keys;
    DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
    DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;
    
    CREATE POLICY "Users can view their own API keys" ON public.api_keys
        FOR SELECT USING (user_id = (select auth.uid()));
    
    CREATE POLICY "Users can create their own API keys" ON public.api_keys
        FOR INSERT WITH CHECK (user_id = (select auth.uid()));
    
    CREATE POLICY "Users can update their own API keys" ON public.api_keys
        FOR UPDATE USING (user_id = (select auth.uid()));
    
    CREATE POLICY "Users can delete their own API keys" ON public.api_keys
        FOR DELETE USING (user_id = (select auth.uid()));
    
    RAISE NOTICE '✅ API keys policies optimized';
END $$;

-- ============================================================================
-- PART 6: Site Members Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing site_members table policies...';
    
    DROP POLICY IF EXISTS "View site members" ON public.site_members;
    DROP POLICY IF EXISTS "Add site members" ON public.site_members;
    DROP POLICY IF EXISTS "Update site members" ON public.site_members;
    DROP POLICY IF EXISTS "Allow cascade deletions from auth.users" ON public.site_members;
    
    CREATE POLICY "View site members" ON public.site_members
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm2 
                WHERE sm2.site_id = site_members.site_id 
                AND sm2.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Add site members" ON public.site_members
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = site_members.site_id 
                AND sm.user_id = (select auth.uid()) 
                AND sm.role IN ('owner', 'admin')
            )
        );
    
    CREATE POLICY "Update site members" ON public.site_members
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = site_members.site_id 
                AND sm.user_id = (select auth.uid()) 
                AND sm.role IN ('owner', 'admin')
            )
        );
    
    CREATE POLICY "Allow cascade deletions from auth.users" ON public.site_members
        FOR DELETE USING (user_id = (select auth.uid()));
    
    RAISE NOTICE '✅ Site members policies optimized';
END $$;

-- ============================================================================
-- PART 7: Secure Tokens Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing secure_tokens table policies...';
    
    DROP POLICY IF EXISTS "Users can view their own tokens" ON public.secure_tokens;
    DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.secure_tokens;
    DROP POLICY IF EXISTS "Users can update their own tokens" ON public.secure_tokens;
    DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.secure_tokens;
    
    CREATE POLICY "Users can view their own tokens" ON public.secure_tokens
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = secure_tokens.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can insert their own tokens" ON public.secure_tokens
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = secure_tokens.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can update their own tokens" ON public.secure_tokens
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = secure_tokens.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can delete their own tokens" ON public.secure_tokens
        FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = secure_tokens.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Secure tokens policies optimized';
END $$;

-- ============================================================================
-- PART 8: Sales Table Policies
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing sales table policies...';
    
    DROP POLICY IF EXISTS "Users can view sales for their sites" ON public.sales;
    DROP POLICY IF EXISTS "Users can create sales for their sites" ON public.sales;
    DROP POLICY IF EXISTS "Users can update sales for their sites" ON public.sales;
    DROP POLICY IF EXISTS "Users can delete sales for their sites" ON public.sales;
    
    CREATE POLICY "Users can view sales for their sites" ON public.sales
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = sales.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can create sales for their sites" ON public.sales
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = sales.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can update sales for their sites" ON public.sales
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = sales.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    CREATE POLICY "Users can delete sales for their sites" ON public.sales
        FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = sales.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Sales policies optimized';
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICATION RESULTS';
    RAISE NOTICE '===================';
    
    -- Count policies with potential auth.uid() issues (this is a simplified check)
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND NOT (qual LIKE '%(select auth.uid())%' OR with_check LIKE '%(select auth.uid())%')
    AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%');
    
    RAISE NOTICE 'Policies that may still need optimization: %', policy_count;
    
    IF policy_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 SUCCESS: All targeted RLS policies optimized!';
        RAISE NOTICE '📈 Expected performance improvements:';
        RAISE NOTICE '   • Faster queries on large datasets';
        RAISE NOTICE '   • Reduced CPU usage for auth function calls';
        RAISE NOTICE '   • Better scalability with growing data';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Some policies may still need manual optimization';
        RAISE NOTICE '🔧 Check remaining policies and optimize as needed';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 SUMMARY: Auth RLS Performance Optimization Complete';
    RAISE NOTICE '🎯 Next: Run multiple policies and duplicate index fixes';
    
END $$;

SELECT 'Auth RLS performance optimization completed' AS status; 