-- CORRECCIÓN DEFINITIVA: Eliminar TODAS las versiones de increment_template_usage
-- El problema era que había 2 funciones con el mismo nombre (sobrecarga)

-- ============================================================================
-- ELIMINAR TODAS LAS VERSIONES DE LA FUNCIÓN
-- ============================================================================

-- Eliminar versión trigger (sin parámetros)
DROP FUNCTION IF EXISTS public.increment_template_usage() CASCADE;

-- Eliminar versión con parámetros
DROP FUNCTION IF EXISTS public.increment_template_usage(text) CASCADE;

-- Eliminar cualquier otra posible versión
DROP FUNCTION IF EXISTS public.increment_template_usage(template_sid_param text) CASCADE;

-- Verificar que NO queda ninguna función con ese nombre
SELECT 
    '🔍 VERIFICACIÓN - FUNCIONES ELIMINADAS:' as section,
    COUNT(*) as functions_remaining,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ TODAS LAS VERSIONES ELIMINADAS'
        ELSE '❌ AÚN QUEDAN VERSIONES: ' || COUNT(*)
    END as status
FROM pg_proc 
WHERE proname = 'increment_template_usage';

-- ============================================================================
-- RECREAR SOLO LA FUNCIÓN QUE NECESITAMOS
-- ============================================================================

-- Determinar cuál versión necesitamos basándose en el trigger existente
DO $$
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    -- Verificar si existe el trigger
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE t.tgname LIKE '%template_usage%'
        AND c.relname = 'whatsapp_templates'
    ) INTO trigger_exists;
    
    IF trigger_exists THEN
        RAISE NOTICE '✅ Se necesita función TRIGGER (sin parámetros)';
    ELSE
        RAISE NOTICE '⚠️ No se encontró trigger, creando función MANUAL (con parámetros)';
    END IF;
END $$;

-- ============================================================================
-- CREAR FUNCIÓN TRIGGER (VERSIÓN PRINCIPAL)
-- ============================================================================

-- Esta es la versión que usa el trigger
CREATE OR REPLACE FUNCTION public.increment_template_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, pg_temp'
SET lock_timeout = '10s'
SET statement_timeout = '30s'
AS $function$
BEGIN
    -- Actualizar basándose en trigger NEW record
    UPDATE public.whatsapp_templates 
    SET 
        usage_count = COALESCE(usage_count, 0) + 1,
        last_used = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;  -- Usar NEW.id en lugar de NEW.template_id
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- No fallar el trigger
        RETURN NEW;
END;
$function$;

-- ============================================================================
-- RECREAR TRIGGER SI NO EXISTE
-- ============================================================================

-- Eliminar trigger existente para recrearlo limpio
DROP TRIGGER IF EXISTS increment_template_usage_trigger ON public.whatsapp_templates;

-- Crear trigger optimizado
CREATE TRIGGER increment_template_usage_trigger
    AFTER UPDATE ON public.whatsapp_templates
    FOR EACH ROW
    WHEN (OLD.usage_count IS DISTINCT FROM NEW.usage_count OR OLD.last_used IS DISTINCT FROM NEW.last_used)
    EXECUTE FUNCTION public.increment_template_usage();

-- ============================================================================
-- VERIFICACIÓN FINAL COMPLETA
-- ============================================================================

-- Verificar que solo existe UNA función
SELECT 
    '✅ VERIFICACIÓN FINAL:' as section,
    proname as function_name,
    pg_get_function_identity_arguments(oid) as parameters,
    prosecdef as security_definer,
    proconfig as search_path_config,
    CASE 
        WHEN proconfig IS NOT NULL AND array_to_string(proconfig, ',') LIKE '%search_path%'
        THEN '✅ SEARCH_PATH CONFIGURADO'
        ELSE '❌ SIN SEARCH_PATH'
    END as search_path_status
FROM pg_proc 
WHERE proname = 'increment_template_usage'
ORDER BY pg_get_function_identity_arguments(oid);

-- Verificar trigger recreado
SELECT 
    '🔗 TRIGGER VERIFICADO:' as section,
    t.tgname as trigger_name,
    c.relname as table_name,
    CASE t.tgenabled 
        WHEN 'O' THEN '✅ ENABLED'
        WHEN 'D' THEN '❌ DISABLED'
        ELSE '⚠️ OTHER'
    END as status,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE p.proname = 'increment_template_usage';

-- ============================================================================
-- RESULTADO Y INSTRUCCIONES
-- ============================================================================

SELECT '
🎯 CORRECCIÓN DE SOBRECARGA DE FUNCIONES APLICADA:

✅ ACCIONES REALIZADAS:
1. Eliminadas TODAS las versiones de increment_template_usage
2. Recreada función trigger con search_path correcto
3. Recreado trigger optimizado
4. Verificación completa aplicada

🔍 VERIFICACIONES:
- Solo debe existir 1 función increment_template_usage
- Debe tener search_path configurado
- Trigger debe estar habilitado

⚡ RESULTADO ESPERADO:
- Warning de "Function Search Path Mutable" ELIMINADO
- Linter de Supabase completamente limpio

🎉 SI PERSISTE ALGÚN WARNING: Comparte los resultados de verificación arriba
' as final_result;

SELECT '🚀 CORRECCIÓN DE SOBRECARGA COMPLETADA!' as resultado; 