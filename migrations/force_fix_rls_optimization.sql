-- Script de Corrección Forzada para Optimización RLS
-- Eliminación completa y recreación optimizada de políticas

-- ============================================================================
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS EXISTENTES DE FORMA EXPLÍCITA
-- ============================================================================

-- Eliminar políticas de synced_objects
DROP POLICY IF EXISTS "Users can view synced objects for their sites" ON public.synced_objects;
DROP POLICY IF EXISTS "Users can insert synced objects for their sites" ON public.synced_objects;
DROP POLICY IF EXISTS "Users can update synced objects for their sites" ON public.synced_objects;
DROP POLICY IF EXISTS "Users can delete synced objects for their sites" ON public.synced_objects;

-- Eliminar políticas de whatsapp_templates
DROP POLICY IF EXISTS "Users can view whatsapp templates for their sites" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Users can create whatsapp templates for their sites" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Users can update whatsapp templates for their sites" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Users can delete whatsapp templates for their sites" ON public.whatsapp_templates;

-- Eliminar políticas de system_memories
DROP POLICY IF EXISTS "Users can view system memories for their sites" ON public.system_memories;
DROP POLICY IF EXISTS "Users can create system memories for their sites" ON public.system_memories;
DROP POLICY IF EXISTS "Users can update system memories for their sites" ON public.system_memories;
DROP POLICY IF EXISTS "Users can delete system memories for their sites" ON public.system_memories;

-- ============================================================================
-- PASO 2: RECREAR POLÍTICAS OPTIMIZADAS - SYNCED_OBJECTS
-- ============================================================================

CREATE POLICY "Users can view synced objects for their sites" ON public.synced_objects
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = synced_objects.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can insert synced objects for their sites" ON public.synced_objects
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = synced_objects.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can update synced objects for their sites" ON public.synced_objects
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = synced_objects.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can delete synced objects for their sites" ON public.synced_objects
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = synced_objects.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

-- ============================================================================
-- PASO 3: RECREAR POLÍTICAS OPTIMIZADAS - WHATSAPP_TEMPLATES
-- ============================================================================

CREATE POLICY "Users can view whatsapp templates for their sites" ON public.whatsapp_templates
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = whatsapp_templates.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can create whatsapp templates for their sites" ON public.whatsapp_templates
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = whatsapp_templates.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin', 'marketing')
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can update whatsapp templates for their sites" ON public.whatsapp_templates
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = whatsapp_templates.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin', 'marketing')
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can delete whatsapp templates for their sites" ON public.whatsapp_templates
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = whatsapp_templates.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

-- ============================================================================
-- PASO 4: RECREAR POLÍTICAS OPTIMIZADAS - SYSTEM_MEMORIES
-- ============================================================================

CREATE POLICY "Users can view system memories for their sites" ON public.system_memories
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = system_memories.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can create system memories for their sites" ON public.system_memories
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = system_memories.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can update system memories for their sites" ON public.system_memories
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = system_memories.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can delete system memories for their sites" ON public.system_memories
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = system_memories.site_id
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
    OR
    (SELECT auth.jwt() ->> 'role') = 'anon'
    OR
    (SELECT auth.jwt() ->> 'role') = 'service_role'
);

-- ============================================================================
-- PASO 5: REFRESCAR ESQUEMA Y VERIFICAR
-- ============================================================================

-- Refrescar cache de esquema
NOTIFY pgrst, 'reload schema';

-- Confirmar políticas recreadas
SELECT 
    '🎉 Políticas RLS recreadas y optimizadas!' as resultado,
    COUNT(*) as total_policies_created
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories');

SELECT 
    '✅ Verificación final - debería mostrar 12 políticas:' as verification;

SELECT 
    tablename,
    COUNT(*) as policies_count
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
GROUP BY tablename
ORDER BY tablename; 