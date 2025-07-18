-- ============================================================================
-- DIAGNÓSTICO RÁPIDO: ESTADO DE RLS PARA COMMANDS
-- ============================================================================
-- Script simple para verificar si las políticas RLS están funcionando correctamente

-- 1. Verificar si RLS está habilitado
SELECT 
    'RLS Status' as check_type,
    'commands' as table_name,
    CASE WHEN relrowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM pg_class 
WHERE relname = 'commands' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Contar políticas activas
SELECT 
    'Active Policies' as check_type,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ NO POLICIES'
        WHEN COUNT(*) = 1 THEN '✅ SINGLE POLICY'
        ELSE '⚠️ MULTIPLE POLICIES'
    END as status
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'commands';

-- 3. Listar nombres de políticas
SELECT 
    'Policy Names' as check_type,
    policyname as policy_name,
    cmd as operation_type
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'commands'
ORDER BY policyname;

-- 4. Verificar acceso básico (si está autenticado)
SELECT 
    'Commands Access' as check_type,
    CASE 
        WHEN (SELECT auth.uid()) IS NULL THEN 'SKIPPED - Not authenticated'
        ELSE 
            CASE 
                WHEN (SELECT COUNT(*) FROM public.commands) >= 0 THEN 
                    '✅ CAN ACCESS - Count: ' || (SELECT COUNT(*) FROM public.commands)::text
                ELSE '❌ CANNOT ACCESS'
            END
    END as status;

-- 5. Verificar estructura básica
SELECT 
    'Table Structure' as check_type,
    'Required columns check' as description,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'user_id') AND
             EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'site_id')
        THEN '✅ HAS user_id AND site_id'
        ELSE '❌ MISSING required columns'
    END as status;

-- 6. Diagnóstico general
SELECT 
    '🔍 DIAGNOSIS' as result_type,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'commands') 
        THEN '❌ NO RLS POLICIES - Commands completely open or blocked'
        
        WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'commands' AND qual LIKE '%user_id = %' AND qual NOT LIKE '%site%')
        THEN '⚠️ USER-ONLY POLICY - Only command creators can see their commands'
        
        WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'commands' AND qual LIKE '%site%')
        THEN '✅ SITE-BASED POLICY - Site members should have access'
        
        ELSE '❓ UNKNOWN POLICY TYPE - Manual review needed'
    END as diagnosis,
    
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'commands') 
        THEN 'Apply RLS policies to secure the table'
        
        WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'commands' AND qual LIKE '%user_id = %' AND qual NOT LIKE '%site%')
        THEN 'PROBLEM FOUND: Run fix-commands-rls.sql to allow site members access'
        
        WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'commands' AND qual LIKE '%site%')
        THEN 'Policies look good - test with different users'
        
        ELSE 'Review current policies manually'
    END as recommendation;

-- 7. Instrucciones rápidas
SELECT 
    '📋 NEXT STEPS' as info_type,
    'If you see "USER-ONLY POLICY" above:' as step_1,
    '1. Run: scripts/fix-commands-rls.sql in Supabase SQL Editor' as step_2,
    '2. Test with different site members' as step_3; 