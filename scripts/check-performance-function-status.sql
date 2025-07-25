-- ============================================================================
-- DIAGNÓSTICO RÁPIDO: función get_performance_status
-- ============================================================================
-- Este script verifica si la función get_performance_status funciona 
-- correctamente y puede acceder a la tabla commands

-- Verificar componentes básicos
SELECT '🔍 VERIFICANDO COMPONENTES...' as status;

SELECT 
    'Tabla commands' as component,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commands')
        THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as status;

SELECT 
    'Función get_performance_status' as component,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_performance_status')
        THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as status;

-- Probar la función directamente
SELECT '🧪 PROBANDO FUNCIÓN...' as status;

DO $$
DECLARE
    test_command_id uuid;
    function_works boolean := false;
BEGIN
    -- Intentar obtener un command_id para probar
    SELECT id INTO test_command_id 
    FROM public.commands 
    LIMIT 1;
    
    IF test_command_id IS NOT NULL THEN
        -- Probar la función
        PERFORM public.get_performance_status(test_command_id);
        function_works := true;
        RAISE NOTICE '✅ FUNCIÓN FUNCIONA: get_performance_status puede acceder a la tabla commands';
    ELSE
        RAISE NOTICE '⚠️  NO HAY COMANDOS: La función no se puede probar, pero debería funcionar';
    END IF;
    
EXCEPTION 
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERROR EN FUNCIÓN: %', SQLERRM;
        RAISE NOTICE '🔧 SOLUCIÓN: Ejecuta fix-get-performance-status-function.sql';
END $$;

-- Verificar search_path de la función
SELECT 
    '🔧 CONFIGURACIÓN FUNCIÓN' as check_type,
    routine_name,
    external_language,
    CASE 
        WHEN routine_name = 'get_performance_status' 
        THEN '✅ FUNCIÓN CONFIGURADA'
        ELSE '❌ PROBLEMA DE CONFIGURACIÓN'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'get_performance_status';

-- Mostrar resumen
SELECT 
    '📋 RESUMEN' as result_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_performance_status')
             AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commands')
        THEN '✅ Todo parece estar bien - Si sigues viendo errores, ejecuta fix-get-performance-status-function.sql'
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commands')
        THEN '❌ TABLA COMMANDS FALTA - Problema serio de base de datos'
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_performance_status')
        THEN '❌ FUNCIÓN FALTA - Ejecuta fix-get-performance-status-function.sql'
        ELSE '❓ ESTADO DESCONOCIDO - Ejecuta fix-get-performance-status-function.sql'
    END as diagnosis; 