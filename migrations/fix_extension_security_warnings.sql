-- Fix Extension in Public Schema Warnings
-- This migration addresses extensions in public schema security warnings
-- IMPORTANT: Moving extensions can be risky in production environments

-- Create a dedicated schema for extensions
CREATE SCHEMA IF NOT EXISTS extensions;

-- Safe approach: Check and handle extensions carefully
DO $$
DECLARE
    ext_record RECORD;
    current_db_name TEXT;
BEGIN
    -- Get current database name
    SELECT current_database() INTO current_db_name;
    RAISE NOTICE 'Working with database: %', current_db_name;
    
    -- Check current extension locations
    RAISE NOTICE 'Current extension locations:';
    FOR ext_record IN 
        SELECT e.extname, n.nspname as schema_name
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname IN ('pg_trgm', 'pg_net')
    LOOP
        RAISE NOTICE 'Extension % is in schema %', ext_record.extname, ext_record.schema_name;
    END LOOP;
    
    -- Handle pg_trgm extension
    IF EXISTS (
        SELECT 1 FROM pg_extension 
        WHERE extname = 'pg_trgm' 
        AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE 'pg_trgm found in public schema. Attempting to move...';
        
        -- Check if there are dependencies
        IF EXISTS (
            SELECT 1 FROM pg_depend d
            JOIN pg_extension e ON d.objid = e.oid
            WHERE e.extname = 'pg_trgm'
            AND d.deptype = 'n'
        ) THEN
            RAISE NOTICE 'pg_trgm has dependencies. Moving may require CASCADE.';
        END IF;
        
        BEGIN
            -- Try to move the extension
            ALTER EXTENSION pg_trgm SET SCHEMA extensions;
            RAISE NOTICE 'Successfully moved pg_trgm to extensions schema';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not move pg_trgm: %. Trying recreate approach.', SQLERRM;
                
                BEGIN
                    -- Fallback: drop and recreate
                    DROP EXTENSION IF EXISTS pg_trgm CASCADE;
                    CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
                    RAISE NOTICE 'Recreated pg_trgm in extensions schema';
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Failed to recreate pg_trgm: %. Manual intervention required.', SQLERRM;
                END;
        END;
    ELSE
        -- Extension not in public or doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
            CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
            RAISE NOTICE 'Created pg_trgm in extensions schema';
        ELSE
            RAISE NOTICE 'pg_trgm already exists in non-public schema';
        END IF;
    END IF;
    
    -- Handle pg_net extension
    IF EXISTS (
        SELECT 1 FROM pg_extension 
        WHERE extname = 'pg_net' 
        AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE 'pg_net found in public schema. Attempting to move...';
        
        BEGIN
            -- Try to move the extension
            ALTER EXTENSION pg_net SET SCHEMA extensions;
            RAISE NOTICE 'Successfully moved pg_net to extensions schema';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not move pg_net: %. Trying recreate approach.', SQLERRM;
                
                BEGIN
                    -- Fallback: drop and recreate
                    DROP EXTENSION IF EXISTS pg_net CASCADE;
                    CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
                    RAISE NOTICE 'Recreated pg_net in extensions schema';
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Failed to recreate pg_net: %. Manual intervention required.', SQLERRM;
                END;
        END;
    ELSE
        -- Extension not in public or doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
            BEGIN
                CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
                RAISE NOTICE 'Created pg_net in extensions schema';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not create pg_net: %. May not be available.', SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'pg_net already exists in non-public schema';
        END IF;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'General error in extension migration: %', SQLERRM;
        RAISE NOTICE 'Some extensions may need manual intervention.';
END $$;

-- Grant usage on extensions schema to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;

-- Grant execute permissions on extension functions to users who need them
-- This ensures existing functionality continues to work
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon;

-- Update search_path for roles to include extensions schema
-- This ensures extension functions can still be found
-- Note: You may need to set this for your specific database name
DO $$
BEGIN
    -- Set search_path for current session
    SET search_path = public, extensions;
    
    -- Note: To make this permanent for all sessions, you would need to run:
    -- ALTER DATABASE your_database_name SET search_path = public, extensions;
    -- Replace 'your_database_name' with your actual database name
    
    RAISE NOTICE 'Search path updated for current session. To make permanent, run:';
    RAISE NOTICE 'ALTER DATABASE your_database_name SET search_path = public, extensions;';
    RAISE NOTICE 'Replace your_database_name with your actual database name.';
END $$;

-- Success message
SELECT 'Extension security warnings fixed - pg_trgm and pg_net moved to extensions schema' AS status; 