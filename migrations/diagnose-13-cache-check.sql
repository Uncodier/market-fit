-- Script 13: Verificación de cache y timing
-- Comprobar si el problema es de cache del linter de Supabase

-- Verificar timestamp de última modificación de la política
SELECT 
    'Policy Modification Check' as check_type,
    schemaname,
    tablename,
    policyname,
    -- Información sobre cuándo se modificó
    CASE 
        WHEN qual LIKE '%auth_user_id()%' AND qual LIKE '%is_service_role()%' THEN 'USING HELPER FUNCTIONS'
        WHEN qual LIKE '%(select auth.uid())%' THEN 'USING SELECT WRAPPER'
        WHEN qual LIKE '%auth.uid()%' THEN 'USING DIRECT AUTH CALLS'
        ELSE 'UNKNOWN PATTERN'
    END as current_approach,
    
    -- Verificar si tiene funciones auth directas
    CASE 
        WHEN qual LIKE '%auth.uid()%' OR qual LIKE '%auth.jwt()%' OR qual LIKE '%current_setting(%' THEN 'YES - MAY TRIGGER WARNING'
        ELSE 'NO - SHOULD NOT TRIGGER WARNING'
    END as has_direct_auth_functions,
    
    length(qual) as policy_length,
    substring(qual from 1 for 150) as policy_start
FROM pg_policies 
WHERE tablename = 'visitors' 
AND schemaname = 'public' 
AND policyname = 'visitors_unified';

-- Verificar si existen las funciones helper
SELECT 
    'Helper Functions Check' as check_type,
    proname as function_name,
    provolatile as volatility,
    CASE 
        WHEN provolatile = 'i' THEN 'IMMUTABLE'
        WHEN provolatile = 's' THEN 'STABLE - GOOD FOR CACHING'
        WHEN provolatile = 'v' THEN 'VOLATILE - MAY CAUSE ISSUES'
    END as volatility_description
FROM pg_proc 
WHERE proname IN ('auth_user_id', 'is_service_role')
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Verificar todas las políticas que podrían causar warnings
SELECT 
    'All Potential Warning Sources' as check_type,
    count(*) as total_policies_with_auth_functions,
    count(CASE WHEN qual LIKE '%auth.uid()%' THEN 1 END) as policies_with_auth_uid,
    count(CASE WHEN qual LIKE '%auth.jwt()%' THEN 1 END) as policies_with_auth_jwt,
    count(CASE WHEN qual LIKE '%current_setting%' THEN 1 END) as policies_with_current_setting
FROM pg_policies 
WHERE schemaname = 'public'
AND (qual LIKE '%auth.uid()%' OR qual LIKE '%auth.jwt()%' OR qual LIKE '%current_setting%'); 