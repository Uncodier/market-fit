-- OPTIMIZACIÓN FINAL RLS: Enfoque ultra-específico para Supabase Linter
-- Usando WITH clauses y subqueries explícitas

-- ============================================================================
-- POLÍTICAS RLS ULTRA-OPTIMIZADAS CON WITH CLAUSES
-- ============================================================================

-- 1. SYNCED_OBJECTS - Ultra-optimizada con WITH
DROP POLICY IF EXISTS admin_all_access_synced_objects ON public.synced_objects;
CREATE POLICY admin_all_access_synced_objects ON public.synced_objects
    FOR ALL 
    TO public
    USING (
        EXISTS (
            WITH auth_context AS (
                SELECT 
                    (SELECT auth.uid()) as current_user_id,
                    (SELECT auth.jwt() ->> 'role') as current_role
            )
            SELECT 1 
            FROM auth_context 
            WHERE auth_context.current_role = ANY(ARRAY['anon', 'service_role'])
               OR synced_objects.site_id IN (
                   SELECT sm.site_id 
                   FROM public.site_members sm 
                   WHERE sm.user_id = auth_context.current_user_id 
                     AND sm.status = 'active'
               )
        )
    );

-- 2. WHATSAPP_TEMPLATES - Ultra-optimizada con WITH
DROP POLICY IF EXISTS admin_all_access_whatsapp_templates ON public.whatsapp_templates;
CREATE POLICY admin_all_access_whatsapp_templates ON public.whatsapp_templates
    FOR ALL 
    TO public
    USING (
        EXISTS (
            WITH auth_context AS (
                SELECT 
                    (SELECT auth.uid()) as current_user_id,
                    (SELECT auth.jwt() ->> 'role') as current_role
            )
            SELECT 1 
            FROM auth_context 
            WHERE auth_context.current_role = ANY(ARRAY['anon', 'service_role'])
               OR whatsapp_templates.site_id IN (
                   SELECT sm.site_id 
                   FROM public.site_members sm 
                   WHERE sm.user_id = auth_context.current_user_id 
                     AND sm.status = 'active'
               )
        )
    );

-- 3. SYSTEM_MEMORIES - Ultra-optimizada con WITH
DROP POLICY IF EXISTS admin_all_access_system_memories ON public.system_memories;
CREATE POLICY admin_all_access_system_memories ON public.system_memories
    FOR ALL 
    TO public
    USING (
        EXISTS (
            WITH auth_context AS (
                SELECT 
                    (SELECT auth.uid()) as current_user_id,
                    (SELECT auth.jwt() ->> 'role') as current_role
            )
            SELECT 1 
            FROM auth_context 
            WHERE auth_context.current_role = ANY(ARRAY['anon', 'service_role'])
               OR system_memories.site_id IN (
                   SELECT sm.site_id 
                   FROM public.site_members sm 
                   WHERE sm.user_id = auth_context.current_user_id 
                     AND sm.status = 'active'
               )
        )
    );

-- ============================================================================
-- ALTERNATIVA: POLÍTICAS MÁS SIMPLES (Si las WITH no funcionan)
-- ============================================================================

-- Eliminar políticas anteriores y crear súper-simples
DO $$
BEGIN
    -- Solo si las políticas WITH causan problemas, usar estas:
    /*
    DROP POLICY IF EXISTS admin_all_access_synced_objects ON public.synced_objects;
    DROP POLICY IF EXISTS admin_all_access_whatsapp_templates ON public.whatsapp_templates;
    DROP POLICY IF EXISTS admin_all_access_system_memories ON public.system_memories;
    
    -- Políticas ultra-simples que bypass auth checks
    CREATE POLICY simple_access_synced_objects ON public.synced_objects FOR ALL TO public USING (true);
    CREATE POLICY simple_access_whatsapp_templates ON public.whatsapp_templates FOR ALL TO public USING (true);
    CREATE POLICY simple_access_system_memories ON public.system_memories FOR ALL TO public USING (true);
    */
    
    RAISE NOTICE 'Políticas RLS ultra-optimizadas creadas con WITH clauses';
END $$;

-- ============================================================================
-- VERIFICACIÓN Y ANÁLISIS
-- ============================================================================

-- Verificar políticas actuales
SELECT 
    '📋 POLÍTICAS RLS ACTIVAS:' as section,
    schemaname,
    tablename,
    policyname,
    cmd as command_type,
    CASE 
        WHEN length(qual) > 100 
        THEN left(qual, 100) || '...'
        ELSE qual 
    END as policy_condition
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
ORDER BY tablename, policyname;

-- Verificar que las tablas tienen RLS habilitado
SELECT 
    '🔒 ESTADO RLS:' as section,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('synced_objects', 'whatsapp_templates', 'system_memories')
ORDER BY tablename;

-- Verificar funciones con search_path
SELECT 
    '⚙️ FUNCIONES OPTIMIZADAS:' as section,
    proname as function_name,
    prosecdef as security_definer,
    proconfig as configuration
FROM pg_proc 
WHERE proname IN ('increment_template_usage', 'update_whatsapp_templates_updated_at', 'update_synced_objects_updated_at')
ORDER BY proname;

SELECT '🎯 OPTIMIZACIÓN RLS FINAL COMPLETADA!' as resultado; 