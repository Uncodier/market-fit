-- Script de Verificación Simplificado para Políticas RLS
-- Compatible con Supabase PostgreSQL

-- ============================================================================
-- 1. VERIFICAR ESTADO DE RLS EN LAS TABLAS
-- ============================================================================

SELECT 
    '📊 ESTADO DE RLS EN LAS TABLAS' as section;

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Habilitado'
        ELSE '❌ RLS Deshabilitado'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
ORDER BY tablename;

-- ============================================================================
-- 2. LISTAR POLÍTICAS EXISTENTES (SIN DEFINICIONES)
-- ============================================================================

SELECT 
    '📋 POLÍTICAS EXISTENTES' as section;

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    permissive,
    roles
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- 3. CONTAR POLÍTICAS POR TABLA
-- ============================================================================

SELECT 
    '🔢 RESUMEN DE POLÍTICAS POR TABLA' as section;

SELECT 
    tablename,
    COUNT(*) as total_policies,
    COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_policies,
    COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_policies,
    COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_policies,
    COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_policies,
    COUNT(CASE WHEN cmd = 'ALL' THEN 1 END) as all_policies
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- 4. BUSCAR POLÍTICAS CON NOMBRES ESPECÍFICOS QUE CREAMOS
-- ============================================================================

SELECT 
    '🎯 POLÍTICAS QUE CREAMOS (por nombre)' as section;

SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN policyname LIKE '%view%sites%' THEN '✅ Política de SELECT encontrada'
        WHEN policyname LIKE '%insert%sites%' OR policyname LIKE '%create%sites%' THEN '✅ Política de INSERT encontrada'
        WHEN policyname LIKE '%update%sites%' THEN '✅ Política de UPDATE encontrada'
        WHEN policyname LIKE '%delete%sites%' THEN '✅ Política de DELETE encontrada'
        ELSE '❓ Política desconocida'
    END as status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
AND (
    policyname LIKE '%synced objects%' OR
    policyname LIKE '%whatsapp templates%' OR 
    policyname LIKE '%system memories%'
)
ORDER BY tablename, cmd;

-- ============================================================================
-- 5. VERIFICAR PERMISOS EN LAS TABLAS
-- ============================================================================

SELECT 
    '🔐 PERMISOS EN LAS TABLAS' as section;

SELECT 
    schemaname,
    tablename,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
AND table_name IN ('synced_objects', 'whatsapp_templates', 'system_memories')
AND grantee IN ('authenticated', 'anon', 'public')
ORDER BY table_name, grantee, privilege_type;

-- ============================================================================
-- 6. DIAGNÓSTICO FINAL
-- ============================================================================

SELECT 
    '🩺 DIAGNÓSTICO FINAL' as section;

-- Verificar si tenemos las políticas básicas que necesitamos
WITH policy_check AS (
    SELECT 
        tablename,
        SUM(CASE WHEN cmd = 'SELECT' AND policyname LIKE '%view%' THEN 1 ELSE 0 END) as has_select,
        SUM(CASE WHEN cmd = 'INSERT' AND policyname LIKE '%insert%' THEN 1 ELSE 0 END) as has_insert,
        SUM(CASE WHEN cmd = 'UPDATE' AND policyname LIKE '%update%' THEN 1 ELSE 0 END) as has_update,
        SUM(CASE WHEN cmd = 'DELETE' AND policyname LIKE '%delete%' THEN 1 ELSE 0 END) as has_delete
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
    GROUP BY tablename
)
SELECT 
    tablename,
    CASE WHEN has_select > 0 THEN '✅' ELSE '❌' END || ' SELECT policy' as select_status,
    CASE WHEN has_insert > 0 THEN '✅' ELSE '❌' END || ' INSERT policy' as insert_status,
    CASE WHEN has_update > 0 THEN '✅' ELSE '❌' END || ' UPDATE policy' as update_status,
    CASE WHEN has_delete > 0 THEN '✅' ELSE '❌' END || ' DELETE policy' as delete_status,
    CASE 
        WHEN has_select > 0 AND has_insert > 0 AND has_update > 0 AND has_delete > 0 
        THEN '🎉 COMPLETO - Ejecutar fix para optimizar rendimiento'
        ELSE '⚠️ INCOMPLETO - Faltan políticas, ejecutar script de corrección'
    END as recommendation
FROM policy_check
ORDER BY tablename;

-- ============================================================================
-- 7. INSTRUCCIONES FINALES
-- ============================================================================

SELECT 
    '📝 PRÓXIMOS PASOS' as section;

SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' 
              AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')) >= 12
        THEN '🚀 Las políticas existen. Ejecuta: migrations/fix_rls_performance_warnings.sql'
        ELSE '🔧 Faltan políticas. Ejecuta: migrations/fix_rls_missing_tables.sql'
    END as next_action; 