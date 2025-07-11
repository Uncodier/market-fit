-- Script 2: Analizar patrones problemáticos en la política
WITH policy_analysis AS (
    SELECT 
        qual as policy_definition,
        CASE WHEN qual LIKE '%auth.uid()%' THEN 'FOUND' ELSE 'NOT_FOUND' END as has_auth_uid,
        CASE WHEN qual LIKE '%auth.jwt()%' THEN 'FOUND' ELSE 'NOT_FOUND' END as has_auth_jwt,
        CASE WHEN qual LIKE '%current_setting(%' THEN 'FOUND' ELSE 'NOT_FOUND' END as has_current_setting,
        CASE WHEN qual LIKE '%(SELECT auth.uid())%' THEN 'OPTIMIZED' ELSE 'NOT_OPTIMIZED' END as auth_uid_optimized,
        CASE WHEN qual LIKE '%(SELECT auth.jwt()%' THEN 'OPTIMIZED' ELSE 'NOT_OPTIMIZED' END as auth_jwt_optimized
    FROM pg_policies 
    WHERE tablename = 'visitors' 
    AND schemaname = 'public' 
    AND policyname = 'visitors_unified'
)
SELECT 
    'Auth function patterns analysis:' as analysis_type,
    has_auth_uid,
    has_auth_jwt,
    has_current_setting,
    auth_uid_optimized,
    auth_jwt_optimized
FROM policy_analysis; 