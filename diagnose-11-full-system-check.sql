-- Script 11: Verificación completa del sistema - buscar TODAS las tablas con problemas
SELECT 
    'System-wide RLS Policy Check' as check_type,
    schemaname,
    tablename,
    policyname,
    -- Verificar patrones problemáticos
    CASE 
        WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%' THEN 'PROBLEM: auth.uid() not optimized'
        WHEN qual LIKE '%auth.jwt()%' AND qual NOT LIKE '%(select (auth.jwt()%' THEN 'PROBLEM: auth.jwt() not optimized'
        WHEN qual LIKE '%current_setting%' AND qual NOT LIKE '%(select current_setting%' THEN 'PROBLEM: current_setting() not optimized'
        ELSE 'OK: Properly optimized'
    END as optimization_status,
    
    -- Contar funciones auth
    (length(qual) - length(replace(qual, 'auth.uid()', ''))) / length('auth.uid()') as auth_uid_count,
    (length(qual) - length(replace(qual, 'auth.jwt()', ''))) / length('auth.jwt()') as auth_jwt_count,
    (length(qual) - length(replace(qual, 'current_setting', ''))) / length('current_setting') as current_setting_count,
    
    -- Mostrar fragmento de la política
    substring(qual from 1 for 100) as policy_fragment
FROM pg_policies 
WHERE schemaname = 'public'
AND (qual LIKE '%auth.uid()%' OR qual LIKE '%auth.jwt()%' OR qual LIKE '%current_setting%')
ORDER BY 
    CASE 
        WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%' THEN 1
        WHEN qual LIKE '%auth.jwt()%' AND qual NOT LIKE '%(select (auth.jwt()%' THEN 1
        WHEN qual LIKE '%current_setting%' AND qual NOT LIKE '%(select current_setting%' THEN 1
        ELSE 2
    END,
    tablename; 