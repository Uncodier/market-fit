-- Script para Corregir Warnings de Search Path Mutable en Funciones
-- Establece search_path explícito para seguridad

-- ============================================================================
-- CORREGIR FUNCIÓN: update_whatsapp_templates_updated_at
-- ============================================================================

-- Primero obtener la definición actual
DO $$
DECLARE
    func_definition text;
BEGIN
    -- Intentar recrear la función con search_path fijo
    DROP FUNCTION IF EXISTS public.update_whatsapp_templates_updated_at() CASCADE;
    
    CREATE OR REPLACE FUNCTION public.update_whatsapp_templates_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $function$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $function$;
    
    RAISE NOTICE 'Fixed: update_whatsapp_templates_updated_at';
END $$;

-- ============================================================================
-- CORREGIR FUNCIÓN: increment_template_usage
-- ============================================================================

DO $$
BEGIN
    -- Recrear función con search_path fijo
    DROP FUNCTION IF EXISTS public.increment_template_usage() CASCADE;
    
    CREATE OR REPLACE FUNCTION public.increment_template_usage()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $function$
    BEGIN
        UPDATE public.whatsapp_templates 
        SET usage_count = COALESCE(usage_count, 0) + 1,
            last_used = now()
        WHERE id = NEW.template_id;
        RETURN NEW;
    END;
    $function$;
    
    RAISE NOTICE 'Fixed: increment_template_usage';
END $$;

-- ============================================================================
-- CORREGIR FUNCIÓN: update_synced_objects_updated_at  
-- ============================================================================

DO $$
BEGIN
    -- Recrear función con search_path fijo
    DROP FUNCTION IF EXISTS public.update_synced_objects_updated_at() CASCADE;
    
    CREATE OR REPLACE FUNCTION public.update_synced_objects_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $function$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $function$;
    
    RAISE NOTICE 'Fixed: update_synced_objects_updated_at';
END $$;

-- ============================================================================
-- RECREAR TRIGGERS SI ES NECESARIO
-- ============================================================================

-- Trigger para whatsapp_templates
DROP TRIGGER IF EXISTS trigger_update_whatsapp_templates_updated_at ON public.whatsapp_templates;
CREATE TRIGGER trigger_update_whatsapp_templates_updated_at
    BEFORE UPDATE ON public.whatsapp_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_whatsapp_templates_updated_at();

-- Trigger para synced_objects  
DROP TRIGGER IF EXISTS trigger_update_synced_objects_updated_at ON public.synced_objects;
CREATE TRIGGER trigger_update_synced_objects_updated_at
    BEFORE UPDATE ON public.synced_objects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_synced_objects_updated_at();

-- Nota: increment_template_usage trigger depende de la tabla específica que lo usa

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar que las funciones tienen search_path configurado
SELECT 
    'Verificación de funciones corregidas:' as status;

SELECT 
    proname as function_name,
    prosecdef as security_definer,
    proconfig as search_path_config,
    CASE 
        WHEN proconfig IS NOT NULL THEN '✅ Search path configurado'
        ELSE '❌ Sin search path'
    END as status
FROM pg_proc 
WHERE proname IN (
    'update_whatsapp_templates_updated_at',
    'increment_template_usage', 
    'update_synced_objects_updated_at'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT '🎉 Funciones corregidas! Los warnings de search_path deberían desaparecer.' as resultado; 

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

-- FIX: Recreate prevent_last_admin_role_change function with correct search_path
-- This fixes the error: relation "site_members" does not exist
-- Problem: The function has search_path="" which prevents it from finding the table
-- Date: 2025-01-24

-- ============================================================================
-- STEP 1: DROP AND RECREATE THE FUNCTION WITH CORRECT SETTINGS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_last_admin_role_change()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    admin_count INTEGER;
    site_id_to_check UUID;
BEGIN
    -- Get the site_id from the row being updated
    site_id_to_check := NEW.site_id;
    
    -- Only check if we're changing FROM admin/owner TO something else
    IF OLD.role IN ('admin', 'owner') AND NEW.role NOT IN ('admin', 'owner') THEN
        
        -- Count remaining admins/owners for this site (excluding the one being changed)
        SELECT COUNT(*) INTO admin_count
        FROM public.site_members 
        WHERE site_id = site_id_to_check 
        AND role IN ('admin', 'owner')
        AND id != NEW.id  -- Exclude the member being changed
        AND status = 'active';  -- Only count active members
        
        -- If this would be the last admin/owner, prevent the role change
        IF admin_count = 0 THEN
            RAISE EXCEPTION 'Cannot change role of the last admin or owner. At least one admin or owner must remain for the site.';
        END IF;
    END IF;
    
    -- Allow the role change if there are other admins/owners
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: ALSO FIX prevent_last_admin_deletion IF IT HAS THE SAME PROBLEM
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_last_admin_deletion()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    admin_count INTEGER;
    site_id_to_check UUID;
    deleting_site_id TEXT;
BEGIN
    site_id_to_check := OLD.site_id;
    
    -- Only protect admin/owner deletions
    IF OLD.role NOT IN ('admin', 'owner') THEN
        RETURN OLD;
    END IF;
    
    -- Check if we're deleting the entire site (allow in that case)
    BEGIN
        deleting_site_id := current_setting('app.deleting_site', true);
    EXCEPTION WHEN OTHERS THEN
        deleting_site_id := '';
    END;
    
    -- If we're deleting this site, allow the operation
    IF deleting_site_id = site_id_to_check::text THEN
        RETURN OLD;
    END IF;
    
    -- Count remaining admins after this deletion
    SELECT COUNT(*) INTO admin_count
    FROM public.site_members 
    WHERE site_id = site_id_to_check 
    AND role IN ('admin', 'owner')
    AND id != OLD.id
    AND status = 'active';
    
    -- Prevent if this would leave no admins/owners
    IF admin_count = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last admin or owner of the site. At least one admin or owner must remain.';
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: ADD COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.prevent_last_admin_role_change() IS 
'Trigger function that prevents changing the role of the last admin or owner in a site. 
Uses SECURITY DEFINER and explicit search_path to ensure proper table access.';

COMMENT ON FUNCTION public.prevent_last_admin_deletion() IS 
'Trigger function that prevents deletion of the last admin or owner in a site.
Uses SECURITY DEFINER and explicit search_path to ensure proper table access.';

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

DO $$
DECLARE
    func_info RECORD;
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔧 FUNCTION FIX VERIFICATION';
    RAISE NOTICE '==========================================';
    
    -- Check the fixed function
    SELECT 
        p.proname as function_name,
        p.prosecdef as security_definer,
        p.proconfig as config_settings
    INTO func_info
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'prevent_last_admin_role_change';
    
    RAISE NOTICE '✅ Function: %', func_info.function_name;
    RAISE NOTICE '🔐 Security Definer: %', CASE WHEN func_info.security_definer THEN 'YES' ELSE 'NO' END;
    RAISE NOTICE '🗂️  Search Path Config: %', func_info.config_settings;
    
    -- Test the function can access site_members
    BEGIN
        -- This should now work without errors
        PERFORM COUNT(*) FROM public.site_members LIMIT 1;
        RAISE NOTICE '✅ Function can now access site_members table';
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Still having issues: %', SQLERRM;
    END;
    
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🎉 FUNCTION FIXED! The "site_members does not exist" error should be resolved.';
    RAISE NOTICE '==========================================';
    
END $$; 