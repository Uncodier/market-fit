-- Script 3: Verificar estructura específica que puede causar warnings
SELECT 
    'Policy structure analysis:' as check_type,
    CASE 
        WHEN qual LIKE '%( SELECT%auth.uid()%' THEN '✅ auth.uid() is in subquery'
        WHEN qual LIKE '%auth.uid()%' THEN '❌ auth.uid() is direct call - PROBLEM'
        ELSE 'auth.uid() not found'
    END as auth_uid_structure,
    CASE 
        WHEN qual LIKE '%( SELECT%auth.jwt()%' THEN '✅ auth.jwt() is in subquery'
        WHEN qual LIKE '%auth.jwt()%' THEN '❌ auth.jwt() is direct call - PROBLEM'
        ELSE 'auth.jwt() not found'
    END as auth_jwt_structure,
    CASE 
        WHEN qual LIKE '%( SELECT%current_setting%' THEN '✅ current_setting() is in subquery'
        WHEN qual LIKE '%current_setting%' THEN '❌ current_setting() is direct call - PROBLEM'
        ELSE 'current_setting() not found'
    END as current_setting_structure
FROM pg_policies 
WHERE tablename = 'visitors' 
AND schemaname = 'public' 
AND policyname = 'visitors_unified'; 