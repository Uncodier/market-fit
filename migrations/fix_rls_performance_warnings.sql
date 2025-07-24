-- Script de Corrección Rápida para Warnings de Rendimiento RLS
-- Este script corrige específicamente los warnings de auth_rls_initplan

-- ============================================================================
-- OPTIMIZAR POLÍTICAS EXISTENTES (DROP + CREATE con optimizaciones)
-- ============================================================================

-- SYNCED_OBJECTS: Optimizar todas las políticas
DROP POLICY IF EXISTS "Users can view synced objects for their sites" ON public.synced_objects;
DROP POLICY IF EXISTS "Users can insert synced objects for their sites" ON public.synced_objects;
DROP POLICY IF EXISTS "Users can update synced objects for their sites" ON public.synced_objects;
DROP POLICY IF EXISTS "Users can delete synced objects for their sites" ON public.synced_objects;

-- Crear políticas optimizadas para synced_objects
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

-- WHATSAPP_TEMPLATES: Optimizar todas las políticas
DROP POLICY IF EXISTS "Users can view whatsapp templates for their sites" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Users can create whatsapp templates for their sites" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Users can update whatsapp templates for their sites" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Users can delete whatsapp templates for their sites" ON public.whatsapp_templates;

-- Crear políticas optimizadas para whatsapp_templates
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

-- SYSTEM_MEMORIES: Optimizar políticas si la tabla existe
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_memories') THEN
        
        -- Drop existing policies
        EXECUTE 'DROP POLICY IF EXISTS "Users can view system memories for their sites" ON public.system_memories';
        EXECUTE 'DROP POLICY IF EXISTS "Users can create system memories for their sites" ON public.system_memories';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update system memories for their sites" ON public.system_memories';
        EXECUTE 'DROP POLICY IF EXISTS "Users can delete system memories for their sites" ON public.system_memories';
        
        -- Create optimized policies
        EXECUTE 'CREATE POLICY "Users can view system memories for their sites" ON public.system_memories
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.site_members sm
                    WHERE sm.site_id = system_memories.site_id
                    AND sm.user_id = (SELECT auth.uid())
                    AND sm.status = ''active''
                )
                OR
                (SELECT auth.jwt() ->> ''role'') = ''anon''
                OR
                (SELECT auth.jwt() ->> ''role'') = ''service_role''
            )';

        EXECUTE 'CREATE POLICY "Users can create system memories for their sites" ON public.system_memories
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.site_members sm
                    WHERE sm.site_id = system_memories.site_id
                    AND sm.user_id = (SELECT auth.uid())
                    AND sm.status = ''active''
                    AND sm.role IN (''owner'', ''admin'')
                )
                OR
                (SELECT auth.jwt() ->> ''role'') = ''anon''
                OR
                (SELECT auth.jwt() ->> ''role'') = ''service_role''
            )';

        EXECUTE 'CREATE POLICY "Users can update system memories for their sites" ON public.system_memories
            FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM public.site_members sm
                    WHERE sm.site_id = system_memories.site_id
                    AND sm.user_id = (SELECT auth.uid())
                    AND sm.status = ''active''
                    AND sm.role IN (''owner'', ''admin'')
                )
                OR
                (SELECT auth.jwt() ->> ''role'') = ''anon''
                OR
                (SELECT auth.jwt() ->> ''role'') = ''service_role''
            )';

        EXECUTE 'CREATE POLICY "Users can delete system memories for their sites" ON public.system_memories
            FOR DELETE
            USING (
                EXISTS (
                    SELECT 1 FROM public.site_members sm
                    WHERE sm.site_id = system_memories.site_id
                    AND sm.user_id = (SELECT auth.uid())
                    AND sm.status = ''active''
                    AND sm.role IN (''owner'', ''admin'')
                )
                OR
                (SELECT auth.jwt() ->> ''role'') = ''anon''
                OR
                (SELECT auth.jwt() ->> ''role'') = ''service_role''
            )';

        RAISE NOTICE '✅ Optimized system_memories policies';
    ELSE
        RAISE NOTICE 'ℹ️ system_memories table does not exist - skipped';
    END IF;
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Mostrar confirmación
SELECT '🎉 Políticas RLS optimizadas correctamente para eliminar warnings de rendimiento!' as resultado; 