-- GENERATE RLS FIXES SCRIPT
-- Automatically generates fix scripts for tables with RLS conflicts
-- Based on the pattern used for allowed_domains

-- ============================================================================
-- SCRIPT GENERATOR FOR TABLES WITH SITE_ID PATTERN
-- ============================================================================

DO $$
DECLARE
    table_name TEXT;
    fix_script TEXT;
    policy_names TEXT[];
    policy_name TEXT;
BEGIN
    RAISE NOTICE '🔧 GENERATING FIX SCRIPTS FOR PROBLEMATIC TABLES';
    RAISE NOTICE '================================================================';
    
    -- Loop through tables with multiple policies that have site_id column
    FOR table_name IN
        SELECT DISTINCT p.tablename
        FROM pg_policies p
        WHERE p.schemaname = 'public'
        AND p.tablename IN (
            SELECT tablename 
            FROM pg_policies 
            WHERE schemaname = 'public'
            GROUP BY tablename 
            HAVING COUNT(*) > 1
        )
        AND EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = p.tablename
            AND c.column_name = 'site_id'
        )
        ORDER BY p.tablename
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '🔧 TABLE: %', table_name;
        RAISE NOTICE '================================================================';
        
        -- Get all policy names for this table
        SELECT array_agg(policyname) INTO policy_names
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = table_name;
        
        -- Generate DROP statements
        RAISE NOTICE '-- FIX % RLS POLICY', upper(table_name);
        RAISE NOTICE '-- Drop all existing conflicting policies';
        FOREACH policy_name IN ARRAY policy_names
        LOOP
            RAISE NOTICE 'DROP POLICY IF EXISTS "%" ON %;', policy_name, table_name;
        END LOOP;
        
        RAISE NOTICE '';
        RAISE NOTICE '-- Create single optimized policy for %', table_name;
        RAISE NOTICE 'CREATE POLICY "%_access_policy" ON %', table_name, table_name;
        RAISE NOTICE 'FOR ALL';
        RAISE NOTICE 'TO authenticated';
        RAISE NOTICE 'USING (';
        RAISE NOTICE '  site_id IN (';
        RAISE NOTICE '    SELECT site_id FROM site_ownership WHERE user_id = (SELECT auth.uid())';
        RAISE NOTICE '    UNION';
        RAISE NOTICE '    SELECT site_id FROM site_members';
        RAISE NOTICE '    WHERE user_id = (SELECT auth.uid()) AND status = ''active''';
        RAISE NOTICE '  )';
        RAISE NOTICE ')';
        RAISE NOTICE 'WITH CHECK (';
        RAISE NOTICE '  site_id IN (';
        RAISE NOTICE '    SELECT site_id FROM site_ownership WHERE user_id = (SELECT auth.uid())';
        RAISE NOTICE '    UNION';
        RAISE NOTICE '    SELECT site_id FROM site_members';
        RAISE NOTICE '    WHERE user_id = (SELECT auth.uid()) AND status = ''active''';
        RAISE NOTICE '  )';
        RAISE NOTICE ');';
        RAISE NOTICE '';
        RAISE NOTICE 'ALTER TABLE % ENABLE ROW LEVEL SECURITY;', table_name;
        RAISE NOTICE 'GRANT SELECT, INSERT, UPDATE, DELETE ON % TO authenticated;', table_name;
        RAISE NOTICE 'CREATE INDEX IF NOT EXISTS idx_%_site_id ON %(site_id);', table_name, table_name;
        RAISE NOTICE '';
    END LOOP;
END $$;

-- ============================================================================
-- SCRIPT GENERATOR FOR USER_ID PATTERN TABLES
-- ============================================================================

DO $$
DECLARE
    table_name TEXT;
    policy_names TEXT[];
    policy_name TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '👤 GENERATING FIX SCRIPTS FOR USER_ID PATTERN TABLES';
    RAISE NOTICE '================================================================';
    
    -- Loop through tables with multiple policies that have user_id column but no site_id
    FOR table_name IN
        SELECT DISTINCT p.tablename
        FROM pg_policies p
        WHERE p.schemaname = 'public'
        AND p.tablename IN (
            SELECT tablename 
            FROM pg_policies 
            WHERE schemaname = 'public'
            GROUP BY tablename 
            HAVING COUNT(*) > 1
        )
        AND EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = p.tablename
            AND c.column_name = 'user_id'
        )
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = p.tablename
            AND c.column_name = 'site_id'
        )
        ORDER BY p.tablename
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '🔧 TABLE: % (USER_ID PATTERN)', table_name;
        RAISE NOTICE '================================================================';
        
        -- Get all policy names for this table
        SELECT array_agg(policyname) INTO policy_names
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = table_name;
        
        -- Generate DROP statements
        RAISE NOTICE '-- FIX % RLS POLICY (User-owned pattern)', upper(table_name);
        RAISE NOTICE '-- Drop all existing conflicting policies';
        FOREACH policy_name IN ARRAY policy_names
        LOOP
            RAISE NOTICE 'DROP POLICY IF EXISTS "%" ON %;', policy_name, table_name;
        END LOOP;
        
        RAISE NOTICE '';
        RAISE NOTICE '-- Create single optimized policy for %', table_name;
        RAISE NOTICE 'CREATE POLICY "%_user_access_policy" ON %', table_name, table_name;
        RAISE NOTICE 'FOR ALL';
        RAISE NOTICE 'TO authenticated';
        RAISE NOTICE 'USING (user_id = (SELECT auth.uid()))';
        RAISE NOTICE 'WITH CHECK (user_id = (SELECT auth.uid()));';
        RAISE NOTICE '';
        RAISE NOTICE 'ALTER TABLE % ENABLE ROW LEVEL SECURITY;', table_name;
        RAISE NOTICE 'GRANT SELECT, INSERT, UPDATE, DELETE ON % TO authenticated;', table_name;
        RAISE NOTICE 'CREATE INDEX IF NOT EXISTS idx_%_user_id ON %(user_id);', table_name, table_name;
        RAISE NOTICE '';
    END LOOP;
END $$;

-- ============================================================================
-- GENERATE COMPLETE FIX SCRIPT FILE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📝 COPY THE ABOVE GENERATED SCRIPTS TO INDIVIDUAL .sql FILES';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'INSTRUCTIONS:';
    RAISE NOTICE '1. Copy each table''s generated script to a separate file';
    RAISE NOTICE '2. Test each script on a backup/staging environment first';
    RAISE NOTICE '3. Apply scripts one by one to production';
    RAISE NOTICE '4. Verify operations work after each script';
    RAISE NOTICE '5. Monitor performance and adjust indexes if needed';
    RAISE NOTICE '';
    RAISE NOTICE '🚨 IMPORTANT: Always backup before applying these changes!';
END $$; 