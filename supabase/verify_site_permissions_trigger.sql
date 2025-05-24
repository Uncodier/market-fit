-- =====================================================
-- SCRIPT DE VERIFICACIÓN DE TRIGGERS PARA PERMISOS
-- Solo verifica (sin modificar) si existen los triggers
-- necesarios para activar site_members al crear usuarios
-- =====================================================

-- 1. VERIFICAR ESTRUCTURA DE TABLAS
-- =====================================================

SELECT 
    'VERIFICACIÓN DE TABLAS' AS seccion,
    '===================' AS separador;

-- Verificar existencia de tablas críticas
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        ) THEN '✓ EXISTE'
        ELSE '✗ NO EXISTE'
    END AS estado
FROM (
    VALUES 
        ('site_members'),
        ('profiles'),
        ('sites')
) AS required_tables(table_name);

-- 2. VERIFICAR CAMPOS CRÍTICOS EN SITE_MEMBERS
-- =====================================================

SELECT 
    'VERIFICACIÓN DE CAMPOS EN SITE_MEMBERS' AS seccion,
    '=======================================' AS separador;

SELECT 
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name IN ('user_id', 'email', 'status', 'site_id', 'role') 
        THEN '✓ CAMPO CRÍTICO'
        ELSE '○ CAMPO OPCIONAL'
    END AS importancia
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'site_members'
ORDER BY 
    CASE column_name 
        WHEN 'user_id' THEN 1
        WHEN 'email' THEN 2
        WHEN 'status' THEN 3
        WHEN 'site_id' THEN 4
        WHEN 'role' THEN 5
        ELSE 6
    END;

-- 3. VERIFICAR EXISTENCIA DE FUNCIÓN PARA ACTIVAR SITE_MEMBERS
-- =====================================================

SELECT 
    'VERIFICACIÓN DE FUNCIÓN DE ACTIVACIÓN' AS seccion,
    '=====================================' AS separador;

SELECT 
    proname AS nombre_funcion,
    prosrc AS definicion_funcion,
    CASE 
        WHEN proname = 'activate_pending_site_members' 
        THEN '✓ FUNCIÓN ENCONTRADA'
        ELSE '○ OTRA FUNCIÓN'
    END AS estado
FROM pg_proc 
WHERE proname LIKE '%activate%' 
    OR proname LIKE '%site_member%'
    OR proname LIKE '%pending%';

-- Si no encuentra ninguna función relacionada
SELECT 
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname LIKE '%activate%' 
                OR proname LIKE '%site_member%'
                OR proname LIKE '%pending%'
        ) THEN '✗ NO SE ENCONTRARON FUNCIONES RELACIONADAS'
        ELSE '✓ SE ENCONTRARON FUNCIONES RELACIONADAS'
    END AS estado_funciones;

-- 4. VERIFICAR EXISTENCIA DE TRIGGERS
-- =====================================================

SELECT 
    'VERIFICACIÓN DE TRIGGERS' AS seccion,
    '========================' AS separador;

-- Verificar triggers en la tabla profiles
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    CASE 
        WHEN trigger_name LIKE '%activate%' OR trigger_name LIKE '%site_member%'
        THEN '✓ TRIGGER RELACIONADO CON SITE_MEMBERS'
        ELSE '○ OTRO TRIGGER'
    END AS relevancia
FROM information_schema.triggers 
WHERE event_object_table = 'profiles'
    AND event_object_schema = 'public';

-- Verificar si existe específicamente el trigger que necesitamos
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE event_object_table = 'profiles'
                AND event_object_schema = 'public'
                AND (trigger_name LIKE '%activate%' OR trigger_name LIKE '%site_member%')
                AND event_manipulation = 'INSERT'
        ) THEN '✓ TRIGGER DE ACTIVACIÓN ENCONTRADO'
        ELSE '✗ NO SE ENCONTRÓ TRIGGER DE ACTIVACIÓN'
    END AS estado_trigger_principal;

-- 5. VERIFICAR ESTADO ACTUAL DE SITE_MEMBERS
-- =====================================================

SELECT 
    'ESTADO ACTUAL DE SITE_MEMBERS' AS seccion,
    '==============================' AS separador;

-- Contar registros por estado
SELECT 
    status,
    COUNT(*) AS cantidad,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS porcentaje
FROM public.site_members 
GROUP BY status
ORDER BY cantidad DESC;

-- 6. VERIFICAR MIEMBROS QUE PODRÍAN NECESITAR ACTIVACIÓN
-- =====================================================

SELECT 
    'ANÁLISIS DE MIEMBROS PENDIENTES' AS seccion,
    '================================' AS separador;

-- Miembros pendientes sin cuenta de usuario
SELECT 
    'Miembros pendientes SIN cuenta creada' AS categoria,
    COUNT(*) AS cantidad
FROM public.site_members sm
LEFT JOIN public.profiles p ON sm.email = p.email
WHERE sm.status = 'pending' AND p.id IS NULL

UNION ALL

-- Miembros pendientes CON cuenta de usuario (necesitan activación)
SELECT 
    'Miembros pendientes CON cuenta creada (necesitan activación)' AS categoria,
    COUNT(*) AS cantidad
FROM public.site_members sm
INNER JOIN public.profiles p ON sm.email = p.email
WHERE sm.status = 'pending' AND sm.user_id IS NULL

UNION ALL

-- Miembros ya activos
SELECT 
    'Miembros activos correctamente' AS categoria,
    COUNT(*) AS cantidad
