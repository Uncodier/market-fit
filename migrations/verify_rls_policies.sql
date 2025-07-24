-- Script de Verificación de Políticas RLS
-- Este script verifica el estado actual de las políticas y detecta problemas de rendimiento

-- ============================================================================
-- 1. VERIFICAR ESTADO DE RLS EN LAS TABLAS
-- ============================================================================

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
-- 2. LISTAR TODAS LAS POLÍTICAS EXISTENTES
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    permissive,
    roles,
    -- Mostrar la definición de la política
    pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) as using_expression,
    pg_get_expr(with_check, (schemaname||'.'||tablename)::regclass) as with_check_expression
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- 3. DETECTAR PROBLEMAS DE RENDIMIENTO EN LAS POLÍTICAS
-- ============================================================================

-- Verificar si las políticas usan auth.uid() directamente (problemático)
-- vs (SELECT auth.uid()) (optimizado)

WITH policy_analysis AS (
    SELECT 
        schemaname,
        tablename,
        policyname,
        cmd,
        pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) as policy_definition,
        -- Detectar uso no optimizado de auth.uid()
        CASE 
            WHEN pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%auth.uid()%' 
            AND pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) NOT LIKE '%(SELECT auth.uid())%'
            THEN '⚠️ auth.uid() sin optimizar'
            WHEN pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%(SELECT auth.uid())%'
            THEN '✅ auth.uid() optimizado'
            ELSE '➖ No usa auth.uid()'
        END as auth_uid_status,
        -- Detectar uso no optimizado de auth.jwt()
        CASE 
            WHEN pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%auth.jwt()%' 
            AND pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) NOT LIKE '%(SELECT auth.jwt()%'
            THEN '⚠️ auth.jwt() sin optimizar'
            WHEN pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%(SELECT auth.jwt()%'
            THEN '✅ auth.jwt() optimizado'
            ELSE '➖ No usa auth.jwt()'
        END as auth_jwt_status
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
)
SELECT 
    tablename,
    policyname,
    cmd as operation,
    auth_uid_status,
    auth_jwt_status,
    CASE 
        WHEN auth_uid_status LIKE '%sin optimizar%' OR auth_jwt_status LIKE '%sin optimizar%'
        THEN '❌ NECESITA OPTIMIZACIÓN'
        ELSE '✅ OK'
    END as performance_status,
    policy_definition
FROM policy_analysis
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- 4. MOSTRAR POLÍTICAS QUE NECESITAN CORRECCIÓN
-- ============================================================================

SELECT 
    '🔧 POLÍTICAS QUE NECESITAN CORRECCIÓN:' as action_needed;

WITH problems AS (
    SELECT 
        tablename,
        policyname,
        pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) as policy_def
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
    AND (
        (pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%auth.uid()%' 
         AND pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) NOT LIKE '%(SELECT auth.uid())%')
        OR 
        (pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%auth.jwt()%' 
         AND pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) NOT LIKE '%(SELECT auth.jwt()%')
    )
)
SELECT 
    tablename + ' -> ' + policyname as problema,
    'Contiene auth.uid() o auth.jwt() sin SELECT' as razon
FROM problems;

-- ============================================================================
-- 5. CONTAR PROBLEMAS TOTALES
-- ============================================================================

WITH total_problems AS (
    SELECT COUNT(*) as problem_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
    AND (
        (pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%auth.uid()%' 
         AND pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) NOT LIKE '%(SELECT auth.uid())%')
        OR 
        (pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%auth.jwt()%' 
         AND pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) NOT LIKE '%(SELECT auth.jwt()%')
    )
)
SELECT 
    problem_count,
    CASE 
        WHEN problem_count = 0 THEN '🎉 ¡Todas las políticas están optimizadas!'
        WHEN problem_count = 1 THEN '⚠️ 1 política necesita optimización'
        ELSE '⚠️ ' + problem_count::text + ' políticas necesitan optimización'
    END as summary
FROM total_problems;

-- ============================================================================
-- 6. SCRIPT DE CORRECCIÓN AUTOMÁTICA (si hay problemas)
-- ============================================================================

SELECT 
    '📝 PARA CORREGIR AUTOMÁTICAMENTE, EJECUTA EL SCRIPT: migrations/fix_rls_missing_tables.sql' as next_step; 