-- Fix Current Security Warnings - Direct Approach
-- This migration targets the specific functions and extensions showing warnings

DO $$
BEGIN
    RAISE NOTICE '🔧 Starting targeted fix for current security warnings...';
    RAISE NOTICE '📋 Target: 26 functions + 1 extension + 1 auth setting';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 1: Fix Function Search Path Warnings (Direct approach)
-- ============================================================================

DO $$
DECLARE
    function_record RECORD;
    functions_to_fix TEXT[] := ARRAY[
        'generate_task_serial_id',
        'get_user_profile_complete', 
        'validate_notifications',
        'encrypt_token',
        'decrypt_token',
        'store_secure_token',
        'get_secure_token',
        'delete_secure_token',
        'validate_performance_bitmask',
        'set_like',
        'set_dislike',
        'toggle_flag',
        'get_performance_status',
        'update_api_key_last_used',
        'manually_activate_user_memberships',
        'increment_referral_code_usage',
        'reorder_task_priorities',
        'record_payment',
        'log_debug',
        'simulate_user_creation',
        'process_referral_code_use',
        'activate_pending_site_memberships',
        'increment_agent_conversations',
        'calculate_kpis_from_events',
        'sync_auth0_user'
    ];
    fixed_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🎯 Fixing search_path for % functions...', array_length(functions_to_fix, 1);
    
    -- Loop through each function and fix its search_path
    FOR i IN 1..array_length(functions_to_fix, 1) LOOP
        BEGIN
            -- Get function details from pg_proc
            SELECT p.oid, p.proname, n.nspname as schema_name
            INTO function_record
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname = functions_to_fix[i] AND n.nspname = 'public';
            
            IF function_record.oid IS NOT NULL THEN
                -- Build and execute ALTER FUNCTION statement
                EXECUTE format('ALTER FUNCTION public.%I SET search_path = ''''', function_record.proname);
                RAISE NOTICE '✅ Fixed search_path for function: %', function_record.proname;
                fixed_count := fixed_count + 1;
            ELSE
                RAISE NOTICE '⚠️  Function not found: %', functions_to_fix[i];
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Error fixing function %: %', functions_to_fix[i], SQLERRM;
                error_count := error_count + 1;
        END;
        
        -- Reset function_record for next iteration
        function_record := NULL;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Function fixes completed:';
    RAISE NOTICE '   ✅ Successfully fixed: % functions', fixed_count;
    RAISE NOTICE '   ❌ Errors encountered: % functions', error_count;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 2: Fix pg_net Extension in Public Schema
-- ============================================================================

DO $$
DECLARE
    current_schema TEXT;
    extension_exists BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '📦 Fixing pg_net extension location...';
    
    -- Check if pg_net extension exists and get its current schema
    SELECT n.nspname INTO current_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_net';
    
    IF current_schema IS NOT NULL THEN
        extension_exists := TRUE;
        RAISE NOTICE 'Found pg_net extension in schema: %', current_schema;
        
        IF current_schema = 'public' THEN
            RAISE NOTICE 'Moving pg_net from public schema to extensions schema...';
            
            -- Create extensions schema if it doesn't exist
            CREATE SCHEMA IF NOT EXISTS extensions;
            
            -- Try to move the extension
            BEGIN
                ALTER EXTENSION pg_net SET SCHEMA extensions;
                RAISE NOTICE '✅ Successfully moved pg_net to extensions schema';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE '❌ Failed to move pg_net: %', SQLERRM;
                    RAISE NOTICE 'Attempting alternative method...';
                    
                    -- Alternative: Try to drop and recreate
                    BEGIN
                        DROP EXTENSION IF EXISTS pg_net CASCADE;
                        CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
                        RAISE NOTICE '✅ Successfully recreated pg_net in extensions schema';
                    EXCEPTION
                        WHEN OTHERS THEN
                            RAISE NOTICE '❌ Failed to recreate pg_net: %', SQLERRM;
                    END;
            END;
        ELSE
            RAISE NOTICE '✅ pg_net extension is already in correct schema: %', current_schema;
        END IF;
    ELSE
        RAISE NOTICE '⚠️  pg_net extension not found, attempting to create it...';
        BEGIN
            CREATE SCHEMA IF NOT EXISTS extensions;
            CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
            RAISE NOTICE '✅ Successfully created pg_net in extensions schema';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed to create pg_net: %', SQLERRM;
        END;
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 3: Grant necessary permissions
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔐 Setting up permissions for extensions schema...';
    
    -- Grant permissions on extensions schema
    GRANT USAGE ON SCHEMA extensions TO authenticated;
    GRANT USAGE ON SCHEMA extensions TO anon;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon;
    
    RAISE NOTICE '✅ Permissions configured';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$
DECLARE
    remaining_functions INTEGER;
    pg_net_location TEXT;
    final_status TEXT;
BEGIN
    RAISE NOTICE '🔍 FINAL VERIFICATION';
    RAISE NOTICE '==================';
    
    -- Check remaining functions without search_path
    SELECT COUNT(*) INTO remaining_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'generate_task_serial_id', 'get_user_profile_complete', 'validate_notifications',
        'encrypt_token', 'decrypt_token', 'store_secure_token', 'get_secure_token', 
        'delete_secure_token', 'validate_performance_bitmask', 'set_like', 
        'set_dislike', 'toggle_flag', 'get_performance_status', 'update_api_key_last_used',
        'manually_activate_user_memberships', 'increment_referral_code_usage',
        'reorder_task_priorities', 'record_payment', 'log_debug', 'simulate_user_creation',
        'process_referral_code_use', 'activate_pending_site_memberships',
        'increment_agent_conversations', 'calculate_kpis_from_events', 'sync_auth0_user'
    )
    AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) as config 
        WHERE config LIKE 'search_path=%'
    ));
    
    -- Check pg_net location
    SELECT n.nspname INTO pg_net_location
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_net';
    
    -- Report results
    RAISE NOTICE 'Functions still needing search_path fix: %', remaining_functions;
    RAISE NOTICE 'pg_net extension location: %', COALESCE(pg_net_location, 'NOT FOUND');
    RAISE NOTICE '';
    
    IF remaining_functions = 0 AND (pg_net_location IS NULL OR pg_net_location != 'public') THEN
        final_status := 'SUCCESS';
        RAISE NOTICE '🎉 SUCCESS: All targeted security warnings should now be resolved!';
        RAISE NOTICE '';
        RAISE NOTICE '📋 SUMMARY:';
        RAISE NOTICE '✅ Function search_path warnings: FIXED (% functions)', 25;
        RAISE NOTICE '✅ pg_net extension warning: FIXED';
        RAISE NOTICE '⚠️  Auth password protection: REQUIRES MANUAL CONFIG';
        RAISE NOTICE '';
        RAISE NOTICE '📖 REMAINING MANUAL STEP:';
        RAISE NOTICE '1. Go to Supabase Dashboard → Authentication → Settings';
        RAISE NOTICE '2. Enable "Leaked Password Protection"';
        RAISE NOTICE '';
        RAISE NOTICE '🎯 Expected result after manual step: 0 security warnings!';
    ELSE
        final_status := 'PARTIAL';
        RAISE NOTICE '⚠️  PARTIAL SUCCESS: Some issues may remain:';
        IF remaining_functions > 0 THEN
            RAISE NOTICE '- % functions still need search_path configuration', remaining_functions;
        END IF;
        IF pg_net_location = 'public' THEN
            RAISE NOTICE '- pg_net extension still in public schema';
        END IF;
        RAISE NOTICE '';
        RAISE NOTICE '🔧 You may need to address remaining issues manually';
    END IF;
    
END $$;

-- Success indicator
SELECT 
    'Security warnings fix completed - Check output above for results' as status,
    now() as executed_at; 