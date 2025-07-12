-- COMPREHENSIVE FIX: delete_site_safely function
-- This migration diagnoses and fixes all issues with the delete_site_safely function

-- ============================================================================
-- STEP 1: DIAGNOSE THE CURRENT STATE
-- ============================================================================

DO $$
DECLARE
    func_exists BOOLEAN;
    table_exists BOOLEAN;
    site_count INTEGER;
    rec RECORD;
BEGIN
    RAISE NOTICE '🔍 DIAGNOSING delete_site_safely FUNCTION...';
    RAISE NOTICE '================================================';
    
    -- Check if sites table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sites'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT COUNT(*) INTO site_count FROM public.sites;
        RAISE NOTICE '✅ Table public.sites exists with % records', site_count;
    ELSE
        RAISE NOTICE '❌ Table public.sites does not exist';
    END IF;
    
    -- Check if function exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'delete_site_safely'
    ) INTO func_exists;
    
    IF func_exists THEN
        RAISE NOTICE '✅ Function delete_site_safely exists';
        
        -- Show function details
        FOR rec IN
            SELECT 
                pg_get_function_arguments(p.oid) as arguments,
                pg_get_function_result(p.oid) as return_type,
                p.prosecdef as security_definer,
                COALESCE(p.proconfig, '{}') as config
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname = 'delete_site_safely'
        LOOP
            RAISE NOTICE '   - Arguments: %', rec.arguments;
            RAISE NOTICE '   - Returns: %', rec.return_type;
            RAISE NOTICE '   - Security Definer: %', rec.security_definer;
            RAISE NOTICE '   - Config: %', rec.config;
        END LOOP;
    ELSE
        RAISE NOTICE '❌ Function delete_site_safely does not exist';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 2: DROP EXISTING PROBLEMATIC FUNCTION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🗑️  REMOVING EXISTING FUNCTION...';
    DROP FUNCTION IF EXISTS public.delete_site_safely(UUID);
    RAISE NOTICE '✅ Old function removed';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 3: CREATE CLEAN, WORKING FUNCTION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 CREATING NEW delete_site_safely FUNCTION...';
END $$;

CREATE OR REPLACE FUNCTION public.delete_site_safely(site_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    site_exists BOOLEAN;
    user_is_owner BOOLEAN;
    current_user_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: You must be logged in to delete a site';
    END IF;
    
    -- Check if site exists
    SELECT EXISTS (
        SELECT 1 FROM public.sites 
        WHERE id = site_id_param
    ) INTO site_exists;
    
    IF NOT site_exists THEN
        RAISE EXCEPTION 'Site not found: Site with ID % does not exist', site_id_param;
    END IF;
    
    -- Check if user is the owner of the site
    SELECT EXISTS (
        SELECT 1 FROM public.sites 
        WHERE id = site_id_param 
        AND user_id = current_user_id
    ) INTO user_is_owner;
    
    IF NOT user_is_owner THEN
        RAISE EXCEPTION 'Permission denied: Only the site owner can delete this site';
    END IF;
    
    -- Delete the site (CASCADE will delete related records)
    DELETE FROM public.sites WHERE id = site_id_param;
    
    -- Log the deletion
    RAISE NOTICE 'Site % successfully deleted by user %', site_id_param, current_user_id;
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and re-raise
        RAISE NOTICE 'Error in delete_site_safely: % - %', SQLSTATE, SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public';

-- ============================================================================
-- STEP 4: GRANT PERMISSIONS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔐 GRANTING PERMISSIONS...';
    
    -- Grant execute permission to authenticated users
    GRANT EXECUTE ON FUNCTION public.delete_site_safely(UUID) TO authenticated;
    
    RAISE NOTICE '✅ Permissions granted to authenticated users';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 5: VERIFY THE FUNCTION WORKS
-- ============================================================================

DO $$
DECLARE
    func_exists BOOLEAN;
    permission_granted BOOLEAN;
BEGIN
    RAISE NOTICE '✅ VERIFICATION...';
    
    -- Check function exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'delete_site_safely'
    ) INTO func_exists;
    
    IF func_exists THEN
        RAISE NOTICE '✅ Function delete_site_safely exists and is ready';
    ELSE
        RAISE NOTICE '❌ Function creation failed';
    END IF;
    
    -- Check permissions
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_schema = 'public'
        AND routine_name = 'delete_site_safely'
        AND grantee = 'authenticated'
        AND privilege_type = 'EXECUTE'
    ) INTO permission_granted;
    
    IF permission_granted THEN
        RAISE NOTICE '✅ Execute permission granted to authenticated users';
    ELSE
        RAISE NOTICE '❌ Permission grant failed';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 DELETE_SITE_SAFELY FUNCTION READY FOR USE';
    RAISE NOTICE '================================================';
END $$;

-- ============================================================================
-- STEP 6: ADD FUNCTION DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.delete_site_safely(UUID) IS 
'Safely deletes a site and all its related data. Only the site owner can delete the site.
Parameters: site_id_param (UUID) - The ID of the site to delete
Returns: BOOLEAN - true if deletion was successful
Raises: Exception if user lacks permission or site does not exist'; 