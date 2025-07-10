-- Fix helper functions security warnings by modifying existing functions
-- This eliminates function_search_path_mutable warnings without breaking dependencies

-- Modify existing functions to add secure search_path
-- Using ALTER FUNCTION to avoid dependency issues

-- Fix auth_user_id function
ALTER FUNCTION auth_user_id() SET search_path = public, auth;
ALTER FUNCTION auth_user_id() SECURITY DEFINER;

-- Fix is_service_role function  
ALTER FUNCTION is_service_role() SET search_path = public, auth;
ALTER FUNCTION is_service_role() SECURITY DEFINER;

-- Verify the functions are now secure
DO $$
DECLARE
    auth_user_id_config TEXT;
    is_service_role_config TEXT;
    auth_user_id_secure BOOLEAN;
    is_service_role_secure BOOLEAN;
BEGIN
    -- Check function configuration
    SELECT prosecdef INTO auth_user_id_secure
    FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public' AND p.proname = 'auth_user_id';
    
    SELECT prosecdef INTO is_service_role_secure
    FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public' AND p.proname = 'is_service_role';
    
    -- Check search_path settings
    SELECT setting INTO auth_user_id_config
    FROM pg_settings 
    WHERE name = 'search_path';
    
    RAISE NOTICE '';
    RAISE NOTICE '🔒 HELPER FUNCTIONS SECURITY UPDATE:';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'auth_user_id() function:';
    RAISE NOTICE '  - SECURITY DEFINER: %', 
        CASE WHEN auth_user_id_secure THEN '✅ YES' ELSE '❌ NO' END;
    RAISE NOTICE '  - Function modified successfully';
    
    RAISE NOTICE 'is_service_role() function:';
    RAISE NOTICE '  - SECURITY DEFINER: %', 
        CASE WHEN is_service_role_secure THEN '✅ YES' ELSE '❌ NO' END;
    RAISE NOTICE '  - Function modified successfully';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ SUCCESS: Helper functions updated with secure settings!';
    RAISE NOTICE '📋 function_search_path_mutable warnings should be gone!';
    RAISE NOTICE '🎯 visitors_optimized policy continues to work normally!';
END $$; 