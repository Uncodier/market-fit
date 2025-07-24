-- Script específico para corregir increment_template_usage
-- Esta función parece tener una definición más compleja

-- ============================================================================
-- PASO 1: VERIFICAR LA FUNCIÓN ACTUAL
-- ============================================================================

SELECT 
    'Verificando función increment_template_usage:' as status;

SELECT 
    proname as function_name,
    prosecdef as security_definer,
    proconfig as current_config,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'increment_template_usage'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- PASO 2: ELIMINAR FUNCIÓN Y TRIGGERS RELACIONADOS
-- ============================================================================

-- Eliminar triggers que usen esta función
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    -- Buscar todos los triggers que usan esta función
    FOR trigger_rec IN 
        SELECT DISTINCT n.nspname as schemaname, c.relname as tablename, t.tgname as triggername
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE p.proname = 'increment_template_usage'
        AND n.nspname = 'public'
        AND NOT t.tgisinternal
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', 
                      trigger_rec.triggername, 
                      trigger_rec.schemaname, 
                      trigger_rec.tablename);
        RAISE NOTICE 'Dropped trigger: %', trigger_rec.triggername;
    END LOOP;
END $$;

-- Eliminar la función
DROP FUNCTION IF EXISTS public.increment_template_usage() CASCADE;

-- ============================================================================
-- PASO 3: RECREAR FUNCIÓN CON SEARCH_PATH FIJO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_template_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    -- Incrementar contador de uso y actualizar timestamp
    UPDATE public.whatsapp_templates 
    SET usage_count = COALESCE(usage_count, 0) + 1,
        last_used = CURRENT_TIMESTAMP
    WHERE id = NEW.template_id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error pero no fallar el INSERT/UPDATE principal
        RAISE WARNING 'Error incrementing template usage: %', SQLERRM;
        RETURN NEW;
END;
$function$;

-- ============================================================================
-- PASO 4: VERIFICAR SI NECESITA TRIGGER ESPECÍFICO
-- ============================================================================

-- Verificar si existe una tabla que necesite este trigger
DO $$
BEGIN
    -- Intentar recrear trigger si hay una tabla relacionada con templates
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'whatsapp_template_messages' 
               AND column_name = 'template_id') THEN
        
        CREATE TRIGGER increment_template_usage_trigger
            AFTER INSERT ON public.whatsapp_template_messages
            FOR EACH ROW
            EXECUTE FUNCTION public.increment_template_usage();
            
        RAISE NOTICE 'Created trigger on whatsapp_template_messages';
        
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'messages' 
                  AND column_name = 'template_id') THEN
        
        CREATE TRIGGER increment_template_usage_trigger
            AFTER INSERT ON public.messages
            FOR EACH ROW
            WHEN (NEW.template_id IS NOT NULL)
            EXECUTE FUNCTION public.increment_template_usage();
            
        RAISE NOTICE 'Created trigger on messages';
        
    ELSE
        RAISE NOTICE 'No suitable table found for increment_template_usage trigger';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create trigger: %', SQLERRM;
END $$;

-- ============================================================================
-- PASO 5: VERIFICACIÓN FINAL
-- ============================================================================

SELECT 
    'Verificación final de increment_template_usage:' as status;

SELECT 
    proname as function_name,
    prosecdef as security_definer,
    proconfig as search_path_config,
    CASE 
        WHEN proconfig IS NOT NULL AND 'search_path=public' = ANY(proconfig) THEN '✅ Search path configurado correctamente'
        WHEN proconfig IS NOT NULL THEN '⚠️ Search path parcialmente configurado: ' || array_to_string(proconfig, ', ')
        ELSE '❌ Sin search path configurado'
    END as status
FROM pg_proc 
WHERE proname = 'increment_template_usage'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Verificar triggers activos
SELECT 
    'Triggers activos para increment_template_usage:' as info;

SELECT 
    n.nspname as schemaname,
    c.relname as tablename,
    t.tgname as triggername,
    'Trigger activo' as status
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE p.proname = 'increment_template_usage'
AND n.nspname = 'public'
AND NOT t.tgisinternal;

SELECT '🎯 Script de increment_template_usage completado!' as resultado; 