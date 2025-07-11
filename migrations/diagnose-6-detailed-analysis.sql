-- Script 6: Análisis detallado - ver exactamente qué está pasando
SELECT 
    'Current policy after Script 4:' as analysis_type,
    qual as current_policy_definition,
    length(qual) as policy_length,
    -- Buscar patterns específicos
    CASE WHEN qual LIKE '%auth.uid()%' THEN 'FOUND' ELSE 'NOT_FOUND' END as direct_auth_uid,
    CASE WHEN qual LIKE '%(SELECT auth.uid())%' THEN 'FOUND' ELSE 'NOT_FOUND' END as wrapped_auth_uid,
    CASE WHEN qual LIKE '%auth.jwt()%' THEN 'FOUND' ELSE 'NOT_FOUND' END as direct_auth_jwt,
    CASE WHEN qual LIKE '%(SELECT (auth.jwt()%' THEN 'FOUND' ELSE 'NOT_FOUND' END as wrapped_auth_jwt,
    CASE WHEN qual LIKE '%current_setting%' THEN 'FOUND' ELSE 'NOT_FOUND' END as direct_current_setting,
    CASE WHEN qual LIKE '%(SELECT current_setting%' THEN 'FOUND' ELSE 'NOT_FOUND' END as wrapped_current_setting
FROM pg_policies 
WHERE tablename = 'visitors' 
AND schemaname = 'public' 
AND policyname = 'visitors_unified'; 