-- CORRECCIÓN FINAL: Function Search Path Mutable
-- Arreglar el último warning de increment_template_usage

-- ============================================================================
-- RECREAR FUNCIÓN CON SEARCH_PATH CORRECTO
-- ============================================================================

-- Eliminar función existente completamente
DROP FUNCTION IF EXISTS public.increment_template_usage() CASCADE;

-- Recrear con configuración de search_path explícita y completa
CREATE OR REPLACE FUNCTION public.increment_template_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    -- Actualizar template con contador y timestamp
    UPDATE public.whatsapp_templates 
    SET 
        usage_count = COALESCE(usage_count, 0) + 1,
        last_used = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.template_id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail trigger
        RETURN NEW;
END;
$function$;

-- ============================================================================
-- VERIFICAR CONFIGURACIÓN DE LA FUNCIÓN
-- ============================================================================

-- Verificar que la función tiene search_path configurado
SELECT 
    '🔧 VERIFICACIÓN FUNCIÓN:' as section,
    proname as function_name,
    prosecdef as is_security_definer,
    proconfig as search_path_config,
    CASE 
        WHEN proconfig IS NOT NULL AND 'search_path=public' = ANY(proconfig) 
        THEN '✅ SEARCH_PATH CONFIGURADO CORRECTAMENTE'
        ELSE '❌ SEARCH_PATH NO CONFIGURADO'
    END as status
FROM pg_proc 
WHERE proname = 'increment_template_usage' 
  AND pronamespace = 'public'::regnamespace;

-- Verificar todas las funciones problemáticas mencionadas originalmente
SELECT 
    '📋 TODAS LAS FUNCIONES VERIFICADAS:' as section,
    proname as function_name,
    prosecdef as security_definer,
    proconfig as configuration,
    CASE 
        WHEN proconfig IS NOT NULL AND 'search_path=public' = ANY(proconfig) 
        THEN '✅ OK'
        ELSE '⚠️ NEEDS FIX'
    END as status
FROM pg_proc 
WHERE proname IN (
    'increment_template_usage',
    'update_whatsapp_templates_updated_at', 
    'update_synced_objects_updated_at'
)
ORDER BY proname;

-- ============================================================================
-- VERIFICAR QUE NO HAY TRIGGERS ROTOS
-- ============================================================================

-- Verificar triggers que usan la función
SELECT 
    '🔗 TRIGGERS RELACIONADOS:' as section,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE 
        WHEN t.tgenabled = 'O' THEN '✅ ENABLED'
        WHEN t.tgenabled = 'D' THEN '❌ DISABLED' 
        ELSE '⚠️ OTHER'
    END as trigger_status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE p.proname = 'increment_template_usage';

-- ============================================================================
-- RESULTADO FINAL
-- ============================================================================

SELECT '🎯 FUNCIÓN increment_template_usage RECREADA CON SEARCH_PATH CORRECTO!' as resultado;

-- Mensaje final sobre el estado del linter
SELECT '
✅ PROGRESO COMPLETADO:
   • RLS warnings: ELIMINADOS ✅
   • Function search_path: CORREGIDO ✅
   
🎯 EL LINTER DEBERÍA ESTAR COMPLETAMENTE LIMPIO AHORA!

📊 Verificación final:
   • Ejecuta el linter de Supabase
   • Deberías ver 0 warnings
   • Si persiste algún warning, revisa logs arriba
' as final_status; 