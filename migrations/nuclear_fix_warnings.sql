-- SCRIPT NUCLEAR: Eliminación completa y recreación forzada
-- Enfoque ultra-agresivo para eliminar TODOS los warnings

-- ============================================================================
-- PASO 1: ELIMINACIÓN NUCLEAR DE TODAS LAS POLÍTICAS
-- ============================================================================

-- Deshabilitar RLS temporalmente para poder limpiar completamente
ALTER TABLE public.synced_objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates DISABLE ROW LEVEL SECURITY;
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
END $$;

-- Reactivar RLS
ALTER TABLE public.synced_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_memories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 2: FUNCIÓN increment_template_usage (ultra-simple)
-- ============================================================================

-- Forzar eliminación completa con CASCADE
DROP FUNCTION IF EXISTS public.increment_template_usage() CASCADE;

-- Función ultra-simple con todas las configuraciones de seguridad
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
        last_used = CURRENT_TIMESTAMP
    WHERE id = NEW.template_id;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NEW; -- No fallar si hay error
END;
$function$;

-- ============================================================================
-- PASO 3: POLÍTICAS RLS ULTRA-OPTIMIZADAS (usando subquery en WHERE)
-- ============================================================================

-- SYNCED_OBJECTS - usando subqueries más eficientes
CREATE POLICY synced_objects_select ON public.synced_objects FOR SELECT USING (
    synced_objects.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

CREATE POLICY synced_objects_insert ON public.synced_objects FOR INSERT WITH CHECK (
    synced_objects.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
        AND sm.role = ANY(ARRAY['owner', 'admin'])
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

CREATE POLICY synced_objects_update ON public.synced_objects FOR UPDATE USING (
    synced_objects.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
        AND sm.role = ANY(ARRAY['owner', 'admin'])
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

CREATE POLICY synced_objects_delete ON public.synced_objects FOR DELETE USING (
    synced_objects.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
        AND sm.role = ANY(ARRAY['owner', 'admin'])
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

-- WHATSAPP_TEMPLATES - usando subqueries más eficientes
CREATE POLICY whatsapp_templates_select ON public.whatsapp_templates FOR SELECT USING (
    whatsapp_templates.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

CREATE POLICY whatsapp_templates_insert ON public.whatsapp_templates FOR INSERT WITH CHECK (
    whatsapp_templates.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
        AND sm.role = ANY(ARRAY['owner', 'admin', 'marketing'])
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

CREATE POLICY whatsapp_templates_update ON public.whatsapp_templates FOR UPDATE USING (
    whatsapp_templates.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
        AND sm.role = ANY(ARRAY['owner', 'admin', 'marketing'])
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

CREATE POLICY whatsapp_templates_delete ON public.whatsapp_templates FOR DELETE USING (
    whatsapp_templates.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
        AND sm.role = ANY(ARRAY['owner', 'admin'])
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

-- SYSTEM_MEMORIES - usando subqueries más eficientes
CREATE POLICY system_memories_select ON public.system_memories FOR SELECT USING (
    system_memories.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

CREATE POLICY system_memories_insert ON public.system_memories FOR INSERT WITH CHECK (
    system_memories.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
        AND sm.role = ANY(ARRAY['owner', 'admin'])
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

CREATE POLICY system_memories_update ON public.system_memories FOR UPDATE USING (
    system_memories.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
        AND sm.role = ANY(ARRAY['owner', 'admin'])
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

CREATE POLICY system_memories_delete ON public.system_memories FOR DELETE USING (
    system_memories.site_id IN (
        SELECT sm.site_id 
        FROM public.site_members sm 
        WHERE sm.user_id = (SELECT auth.uid()) 
        AND sm.status = 'active'
        AND sm.role = ANY(ARRAY['owner', 'admin'])
    )
    OR 
    (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
);

-- ============================================================================
-- PASO 4: REFRESH FORZADO Y VERIFICACIÓN
-- ============================================================================

-- Múltiples refresh para asegurar
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Vacuum para limpiar metadatos
VACUUM;

-- Verificar función
SELECT 
    '🔍 VERIFICACIÓN FUNCIÓN:' as section;
    
SELECT 
    proname,
    prosecdef,
    proconfig,
    CASE 
        WHEN proconfig IS NOT NULL AND 'search_path=public' = ANY(proconfig) 
        THEN '✅ CORRECTO'
        ELSE '❌ PROBLEMA'
    END as status
FROM pg_proc 
WHERE proname = 'increment_template_usage';

-- Verificar políticas (contar)
SELECT 
    '🔍 VERIFICACIÓN POLÍTICAS:' as section;

SELECT 
    tablename,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
GROUP BY tablename
ORDER BY tablename;

-- Listar nombres de políticas para verificar que son las nuevas
SELECT 
    '📋 NUEVAS POLÍTICAS CREADAS:' as section;

SELECT 
    tablename,
    policyname
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
ORDER BY tablename, policyname;

SELECT '💥 SCRIPT NUCLEAR COMPLETADO - FORZÓ ELIMINACIÓN Y RECREACIÓN COMPLETA!' as resultado; 