FROM public.site_members
WHERE status = 'active' AND user_id IS NOT NULL;

-- 7. VERIFICAR COINCIDENCIAS ENTRE PROFILES Y SITE_MEMBERS
-- =====================================================

SELECT 
    'ANÁLISIS DE COINCIDENCIAS EMAIL' AS seccion,
    '================================' AS separador;

-- Emails en profiles que tienen site_members
SELECT 
    'Usuarios con site_members asignados' AS categoria,
    COUNT(DISTINCT p.email) AS cantidad
FROM public.profiles p
INNER JOIN public.site_members sm ON p.email = sm.email;

-- Emails en site_members que NO tienen profiles
SELECT 
    'Site_members sin cuenta de usuario' AS categoria,
    COUNT(DISTINCT sm.email) AS cantidad
FROM public.site_members sm
LEFT JOIN public.profiles p ON sm.email = p.email
WHERE p.id IS NULL;

-- 8. DETALLES DE MIEMBROS QUE NECESITAN ACTIVACIÓN
-- =====================================================

SELECT 
    'DETALLES DE CASOS QUE NECESITAN ACTIVACIÓN' AS seccion,
    '===========================================' AS separador;

-- Mostrar casos específicos que necesitarían activación automática
SELECT 
    sm.email,
    sm.status AS estado_site_member,
    sm.role AS rol_asignado,
    s.name AS nombre_sitio,
    sm.created_at AS fecha_invitacion,
    CASE 
        WHEN p.id IS NOT NULL THEN 'Tiene cuenta de usuario'
        ELSE 'Sin cuenta de usuario'
    END AS estado_cuenta
FROM public.site_members sm
LEFT JOIN public.profiles p ON sm.email = p.email
LEFT JOIN public.sites s ON sm.site_id = s.id
WHERE sm.status = 'pending'
ORDER BY sm.created_at DESC
LIMIT 10;

-- 9. RESUMEN FINAL DE VERIFICACIÓN
-- =====================================================

SELECT 
    'RESUMEN DE VERIFICACIÓN' AS seccion,
    '=======================' AS separador;

SELECT 
    'ELEMENTO' AS componente,
    'ESTADO' AS estado,
    'DESCRIPCIÓN' AS descripcion

UNION ALL

SELECT 
    'Tabla site_members',
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_members')
        THEN '✓ EXISTE'
        ELSE '✗ NO EXISTE'
    END,
    'Tabla principal para permisos de sitio'

UNION ALL

SELECT 
    'Tabla profiles',
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles')
        THEN '✓ EXISTE'
        ELSE '✗ NO EXISTE'
    END,
    'Tabla de perfiles de usuario'

UNION ALL

SELECT 
    'Función de activación',
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname LIKE '%activate%site%member%')
        THEN '✓ EXISTE'
        ELSE '✗ NO EXISTE'
    END,
    'Función para activar miembros pendientes'

UNION ALL

SELECT 
    'Trigger de activación',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE event_object_table = 'profiles'
                AND (trigger_name LIKE '%activate%' OR trigger_name LIKE '%site_member%')
        )
        THEN '✓ EXISTE'
        ELSE '✗ NO EXISTE'
    END,
    'Trigger automático al crear usuario'

UNION ALL

SELECT 
    'Miembros pendientes que necesitan activación',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.site_members sm
            INNER JOIN public.profiles p ON sm.email = p.email
            WHERE sm.status = 'pending' AND sm.user_id IS NULL
        )
        THEN '⚠ HAY CASOS PENDIENTES'
        ELSE '✓ NO HAY CASOS PENDIENTES'
    END,
    'Usuarios con cuenta creada pero sin activar en site_members';

-- 10. RECOMENDACIONES BASADAS EN LA VERIFICACIÓN
-- =====================================================

SELECT 
    'RECOMENDACIONES' AS seccion,
    '===============' AS separador;

-- Mostrar recomendaciones basadas en lo encontrado
WITH verificacion AS (
    SELECT 
        EXISTS (SELECT 1 FROM pg_proc WHERE proname LIKE '%activate%site%member%') AS tiene_funcion,
        EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE event_object_table = 'profiles'
                AND (trigger_name LIKE '%activate%' OR trigger_name LIKE '%site_member%')
        ) AS tiene_trigger,
        EXISTS (
            SELECT 1 FROM public.site_members sm
            INNER JOIN public.profiles p ON sm.email = p.email
            WHERE sm.status = 'pending' AND sm.user_id IS NULL
        ) AS tiene_pendientes
)
SELECT 
    CASE 
        WHEN NOT tiene_funcion AND NOT tiene_trigger THEN 
            '1. CREAR función y trigger para activación automática de site_members'
        WHEN tiene_funcion AND NOT tiene_trigger THEN 
            '2. CREAR trigger que use la función existente'
        WHEN NOT tiene_funcion AND tiene_trigger THEN 
            '3. VERIFICAR que el trigger tenga una función válida'
        WHEN tiene_funcion AND tiene_trigger AND tiene_pendientes THEN 
            '4. EJECUTAR reparación para activar miembros pendientes existentes'
        WHEN tiene_funcion AND tiene_trigger AND NOT tiene_pendientes THEN 
            '✓ SISTEMA CONFIGURADO CORRECTAMENTE'
        ELSE 
            '5. REVISAR configuración manualmente'
    END AS recomendacion
FROM verificacion; 