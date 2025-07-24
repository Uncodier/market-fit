-- OPTIMIZACIÓN RÁPIDA: Corregir rendimiento de políticas RLS
-- Envuelve auth.uid() y auth.jwt() en SELECT para evaluación única

-- ============================================================================
-- REEMPLAZAR POLÍTICAS CON OPTIMIZACIÓN DE RENDIMIENTO
-- ============================================================================

-- 1. SYNCED_OBJECTS - Optimizada
DROP POLICY IF EXISTS admin_all_access_synced_objects ON public.synced_objects;
CREATE POLICY admin_all_access_synced_objects ON public.synced_objects
    FOR ALL USING (
        (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
        OR
        site_id IN (
            SELECT site_id FROM public.site_members 
            WHERE user_id = (SELECT auth.uid()) 
            AND status = 'active'
        )
    );

-- 2. WHATSAPP_TEMPLATES - Optimizada  
DROP POLICY IF EXISTS admin_all_access_whatsapp_templates ON public.whatsapp_templates;
CREATE POLICY admin_all_access_whatsapp_templates ON public.whatsapp_templates
    FOR ALL USING (
        (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
        OR
        site_id IN (
            SELECT site_id FROM public.site_members 
            WHERE user_id = (SELECT auth.uid()) 
            AND status = 'active'
        )
    );

-- 3. SYSTEM_MEMORIES - Optimizada
DROP POLICY IF EXISTS admin_all_access_system_memories ON public.system_memories;
CREATE POLICY admin_all_access_system_memories ON public.system_memories
    FOR ALL USING (
        (SELECT auth.jwt() ->> 'role') = ANY(ARRAY['anon', 'service_role'])
        OR
        site_id IN (
            SELECT site_id FROM public.site_members 
            WHERE user_id = (SELECT auth.uid()) 
            AND status = 'active'
        )
    );

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar políticas optimizadas
SELECT 
    '✅ POLÍTICAS OPTIMIZADAS:' as section,
    tablename,
    policyname,
    'Optimizada para rendimiento' as status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
ORDER BY tablename;

SELECT '🚀 OPTIMIZACIÓN RLS COMPLETADA - YA NO DEBE HABER WARNINGS!' as resultado; 