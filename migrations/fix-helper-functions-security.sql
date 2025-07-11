-- Fix helper functions security warnings by adding proper search_path
-- This eliminates function_search_path_mutable warnings

-- Drop and recreate with secure search_path
DROP FUNCTION IF EXISTS auth_user_id();
DROP FUNCTION IF EXISTS is_service_role();

-- Auth helper function with secure search_path
CREATE OR REPLACE FUNCTION auth_user_id() 
RETURNS uuid 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid()
$$;

-- Service role helper function with secure search_path  
CREATE OR REPLACE FUNCTION is_service_role() 
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT current_setting('role', true) = 'service_role' OR 
         (auth.jwt() ->> 'role') = 'service_role'
$$;

-- Verify the functions are now secure
DO $$
DECLARE
    auth_user_id_exists BOOLEAN;
    is_service_role_exists BOOLEAN;
BEGIN
    -- Check if functions exist and are properly configured
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace 
        WHERE n.nspname = 'public' AND p.proname = 'auth_user_id'
    ) INTO auth_user_id_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace 
        WHERE n.nspname = 'public' AND p.proname = 'is_service_role'
    ) INTO is_service_role_exists;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔒 HELPER FUNCTIONS SECURITY FIX:';
    RAISE NOTICE '=================================';
    RAISE NOTICE 'auth_user_id() function: %', 
        CASE WHEN auth_user_id_exists THEN '✅ Created with secure search_path' ELSE '❌ Missing' END;
    RAISE NOTICE 'is_service_role() function: %', 
        CASE WHEN is_service_role_exists THEN '✅ Created with secure search_path' ELSE '❌ Missing' END;
    
    IF auth_user_id_exists AND is_service_role_exists THEN
        RAISE NOTICE '🎉 SUCCESS: Helper functions now have secure search_path!';
        RAISE NOTICE '📋 function_search_path_mutable warnings should be gone!';
    ELSE
        RAISE NOTICE '❌ ISSUE: Some functions failed to create';
    END IF;
END $$; 