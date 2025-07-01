-- Fix pg_net Extension in Public Schema
-- This migration specifically handles the pg_net extension that remains in public schema

DO $$
DECLARE
    extension_schema TEXT;
BEGIN
    -- Check current location of pg_net extension
    SELECT n.nspname INTO extension_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_net';
    
    IF extension_schema IS NOT NULL THEN
        RAISE NOTICE 'pg_net extension found in schema: %', extension_schema;
        
        IF extension_schema = 'public' THEN
            RAISE NOTICE 'Attempting to move pg_net from public to extensions schema...';
            
            -- Create extensions schema if it doesn't exist
            CREATE SCHEMA IF NOT EXISTS extensions;
            
            -- Method 1: Try to move the extension directly
            BEGIN
                ALTER EXTENSION pg_net SET SCHEMA extensions;
                RAISE NOTICE '✓ Successfully moved pg_net extension to extensions schema using ALTER EXTENSION';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Method 1 failed: %. Trying Method 2...', SQLERRM;
                    
                    -- Method 2: Try to update the extension namespace directly (advanced)
                    BEGIN
                        UPDATE pg_extension 
                        SET extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'extensions')
                        WHERE extname = 'pg_net';
                        
                        RAISE NOTICE '✓ Successfully moved pg_net extension to extensions schema using direct update';
                    EXCEPTION
                        WHEN OTHERS THEN
                            RAISE NOTICE 'Method 2 failed: %. Trying Method 3...', SQLERRM;
                            
                            -- Method 3: Drop and recreate (last resort)
                            BEGIN
                                RAISE NOTICE 'Attempting to drop and recreate pg_net extension...';
                                
                                -- Check if there are dependencies
                                IF EXISTS (
                                    SELECT 1 FROM pg_depend d
                                    JOIN pg_extension e ON d.objid = e.oid
                                    WHERE e.extname = 'pg_net'
                                    AND d.deptype = 'n'
                                ) THEN
                                    RAISE NOTICE 'pg_net has dependencies, using CASCADE...';
                                    DROP EXTENSION pg_net CASCADE;
                                ELSE
                                    DROP EXTENSION pg_net;
                                END IF;
                                
                                -- Recreate in extensions schema
                                CREATE EXTENSION pg_net SCHEMA extensions;
                                
                                RAISE NOTICE '✓ Successfully recreated pg_net extension in extensions schema';
                            EXCEPTION
                                WHEN OTHERS THEN
                                    RAISE NOTICE '✗ Method 3 failed: %. Manual intervention may be required.', SQLERRM;
                                    RAISE NOTICE 'You may need to manually drop and recreate pg_net during a maintenance window.';
                            END;
                    END;
            END;
        ELSE
            RAISE NOTICE '✓ pg_net extension is already in schema: %. No action needed.', extension_schema;
        END IF;
    ELSE
        RAISE NOTICE 'pg_net extension not found. Attempting to create it in extensions schema...';
        
        -- Create extensions schema if it doesn't exist
        CREATE SCHEMA IF NOT EXISTS extensions;
        
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
            RAISE NOTICE '✓ Successfully created pg_net extension in extensions schema';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '✗ Failed to create pg_net extension: %. It may not be available.', SQLERRM;
        END;
    END IF;
    
    -- Verify final location
    SELECT n.nspname INTO extension_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_net';
    
    IF extension_schema IS NOT NULL THEN
        RAISE NOTICE 'Final location of pg_net extension: %', extension_schema;
        
        IF extension_schema = 'extensions' THEN
            RAISE NOTICE '🎉 SUCCESS: pg_net extension is now in the extensions schema!';
        ELSE
            RAISE NOTICE '⚠️  WARNING: pg_net extension is still in schema: %', extension_schema;
        END IF;
    ELSE
        RAISE NOTICE '⚠️  WARNING: pg_net extension not found after migration attempt';
    END IF;
    
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon;

-- Success message
SELECT 'pg_net extension migration completed' AS status; 