-- Master Script: Run All Database Linter Warning Fixes
-- This script executes all the migrations needed to fix database linter warnings
-- Run this script to fix all 71 warnings at once

DO $$
BEGIN
    RAISE NOTICE '🚀 Starting comprehensive database linter warning fixes...';
    RAISE NOTICE '📊 Target: Fix all 71 database linter warnings';
    RAISE NOTICE '';
    RAISE NOTICE '=== MIGRATION PLAN ===';
    RAISE NOTICE '1. Fix function search_path warnings (Phase 1)';
    RAISE NOTICE '2. Move extensions from public schema';
    RAISE NOTICE '3. Configure search_path permanently';
    RAISE NOTICE '4. Fix remaining function warnings (Phase 2)';
    RAISE NOTICE '5. Fix pg_net extension specifically';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PHASE 1: Fix Function Search Path Warnings (First Pass)
-- ============================================================================

RAISE NOTICE '🔧 PHASE 1: Fixing function search_path warnings (first pass)...';

-- Include the content from fix_function_search_path_warnings.sql
-- (The actual content would be embedded here, but for clarity we'll reference it)

\echo 'Executing fix_function_search_path_warnings.sql...'
\i migrations/fix_function_search_path_warnings.sql

-- ============================================================================
-- PHASE 2: Move Extensions from Public Schema
-- ============================================================================

RAISE NOTICE '📦 PHASE 2: Moving extensions from public schema...';

\echo 'Executing fix_extension_security_warnings.sql...'
\i migrations/fix_extension_security_warnings.sql

-- ============================================================================
-- PHASE 3: Configure Search Path Permanently
-- ============================================================================

RAISE NOTICE '⚙️ PHASE 3: Configuring search_path permanently...';

\echo 'Executing configure_search_path.sql...'
\i migrations/configure_search_path.sql

-- ============================================================================
-- PHASE 4: Fix Remaining Function Warnings
-- ============================================================================

RAISE NOTICE '🎯 PHASE 4: Fixing remaining function warnings...';

\echo 'Executing fix_remaining_function_warnings.sql...'
\i migrations/fix_remaining_function_warnings.sql

-- ============================================================================
-- PHASE 5: Fix pg_net Extension Specifically
-- ============================================================================

RAISE NOTICE '🔧 PHASE 5: Fixing pg_net extension location...';

\echo 'Executing fix_pg_net_extension.sql...'
\i migrations/fix_pg_net_extension.sql

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$
DECLARE
    function_count INTEGER;
    extension_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ FINAL VERIFICATION:';
    
    -- Check remaining functions without search_path
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid  
    WHERE n.nspname = 'public'
    AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
    AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) as config 
        WHERE config LIKE 'search_path=%'
    ));
    
    RAISE NOTICE 'Functions still without search_path: %', function_count;
    
    -- Check extensions in public schema
    SELECT COUNT(*) INTO extension_count
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE n.nspname = 'public'
    AND e.extname IN ('pg_trgm', 'pg_net');
    
    RAISE NOTICE 'Extensions still in public schema: %', extension_count;
    
    -- Final status
    IF function_count = 0 AND extension_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 SUCCESS: All database warnings should now be fixed!';
        RAISE NOTICE '';
        RAISE NOTICE '📋 SUMMARY:';
        RAISE NOTICE '✅ Function search_path warnings: FIXED';
        RAISE NOTICE '✅ Extension security warnings: FIXED';
        RAISE NOTICE '⚠️  Auth password protection: MANUAL CONFIG REQUIRED';
        RAISE NOTICE '';
        RAISE NOTICE '📖 Next Steps:';
        RAISE NOTICE '1. Go to your Supabase Dashboard';
        RAISE NOTICE '2. Navigate to Authentication > Settings';
        RAISE NOTICE '3. Enable "Leaked Password Protection"';
        RAISE NOTICE '';
        RAISE NOTICE '🎯 Expected Result: 0 database linter warnings!';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Some warnings may still remain:';
        IF function_count > 0 THEN
            RAISE NOTICE '- % functions still need search_path configuration', function_count;
        END IF;
        IF extension_count > 0 THEN
            RAISE NOTICE '- % extensions still in public schema', extension_count;
        END IF;
        RAISE NOTICE '';
        RAISE NOTICE '🔧 You may need to run individual migrations manually';
        RAISE NOTICE '📖 Check the migration logs above for specific errors';
    END IF;
    
END $$;

-- Success message
SELECT 'Database linter warning fixes completed - Check notices above for results' AS final_status; 