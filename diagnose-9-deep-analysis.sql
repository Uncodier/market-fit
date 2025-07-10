-- Script 9: Análisis profundo - entender exactamente qué detecta el linter
SELECT 
    'Deep Policy Analysis' as analysis_type,
    -- Mostrar la política completa para análisis manual
    qual as complete_policy,
    -- Analizar cada patrón específico que el linter podría estar detectando
    CASE WHEN qual LIKE '%auth.uid()%' THEN 'FOUND' ELSE 'NOT_FOUND' END as has_any_auth_uid,
    CASE WHEN qual LIKE '%SELECT auth.uid()%' THEN 'FOUND' ELSE 'NOT_FOUND' END as has_select_auth_uid,
    CASE WHEN qual LIKE '%(SELECT auth.uid())%' THEN 'FOUND' ELSE 'NOT_FOUND' END as has_parenthesis_select_auth_uid,
    CASE WHEN qual LIKE '%( SELECT auth.uid()%' THEN 'FOUND' ELSE 'NOT_FOUND' END as has_space_select_auth_uid,
    
    -- Contar diferentes tipos de auth.uid()
    (length(qual) - length(replace(qual, 'auth.uid()', ''))) / length('auth.uid()') as total_auth_uid_count,
    (length(qual) - length(replace(qual, 'SELECT auth.uid()', ''))) / length('SELECT auth.uid()') as select_auth_uid_count,
    
    -- Analizar si hay algún auth.uid() que NO esté en SELECT
    CASE 
        WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%SELECT auth.uid()%' THEN 'PROBLEM: auth.uid() without SELECT found'
        WHEN qual LIKE '%auth.uid()%' AND qual LIKE '%SELECT auth.uid()%' THEN 'OK: All auth.uid() have SELECT'
        ELSE 'No auth.uid() found'
    END as auth_uid_analysis,
    
    -- Mostrar fragmentos específicos alrededor de auth.uid()
    substring(qual from position('auth.uid()' in qual) - 20 for 50) as auth_uid_context1,
    substring(qual from position('auth.uid()' in qual) + 50 for 50) as auth_uid_context2
FROM pg_policies 
WHERE tablename = 'visitors' 
AND schemaname = 'public' 
AND policyname = 'visitors_unified'; 