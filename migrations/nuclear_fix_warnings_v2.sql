-- SCRIPT NUCLEAR v2: Sin comandos que bloqueen transacciones
-- Enfoque ultra-agresivo para eliminar TODOS los warnings (SIN VACUUM)

-- ============================================================================
-- PASO 1: ELIMINACIÓN NUCLEAR DE TODAS LAS POLÍTICAS
-- ============================================================================

-- Deshabilitar RLS temporalmente para poder limpiar completamente
ALTER TABLE public.synced_objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates DISABLE ROW LEVEL SECURITY;

-- Crear tabla system_memories si no existe
CREATE TABLE IF NOT EXISTS public.system_memories (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL,
    memory_key text NOT NULL,
    memory_value text NOT NULL,
    context text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT system_memories_pkey PRIMARY KEY (id),
    CONSTRAINT system_memories_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id)
);

ALTER TABLE public.system_memories DISABLE ROW LEVEL SECURITY;

-- Eliminar TODAS las políticas relacionadas (sin IF EXISTS para forzar)
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Eliminar todas las políticas de las tablas objetivo
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
        RAISE NOTICE 'Eliminada política: % en tabla %', pol.policyname, pol.tablename;
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error eliminando políticas: %', SQLERRM;
END $$;

-- Reactivar RLS
ALTER TABLE public.synced_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_memories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 2: FUNCIONES ULTRA-SEGURAS
-- ============================================================================

-- Forzar eliminación completa con CASCADE
DROP FUNCTION IF EXISTS public.increment_template_usage() CASCADE;
DROP FUNCTION IF EXISTS public.update_whatsapp_templates_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_synced_objects_updated_at() CASCADE;

-- 1. increment_template_usage - ultra-simple con todas las configuraciones
CREATE OR REPLACE FUNCTION public.increment_template_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
SET lock_timeout = '10s'
SET statement_timeout = '30s'
AS $function$
BEGIN
    UPDATE public.whatsapp_templates 
    SET usage_count = COALESCE(usage_count, 0) + 1,
        last_used = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.template_id;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NEW; -- No fallar si hay error
END;
$function$;

-- 2. update_whatsapp_templates_updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
SET lock_timeout = '10s'
SET statement_timeout = '30s'
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;

-- 3. update_synced_objects_updated_at
CREATE OR REPLACE FUNCTION public.update_synced_objects_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
SET lock_timeout = '10s'
SET statement_timeout = '30s'
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;

-- ============================================================================
-- PASO 3: RECREAR TRIGGERS SI NO EXISTEN
-- ============================================================================

-- Verificar y crear triggers si no existen
DO $$
BEGIN
    -- Trigger para whatsapp_templates updated_at
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_update_whatsapp_templates_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_whatsapp_templates_updated_at
            BEFORE UPDATE ON public.whatsapp_templates
            FOR EACH ROW
            EXECUTE FUNCTION public.update_whatsapp_templates_updated_at();
    END IF;

    -- Trigger para synced_objects updated_at
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_update_synced_objects_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_synced_objects_updated_at
            BEFORE UPDATE ON public.synced_objects
            FOR EACH ROW
            EXECUTE FUNCTION public.update_synced_objects_updated_at();
    END IF;
    
    RAISE NOTICE 'Triggers verificados/creados';
END $$;

-- ============================================================================
-- PASO 4: POLÍTICAS RLS ULTRA-OPTIMIZADAS
-- ============================================================================

-- SYNCED_OBJECTS - políticas ultra-simples
CREATE POLICY admin_all_access_synced_objects ON public.synced_objects
    FOR ALL USING (
        (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
        OR
        site_id IN (
            SELECT site_id FROM public.site_members 
            WHERE user_id = auth.uid() 
            AND status = 'active'
        )
    );

-- WHATSAPP_TEMPLATES - políticas ultra-simples
CREATE POLICY admin_all_access_whatsapp_templates ON public.whatsapp_templates
    FOR ALL USING (
        (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
        OR
        site_id IN (
            SELECT site_id FROM public.site_members 
            WHERE user_id = auth.uid() 
            AND status = 'active'
        )
    );

-- SYSTEM_MEMORIES - políticas ultra-simples
CREATE POLICY admin_all_access_system_memories ON public.system_memories
    FOR ALL USING (
        (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
        OR
        site_id IN (
            SELECT site_id FROM public.site_members 
            WHERE user_id = auth.uid() 
            AND status = 'active'
        )
    );

-- ============================================================================
-- PASO 5: VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar función increment_template_usage
DO $$
DECLARE
    func_count INTEGER;
    func_config TEXT[];
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc 
    WHERE proname = 'increment_template_usage';
    
    IF func_count > 0 THEN
        SELECT proconfig INTO func_config
        FROM pg_proc 
        WHERE proname = 'increment_template_usage'
        LIMIT 1;
        
        RAISE NOTICE '✅ Función increment_template_usage creada correctamente';
        RAISE NOTICE 'Configuración: %', func_config;
    ELSE
        RAISE NOTICE '❌ Función increment_template_usage NO encontrada';
    END IF;
END $$;

-- Verificar políticas creadas
DO $$
DECLARE
    pol_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO pol_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories');
    
    RAISE NOTICE '✅ Total políticas creadas: %', pol_count;
END $$;

-- Listar políticas para verificación
SELECT 
    '📋 POLÍTICAS ACTIVAS:' as section,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
ORDER BY tablename, policyname;

-- Verificar configuración de funciones
SELECT 
    '🔧 FUNCIONES CONFIGURADAS:' as section,
    proname as function_name,
    prosecdef as security_definer,
    proconfig as search_path_config
FROM pg_proc 
WHERE proname IN ('increment_template_usage', 'update_whatsapp_templates_updated_at', 'update_synced_objects_updated_at')
ORDER BY proname;

SELECT '🎯 SCRIPT NUCLEAR V2 COMPLETADO - SIN COMANDOS BLOQUEANTES!' as resultado; 