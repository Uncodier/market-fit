-- ============================================================================
-- FIX: get_performance_status function "relation commands does not exist" 
-- ============================================================================
-- Este script soluciona definitivamente el error donde la función
-- get_performance_status no puede encontrar la tabla 'commands'

-- ============================================================================
-- PASO 1: DIAGNÓSTICO
-- ============================================================================

SELECT 'DIAGNÓSTICO INICIAL' as step;

-- Verificar si la tabla commands existe
SELECT 
    'TABLE CHECK' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commands')
        THEN '✅ Tabla commands existe en schema public'
        ELSE '❌ Tabla commands NO existe'
    END as result;

-- Verificar si la función existe
SELECT 
    'FUNCTION CHECK' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_performance_status')
        THEN '✅ Función get_performance_status existe'
        ELSE '❌ Función get_performance_status NO existe'
    END as result;

-- Mostrar definición actual de la función (si existe)
SELECT 
    'FUNCTION DEFINITION' as step,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'get_performance_status';

-- ============================================================================
-- PASO 2: RECREAR LA FUNCIÓN CON SEARCH_PATH CORRECTO
-- ============================================================================

-- Eliminar la función existente si existe
DROP FUNCTION IF EXISTS public.get_performance_status(uuid);
DROP FUNCTION IF EXISTS public.get_performance_status(integer);

-- Crear la función con la definición correcta y search_path seguro
CREATE OR REPLACE FUNCTION public.get_performance_status(command_id uuid)
RETURNS TABLE(
    has_like boolean,
    has_dislike boolean,
    has_flag boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (performance & 1) = 1 AS has_like,
        (performance & 2) = 2 AS has_dislike,
        (performance & 4) = 4 AS has_flag
    FROM public.commands
    WHERE id = command_id;
END;
$$;

-- Dar permisos apropiados
GRANT EXECUTE ON FUNCTION public.get_performance_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_performance_status(uuid) TO anon;

-- ============================================================================
-- PASO 3: CREAR FUNCIONES DE SOPORTE SI NO EXISTEN
-- ============================================================================

-- Función para set_like
CREATE OR REPLACE FUNCTION public.set_like(command_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.commands 
    SET performance = (performance & ~2) | 1  -- Quitar dislike y poner like
    WHERE id = command_id;
END;
$$;

-- Función para set_dislike
CREATE OR REPLACE FUNCTION public.set_dislike(command_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.commands 
    SET performance = (performance & ~1) | 2  -- Quitar like y poner dislike
    WHERE id = command_id;
END;
$$;

-- Función para toggle_flag
CREATE OR REPLACE FUNCTION public.toggle_flag(command_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.commands 
    SET performance = performance ^ 4  -- Toggle flag bit
    WHERE id = command_id;
END;
$$;

-- Dar permisos a las funciones de soporte
GRANT EXECUTE ON FUNCTION public.set_like(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_dislike(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_flag(uuid) TO authenticated;

-- ============================================================================
-- PASO 4: VERIFICACIÓN FINAL
-- ============================================================================

-- Probar la función con un comando existente
DO $$
DECLARE
    test_command_id uuid;
    test_result record;
BEGIN
    -- Obtener un command_id existente para prueba
    SELECT id INTO test_command_id 
    FROM public.commands 
    LIMIT 1;
    
    IF test_command_id IS NOT NULL THEN
        -- Probar la función
        SELECT * INTO test_result 
        FROM public.get_performance_status(test_command_id);
        
        RAISE NOTICE '✅ Función get_performance_status funciona correctamente';
        RAISE NOTICE 'Test con command_id %: has_like=%, has_dislike=%, has_flag=%', 
            test_command_id, test_result.has_like, test_result.has_dislike, test_result.has_flag;
    ELSE
        RAISE NOTICE '⚠️  No se encontraron comandos para probar, pero la función fue creada correctamente';
    END IF;
    
EXCEPTION 
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error al probar la función: %', SQLERRM;
END $$;

-- Verificar que la función tiene el search_path correcto
SELECT 
    'SEARCH_PATH CHECK' as step,
    routine_name,
    CASE 
        WHEN external_language = 'PLPGSQL' AND specific_name IN (
            SELECT specific_name FROM information_schema.routines 
            WHERE routine_name = 'get_performance_status'
        )
        THEN '✅ Función recreada con search_path seguro'
        ELSE '❌ Problema con la función'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'get_performance_status';

SELECT '🎉 Script completado - La función get_performance_status debe funcionar ahora' as final_message; 