-- Script 5: Verificación final - confirmar que warnings están eliminados
WITH policy_check AS (
    SELECT 
        qual as policy_definition,
        -- Verificar que todas las auth functions están envueltas en SELECT
        CASE 
            WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid())%' THEN 'PROBLEM: Direct auth.uid() calls found'
            WHEN qual LIKE '%(SELECT auth.uid())%' THEN 'OK: auth.uid() properly wrapped'
            ELSE 'OK: No auth.uid() calls'
        END as auth_uid_check,
        
        CASE 
            WHEN qual LIKE '%auth.jwt()%' AND qual NOT LIKE '%(SELECT (auth.jwt()%' THEN 'PROBLEM: Direct auth.jwt() calls found'
            WHEN qual LIKE '%(SELECT (auth.jwt()%' THEN 'OK: auth.jwt() properly wrapped'
            ELSE 'OK: No auth.jwt() calls'
        END as auth_jwt_check,
        
        CASE 
            WHEN qual LIKE '%current_setting%' AND qual NOT LIKE '%(SELECT current_setting%' THEN 'PROBLEM: Direct current_setting() calls found'
            WHEN qual LIKE '%(SELECT current_setting%' THEN 'OK: current_setting() properly wrapped'
            ELSE 'OK: No current_setting() calls'
        END as current_setting_check
    FROM pg_policies 
    WHERE tablename = 'visitors' 
    AND schemaname = 'public' 
    AND policyname = 'visitors_unified'
)
SELECT 
    'Final verification results:' as verification_type,
    auth_uid_check,
    auth_jwt_check,
    current_setting_check,
    CASE 
        WHEN auth_uid_check LIKE 'OK:%' AND auth_jwt_check LIKE 'OK:%' AND current_setting_check LIKE 'OK:%' 
        THEN '✅ ALL AUTH FUNCTIONS PROPERLY OPTIMIZED - Warnings should be gone!'
        ELSE '❌ Some functions still need optimization'
    END as final_status
FROM policy_check; 