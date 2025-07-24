-- DEBUG: Inspect current function definition
-- This script will show us the exact definition of the existing function to identify the problem
-- Date: 2025-01-24

-- ============================================================================
-- STEP 1: GET FUNCTION DEFINITION
-- ============================================================================

SELECT 
    routine_name,
    routine_type,
    security_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'prevent_last_admin_role_change';

-- ============================================================================
-- STEP 2: GET FUNCTION PROPERTIES (search_path, security, etc.)
-- ============================================================================

SELECT 
    p.proname as function_name,
    p.prosecdef as security_definer,
    p.proconfig as config_settings,
    pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'prevent_last_admin_role_change';

-- ============================================================================
-- STEP 3: CHECK FUNCTION PERMISSIONS
-- ============================================================================

SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.routine_privileges 
WHERE routine_schema = 'public' 
AND routine_name = 'prevent_last_admin_role_change';

-- ============================================================================
-- STEP 4: CHECK TRIGGERS USING THIS FUNCTION
-- ============================================================================

SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    event_object_table
FROM information_schema.triggers 
WHERE action_statement LIKE '%prevent_last_admin_role_change%'; 