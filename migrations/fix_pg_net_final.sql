-- Final Fix for pg_net Extension in Public Schema
-- This migration specifically targets the pg_net extension that remains in public schema

DO $$
DECLARE
    current_schema TEXT;
    success BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '🔧 Final fix for pg_net extension location...';
    RAISE NOTICE '📍 Target: Move pg_net from public to extensions schema';
    RAISE NOTICE '';
    
    -- Check current location of pg_net extension
    SELECT n.nspname INTO current_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_net';
    
    IF current_schema IS NOT NULL THEN
        RAISE NOTICE '📦 Found pg_net extension in schema: %', current_schema;
        
        IF current_schema = 'public' THEN
            RAISE NOTICE '🎯 pg_net is in public schema, proceeding with move...';
            
            -- Create extensions schema if it doesn't exist
            CREATE SCHEMA IF NOT EXISTS extensions;
            RAISE NOTICE '✅ Extensions schema ready';
            
            -- Method 1: Try ALTER EXTENSION
            BEGIN
                ALTER EXTENSION pg_net SET SCHEMA extensions;
                success := TRUE;
                RAISE NOTICE '🎉 SUCCESS: Moved pg_net to extensions schema using ALTER EXTENSION';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE '⚠️  Method 1 failed: %', SQLERRM;
                    RAISE NOTICE '🔄 Trying alternative approach...';
                    
                    -- Method 2: Try direct schema update (advanced approach)
                    BEGIN
                        -- First, ensure no conflicts
                        PERFORM 1 FROM pg_extension WHERE extname = 'pg_net' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'extensions');
                        
                        -- Update the extension's namespace directly
                        UPDATE pg_extension 
                        SET extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'extensions')
                        WHERE extname = 'pg_net' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
                        
                        IF FOUND THEN
                            success := TRUE;
                            RAISE NOTICE '🎉 SUCCESS: Moved pg_net to extensions schema using direct update';
                        ELSE
                            RAISE NOTICE '❌ Direct update failed - no rows affected';
                        END IF;
                        
                    EXCEPTION
                        WHEN OTHERS THEN
                            RAISE NOTICE '⚠️  Method 2 failed: %', SQLERRM;
                            RAISE NOTICE '🔄 Trying drop and recreate...';
                            
                            -- Method 3: Drop and recreate (last resort)
                            BEGIN
                                -- Check dependencies first
                                DECLARE
                                    dep_count INTEGER;
                                BEGIN
                                    SELECT COUNT(*) INTO dep_count
                                    FROM pg_depend d
                                    JOIN pg_extension e ON d.objid = e.oid
                                    WHERE e.extname = 'pg_net' AND d.deptype = 'n';
                                    
                                    IF dep_count > 0 THEN
                                        RAISE NOTICE '⚠️  pg_net has % dependencies, using CASCADE', dep_count;
                                        DROP EXTENSION pg_net CASCADE;
                                    ELSE
                                        RAISE NOTICE 'ℹ️  pg_net has no dependencies, safe to drop';
                                        DROP EXTENSION pg_net;
                                    END IF;
                                    
                                    -- Recreate in extensions schema
                                    CREATE EXTENSION pg_net SCHEMA extensions;
                                    success := TRUE;
                                    RAISE NOTICE '🎉 SUCCESS: Recreated pg_net in extensions schema';
                                    
                                EXCEPTION
                                    WHEN OTHERS THEN
                                        RAISE NOTICE '❌ Method 3 failed: %', SQLERRM;
                                        RAISE NOTICE '🚨 MANUAL INTERVENTION REQUIRED';
                                END;
                            END;
                    END;
            END;
        ELSE
            success := TRUE;
            RAISE NOTICE '✅ pg_net extension is already in correct schema: %', current_schema;
        END IF;
    ELSE
        RAISE NOTICE '⚠️  pg_net extension not found!';
        RAISE NOTICE '🔄 Attempting to create it in extensions schema...';
        
        BEGIN
            CREATE SCHEMA IF NOT EXISTS extensions;
            CREATE EXTENSION pg_net SCHEMA extensions;
            success := TRUE;
            RAISE NOTICE '🎉 SUCCESS: Created pg_net extension in extensions schema';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed to create pg_net: %', SQLERRM;
        END;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Setting up permissions...';
    
    -- Grant necessary permissions regardless of method used
    BEGIN
        GRANT USAGE ON SCHEMA extensions TO authenticated;
        GRANT USAGE ON SCHEMA extensions TO anon;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon;
        RAISE NOTICE '✅ Permissions configured for extensions schema';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️  Permission setup had issues: %', SQLERRM;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 FINAL VERIFICATION';
    RAISE NOTICE '==================';
    
    -- Verify final location
    SELECT n.nspname INTO current_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_net';
    
    IF current_schema IS NOT NULL THEN
        RAISE NOTICE 'pg_net extension final location: %', current_schema;
        
        IF current_schema = 'extensions' THEN
            RAISE NOTICE '';
            RAISE NOTICE '🎉 COMPLETE SUCCESS!';
            RAISE NOTICE '✅ pg_net extension is now in extensions schema';
            RAISE NOTICE '✅ This security warning should now be resolved';
        ELSIF current_schema = 'public' THEN
            RAISE NOTICE '';
            RAISE NOTICE '❌ FAILED: pg_net extension is still in public schema';
            RAISE NOTICE '🔧 Manual intervention may be required';
            RAISE NOTICE '';
            RAISE NOTICE '📖 Manual steps to try:';
            RAISE NOTICE '1. Connect to your database directly';
            RAISE NOTICE '2. Run: CREATE SCHEMA IF NOT EXISTS extensions;';
            RAISE NOTICE '3. Run: ALTER EXTENSION pg_net SET SCHEMA extensions;';
            RAISE NOTICE '4. Or contact Supabase support if this is a managed restriction';
        ELSE
            RAISE NOTICE '';
            RAISE NOTICE '✅ pg_net extension is in schema: % (not public, so warning should be resolved)', current_schema;
        END IF;
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '❌ pg_net extension not found after migration attempt';
        RAISE NOTICE '🔧 You may need to manually create it or contact support';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 SUMMARY:';
    IF success THEN
        RAISE NOTICE '✅ pg_net extension migration: SUCCESS';
    ELSE
        RAISE NOTICE '❌ pg_net extension migration: FAILED';
    END IF;
    RAISE NOTICE '⚠️  Remaining manual step: Enable "Leaked Password Protection" in Supabase Dashboard';
    RAISE NOTICE '';
    
END $$;

-- Final status check
SELECT 
    e.extname as extension_name,
    n.nspname as schema_name,
    CASE 
        WHEN n.nspname = 'public' THEN '❌ STILL IN PUBLIC'
        WHEN n.nspname = 'extensions' THEN '✅ MOVED TO EXTENSIONS'
        ELSE '✅ NOT IN PUBLIC'
    END as status
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname = 'pg_net'; 