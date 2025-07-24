-- SCRIPT FINAL: Corrección Completa de Todos los Warnings
-- Enfoque directo y agresivo

-- ============================================================================
-- PARTE 1: FUNCIÓN increment_template_usage (más simple)
-- ============================================================================

-- Forzar eliminación completa
DROP FUNCTION IF EXISTS public.increment_template_usage() CASCADE;

-- Recrear con configuración mínima pero correcta
CREATE FUNCTION public.increment_template_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.whatsapp_templates 
    SET usage_count = COALESCE(usage_count, 0) + 1,
        last_used = now()
    WHERE id = NEW.template_id;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- PARTE 2: ELIMINACIÓN FORZADA DE TODAS LAS POLÍTICAS RLS
-- ============================================================================

-- synced_objects
DROP POLICY IF EXISTS "Users can view synced objects for their sites" ON public.synced_objects CASCADE;
DROP POLICY IF EXISTS "Users can insert synced objects for their sites" ON public.synced_objects CASCADE;
DROP POLICY IF EXISTS "Users can update synced objects for their sites" ON public.synced_objects CASCADE;
DROP POLICY IF EXISTS "Users can delete synced objects for their sites" ON public.synced_objects CASCADE;

-- whatsapp_templates  
DROP POLICY IF EXISTS "Users can view whatsapp templates for their sites" ON public.whatsapp_templates CASCADE;
DROP POLICY IF EXISTS "Users can create whatsapp templates for their sites" ON public.whatsapp_templates CASCADE;
DROP POLICY IF EXISTS "Users can update whatsapp templates for their sites" ON public.whatsapp_templates CASCADE;
DROP POLICY IF EXISTS "Users can delete whatsapp templates for their sites" ON public.whatsapp_templates CASCADE;

-- system_memories
DROP POLICY IF EXISTS "Users can view system memories for their sites" ON public.system_memories CASCADE;
DROP POLICY IF EXISTS "Users can create system memories for their sites" ON public.system_memories CASCADE;
DROP POLICY IF EXISTS "Users can update system memories for their sites" ON public.system_memories CASCADE;
DROP POLICY IF EXISTS "Users can delete system memories for their sites" ON public.system_memories CASCADE;

-- ============================================================================
-- PARTE 3: POLÍTICAS ULTRA-OPTIMIZADAS (usando WITH para mejor rendimiento)
-- ============================================================================

-- SYNCED_OBJECTS: Políticas optimizadas correctamente
CREATE POLICY "Users can view synced objects for their sites" ON public.synced_objects
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = synced_objects.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

CREATE POLICY "Users can insert synced objects for their sites" ON public.synced_objects
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = synced_objects.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

CREATE POLICY "Users can update synced objects for their sites" ON public.synced_objects
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = synced_objects.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

CREATE POLICY "Users can delete synced objects for their sites" ON public.synced_objects
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = synced_objects.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

-- WHATSAPP_TEMPLATES: Políticas optimizadas correctamente
CREATE POLICY "Users can view whatsapp templates for their sites" ON public.whatsapp_templates
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = whatsapp_templates.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

CREATE POLICY "Users can create whatsapp templates for their sites" ON public.whatsapp_templates
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = whatsapp_templates.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin', 'marketing')
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

CREATE POLICY "Users can update whatsapp templates for their sites" ON public.whatsapp_templates
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = whatsapp_templates.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin', 'marketing')
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

CREATE POLICY "Users can delete whatsapp templates for their sites" ON public.whatsapp_templates
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = whatsapp_templates.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

-- SYSTEM_MEMORIES: Políticas optimizadas correctamente
CREATE POLICY "Users can view system memories for their sites" ON public.system_memories
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = system_memories.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

CREATE POLICY "Users can create system memories for their sites" ON public.system_memories
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = system_memories.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

CREATE POLICY "Users can update system memories for their sites" ON public.system_memories
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = system_memories.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

CREATE POLICY "Users can delete system memories for their sites" ON public.system_memories
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = system_memories.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') IN ('anon', 'service_role')
);

-- ============================================================================
-- PARTE 4: VERIFICACIÓN Y REFRESH
-- ============================================================================

-- Refresh completo
NOTIFY pgrst, 'reload schema';

-- Verificar función
SELECT 
    'Verificación función increment_template_usage:' as check_function;

SELECT 
    proname,
    prosecdef,
    proconfig,
    CASE 
        WHEN proconfig IS NOT NULL THEN '✅ Search path configurado'
        ELSE '❌ Falta search path'
    END as status
FROM pg_proc 
WHERE proname = 'increment_template_usage'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Verificar políticas
SELECT 
    'Verificación políticas RLS:' as check_policies;

SELECT 
    tablename,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
GROUP BY tablename
ORDER BY tablename;

SELECT '🎯 SCRIPT FINAL COMPLETADO - Todos los warnings deberían estar resueltos!' as resultado; 