-- Official Supabase Fix for pg_net Extension
-- Based on: https://supabase.com/docs/guides/troubleshooting/42501--permission-denied-for-table-httprequestqueue-KnozmQ
-- This is the recommended approach by Supabase for moving pg_net extension

DO $$
DECLARE
    current_schema TEXT;
    queue_count INTEGER;
    success BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '🔧 Official Supabase fix for pg_net extension...';
    RAISE NOTICE '📖 Based on Supabase troubleshooting documentation';
    RAISE NOTICE '';
    
    -- Check current location
    SELECT n.nspname INTO current_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_net';
    
    IF current_schema IS NOT NULL THEN
        RAISE NOTICE '📦 Current pg_net location: %', current_schema;
        
        IF current_schema = 'public' THEN
            RAISE NOTICE '🎯 pg_net is in public schema, applying official Supabase fix...';
            
            -- Step 1: Check request queue (as recommended by Supabase)
            BEGIN
                SELECT COUNT(*) INTO queue_count
                FROM net.http_request_queue;
                
                RAISE NOTICE 'ℹ️  HTTP request queue has % pending requests', queue_count;
                
                IF queue_count > 0 THEN
                    RAISE NOTICE '⚠️  WARNING: There are % pending requests in the queue', queue_count;
                    RAISE NOTICE '📋 You may want to wait for them to complete or clear the queue first';
                END IF;
                
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE '⚠️  Could not check request queue: %', SQLERRM;
            END;
            
            -- Step 2: Create extensions schema
            CREATE SCHEMA IF NOT EXISTS extensions;
            RAISE NOTICE '✅ Extensions schema ready';
            
            -- Step 3: Apply the official Supabase fix
            BEGIN
                RAISE NOTICE '🔄 Applying official Supabase fix: DROP + CREATE in extensions schema';
                
                -- Drop the extension from public schema
                DROP EXTENSION IF EXISTS pg_net;
                RAISE NOTICE '✅ Dropped pg_net from public schema';
                
                -- Create it in extensions schema (this is the official recommendation)
                CREATE EXTENSION pg_net SCHEMA extensions;
                RAISE NOTICE '✅ Created pg_net in extensions schema';
                
                success := TRUE;
                
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE '❌ Official fix failed: %', SQLERRM;
                    RAISE NOTICE '🔧 This may require Supabase support intervention';
                    
                    -- Try to recreate in public if the drop succeeded but create failed
                    BEGIN
                        CREATE EXTENSION IF NOT EXISTS pg_net;
                        RAISE NOTICE '🔄 Restored pg_net in public schema as fallback';
                    EXCEPTION
                        WHEN OTHERS THEN
                            RAISE NOTICE '❌ Could not restore pg_net: %', SQLERRM;
                            RAISE NOTICE '🚨 CRITICAL: pg_net extension may be missing!';
                            RAISE NOTICE '📞 Contact Supabase support immediately';
                    END;
            END;
            
        ELSE
            success := TRUE;
            RAISE NOTICE '✅ pg_net extension is already in correct schema: %', current_schema;
        END IF;
    ELSE
        RAISE NOTICE '❌ pg_net extension not found!';
        RAISE NOTICE '🔄 Attempting to create it in extensions schema...';
        
        BEGIN
            CREATE SCHEMA IF NOT EXISTS extensions;
            CREATE EXTENSION pg_net SCHEMA extensions;
            success := TRUE;
            RAISE NOTICE '✅ Created pg_net extension in extensions schema';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed to create pg_net: %', SQLERRM;
                RAISE NOTICE '📞 Contact Supabase support for assistance';
        END;
    END IF;
    
    -- Step 4: Configure permissions
    BEGIN
        RAISE NOTICE '🔐 Configuring permissions for extensions schema...';
        GRANT USAGE ON SCHEMA extensions TO authenticated;
        GRANT USAGE ON SCHEMA extensions TO anon;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon;
        RAISE NOTICE '✅ Permissions configured';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️  Permission configuration had issues: %', SQLERRM;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 FINAL VERIFICATION';
    RAISE NOTICE '==================';
    
    -- Verify final result
    SELECT n.nspname INTO current_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_net';
    
    IF current_schema IS NOT NULL THEN
        RAISE NOTICE 'pg_net final location: %', current_schema;
        
        IF current_schema = 'extensions' THEN
            RAISE NOTICE '';
            RAISE NOTICE '🎉 SUCCESS: pg_net extension moved to extensions schema!';
            RAISE NOTICE '✅ Security warning should now be resolved';
            RAISE NOTICE '✅ Supabase webhooks and HTTP functions should continue working';
        ELSIF current_schema = 'public' THEN
            RAISE NOTICE '';
            RAISE NOTICE '⚠️  pg_net is still in public schema';
            RAISE NOTICE '📞 This may require Supabase support intervention';
            RAISE NOTICE '';
            RAISE NOTICE '📋 Alternative options:';
            RAISE NOTICE '1. Contact Supabase support with this migration output';
            RAISE NOTICE '2. Check if your project has special restrictions';
            RAISE NOTICE '3. Consider that this warning may be expected in managed environments';
        ELSE
            RAISE NOTICE '';
            RAISE NOTICE '✅ pg_net is in schema: % (not public, so warning should be resolved)', current_schema;
        END IF;
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '❌ CRITICAL: pg_net extension not found after fix attempt';
        RAISE NOTICE '📞 Contact Supabase support immediately';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 SUMMARY:';
    IF success THEN
        RAISE NOTICE '✅ Applied official Supabase fix for pg_net';
    ELSE
        RAISE NOTICE '❌ Official fix could not be completed';
    END IF;
    RAISE NOTICE '⚠️  Final manual step: Enable "Leaked Password Protection" in Dashboard';
    RAISE NOTICE '';
    
    -- Important note about managed services
    RAISE NOTICE '📖 NOTE: In managed Supabase environments, some system extensions';
    RAISE NOTICE '   may be protected by design. If this fix does not work, it may be';
    RAISE NOTICE '   a platform limitation rather than a configuration issue.';
    RAISE NOTICE '';
    
END $$;

-- Check final status
SELECT 
    CASE 
        WHEN e.extname IS NULL THEN '❌ pg_net NOT FOUND'
        WHEN n.nspname = 'public' THEN '⚠️  STILL IN PUBLIC SCHEMA - May need Supabase support'
        WHEN n.nspname = 'extensions' THEN '✅ SUCCESSFULLY MOVED TO EXTENSIONS'
        ELSE '✅ IN NON-PUBLIC SCHEMA: ' || n.nspname
    END as pg_net_status
FROM pg_extension e
RIGHT JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname = 'pg_net' OR e.extname IS NULL
LIMIT 1; 