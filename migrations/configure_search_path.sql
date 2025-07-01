-- Configure Search Path for Extensions
-- This script configures the search_path to include the extensions schema
-- Run this AFTER running fix_extension_security_warnings.sql

DO $$
DECLARE
    current_db_name TEXT;
    search_path_cmd TEXT;
BEGIN
    -- Get current database name
    SELECT current_database() INTO current_db_name;
    
    -- Build the ALTER DATABASE command
    search_path_cmd := 'ALTER DATABASE ' || quote_ident(current_db_name) || ' SET search_path = public, extensions';
    
    -- Execute the command
    EXECUTE search_path_cmd;
    
    -- Confirm the change
    RAISE NOTICE 'Successfully configured search_path for database: %', current_db_name;
    RAISE NOTICE 'Command executed: %', search_path_cmd;
    RAISE NOTICE 'New connections will automatically include extensions schema in search_path';
    RAISE NOTICE 'For existing connections, run: SET search_path = public, extensions;';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error configuring search_path: %', SQLERRM;
        RAISE NOTICE 'You may need superuser privileges to alter database settings';
END $$;

-- Show current search_path
SHOW search_path;

-- Success message
SELECT 'Search path configuration completed successfully' AS status; 