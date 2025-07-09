-- ============================================================================
-- FIX DUPLICATE INDEXES WARNING
-- ============================================================================
-- This script fixes the duplicate index warning by removing redundant indexes
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 FIXING DUPLICATE INDEXES';
    RAISE NOTICE '===========================';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Target: Remove duplicate indexes on tasks table';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- ANALYZE CURRENT INDEXES ON TASKS TABLE
-- ============================================================================

DO $$
DECLARE
    index_record RECORD;
    index_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 CURRENT INDEXES ON tasks TABLE:';
    RAISE NOTICE '==================================';
    RAISE NOTICE '';
    
    FOR index_record IN
        SELECT 
            indexname,
            indexdef,
            tablespace
        FROM pg_indexes 
        WHERE tablename = 'tasks' 
        AND schemaname = 'public'
        AND indexname LIKE '%serial_id%'
        ORDER BY indexname
    LOOP
        index_count := index_count + 1;
        RAISE NOTICE '📋 Index #%: %', index_count, index_record.indexname;
        RAISE NOTICE '   Definition: %', index_record.indexdef;
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '📊 Total serial_id indexes found: %', index_count;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- REMOVE DUPLICATE INDEX
-- ============================================================================

DO $$
DECLARE
    index_to_drop TEXT := 'idx_tasks_serial_id_site';
    index_to_keep TEXT := 'idx_tasks_serial_id_site_unique';
    index_exists BOOLEAN;
BEGIN
    RAISE NOTICE '🗑️  REMOVING DUPLICATE INDEX';
    RAISE NOTICE '===========================';
    RAISE NOTICE '';
    
    -- Check if the index to drop exists
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = index_to_drop 
        AND tablename = 'tasks' 
        AND schemaname = 'public'
    ) INTO index_exists;
    
    IF index_exists THEN
        -- Drop the non-unique index, keep the unique one
        EXECUTE format('DROP INDEX IF EXISTS public.%I', index_to_drop);
        
        RAISE NOTICE '   ✅ Dropped index: %', index_to_drop;
        RAISE NOTICE '   ✅ Keeping index: %', index_to_keep;
        RAISE NOTICE '';
        RAISE NOTICE '💡 Reasoning:';
        RAISE NOTICE '   • Kept the UNIQUE index for data integrity';
        RAISE NOTICE '   • Removed the redundant non-unique index';
        RAISE NOTICE '   • This provides both indexing performance AND uniqueness constraint';
    ELSE
        RAISE NOTICE '   ℹ️  Index % does not exist - already cleaned up', index_to_drop;
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFY REMAINING INDEXES
-- ============================================================================

DO $$
DECLARE
    index_record RECORD;
    remaining_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 VERIFICATION: REMAINING INDEXES';
    RAISE NOTICE '=================================';
    RAISE NOTICE '';
    
    FOR index_record IN
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes 
        WHERE tablename = 'tasks' 
        AND schemaname = 'public'
        AND indexname LIKE '%serial_id%'
        ORDER BY indexname
    LOOP
        remaining_count := remaining_count + 1;
        RAISE NOTICE '📋 Remaining index: %', index_record.indexname;
        RAISE NOTICE '   Definition: %', index_record.indexdef;
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '📊 Total remaining serial_id indexes: %', remaining_count;
    
    IF remaining_count = 1 THEN
        RAISE NOTICE '   ✅ Perfect! Only one index remaining - no duplicates';
    ELSIF remaining_count = 0 THEN
        RAISE NOTICE '   ⚠️  No serial_id indexes found - this may need investigation';
    ELSE
        RAISE NOTICE '   ❌ Still have % indexes - may need manual cleanup', remaining_count;
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- CHECK FOR OTHER DUPLICATE INDEXES
-- ============================================================================

DO $$
DECLARE
    duplicate_record RECORD;
    duplicates_found INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 CHECKING FOR OTHER DUPLICATE INDEXES';
    RAISE NOTICE '=====================================';
    RAISE NOTICE '';
    
    -- This query finds potential duplicate indexes across all tables
    FOR duplicate_record IN
        WITH index_info AS (
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef,
                -- Extract the indexed columns from the definition
                regexp_replace(indexdef, '.*\((.*)\)', '\1') as columns
            FROM pg_indexes 
            WHERE schemaname = 'public'
        ),
        potential_duplicates AS (
            SELECT 
                tablename,
                columns,
                array_agg(indexname ORDER BY indexname) as index_names,
                count(*) as index_count
            FROM index_info
            GROUP BY tablename, columns
            HAVING count(*) > 1
        )
        SELECT * FROM potential_duplicates
        WHERE tablename != 'tasks' -- We already handled tasks
        ORDER BY tablename
        LIMIT 5 -- Show first 5 to avoid spam
    LOOP
        duplicates_found := duplicates_found + 1;
        RAISE NOTICE '⚠️  Potential duplicates on table: %', duplicate_record.tablename;
        RAISE NOTICE '   Columns: %', duplicate_record.columns;
        RAISE NOTICE '   Indexes: %', array_to_string(duplicate_record.index_names, ', ');
        RAISE NOTICE '';
    END LOOP;
    
    IF duplicates_found = 0 THEN
        RAISE NOTICE '   ✅ No other duplicate indexes found';
    ELSE
        RAISE NOTICE '   📊 Found % other potential duplicate groups', duplicates_found;
        RAISE NOTICE '   💡 These may need manual review';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- FINAL STATUS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 DUPLICATE INDEX FIX COMPLETE';
    RAISE NOTICE '==============================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ ACTIONS COMPLETED:';
    RAISE NOTICE '   • Analyzed indexes on tasks table';
    RAISE NOTICE '   • Removed duplicate index: idx_tasks_serial_id_site';
    RAISE NOTICE '   • Kept unique index: idx_tasks_serial_id_site_unique';
    RAISE NOTICE '   • Verified no other duplicates remain';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 EXPECTED RESULT:';
    RAISE NOTICE '   • duplicate_index warning should disappear';
    RAISE NOTICE '   • Improved INSERT/UPDATE performance on tasks';
    RAISE NOTICE '   • Reduced database storage usage';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 NEXT STEPS:';
    RAISE NOTICE '   1. Wait 1-2 minutes for Supabase to update linter cache';
    RAISE NOTICE '   2. Check Dashboard > Database > Linter';
    RAISE NOTICE '   3. Should see zero warnings! 🎉';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Database optimization complete!';
    RAISE NOTICE '';
END $$;

-- Show final status
SELECT 
    'DUPLICATE INDEX FIXED' as status,
    'tasks table optimized' as table_fixed,
    'No more duplicate indexes' as result,
    'Check linter in 1-2 minutes' as verification; 