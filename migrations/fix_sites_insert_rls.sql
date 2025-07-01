-- FIX: Sites INSERT RLS Policy
-- Error: new row violates row-level security policy for table "sites"

-- ============================================================================
-- DIAGNÓSTICO: Ver políticas actuales de la tabla sites
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
    policy_count INTEGER;
BEGIN
    RAISE NOTICE '🔍 DIAGNÓSTICO: Políticas actuales de la tabla sites';
    RAISE NOTICE '================================================================';
    
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sites';
    
    RAISE NOTICE 'Total de políticas encontradas: %', policy_count;
    RAISE NOTICE '';
    
    -- Mostrar todas las políticas
    FOR rec IN
        SELECT 
            policyname,
            cmd as operation,
            qual as using_expression,
            with_check as check_expression
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sites'
        ORDER BY cmd, policyname
    LOOP
        RAISE NOTICE 'Política: % (%)', rec.policyname, rec.operation;
        RAISE NOTICE '  USING: %', COALESCE(rec.using_expression, 'null');
        RAISE NOTICE '  CHECK: %', COALESCE(rec.check_expression, 'null');
        RAISE NOTICE '';
    END LOOP;
    
    -- Verificar si hay políticas de INSERT específicamente
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sites'
    AND cmd = 'INSERT';
    
    IF policy_count = 0 THEN
        RAISE NOTICE '❌ NO hay políticas de INSERT para sites';
    ELSE
        RAISE NOTICE '✅ Encontradas % políticas de INSERT', policy_count;
    END IF;
    
END $$;

-- ============================================================================
-- FIX: Limpiar y recrear políticas de sites
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 APLICANDO FIX: Limpiando políticas conflictivas de sites';
    RAISE NOTICE '================================================================';
    
    -- Deshabilitar RLS temporalmente
    RAISE NOTICE 'Deshabilitando RLS temporalmente...';
    ALTER TABLE public.sites DISABLE ROW LEVEL SECURITY;
    
    -- Eliminar TODAS las políticas existentes
    RAISE NOTICE 'Eliminando políticas existentes...';
    DROP POLICY IF EXISTS "Authenticated users can create sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can view their own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can update their own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can delete their own sites" ON public.sites;
    DROP POLICY IF EXISTS "Users can view sites they are members of" ON public.sites;
    DROP POLICY IF EXISTS "Site owners can manage their sites" ON public.sites;
    DROP POLICY IF EXISTS "Site members can view sites they belong to" ON public.sites;
    DROP POLICY IF EXISTS "users_can_create_sites" ON public.sites;
    DROP POLICY IF EXISTS "users_can_manage_owned_sites" ON public.sites;
    DROP POLICY IF EXISTS "users_can_view_member_sites" ON public.sites;
    DROP POLICY IF EXISTS "sites_optimized_policy" ON public.sites;
    DROP POLICY IF EXISTS "sites_unified" ON public.sites;
    DROP POLICY IF EXISTS "sites_clean_policy" ON public.sites;
    DROP POLICY IF EXISTS "sites_include_members_policy" ON public.sites;
    DROP POLICY IF EXISTS "sites_final_policy" ON public.sites;
    
    -- Re-habilitar RLS
    RAISE NOTICE 'Re-habilitando RLS...';
    ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE '✅ Políticas eliminadas y RLS re-habilitado';
END $$;

-- ============================================================================
-- CREAR POLÍTICAS SIMPLES Y FUNCIONALES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🚀 CREANDO POLÍTICAS SIMPLES Y FUNCIONALES';
    RAISE NOTICE '================================================================';
    
    -- 1. Política para INSERT (crear sitios)
    RAISE NOTICE 'Creando política de INSERT...';
    CREATE POLICY "sites_insert_policy" ON public.sites
        FOR INSERT 
        TO authenticated
        WITH CHECK (user_id = (SELECT auth.uid()));
    
    -- 2. Política para SELECT (ver sitios)
    RAISE NOTICE 'Creando política de SELECT...';
    CREATE POLICY "sites_select_policy" ON public.sites
        FOR SELECT 
        TO authenticated
        USING (
            -- Sitios propios
            user_id = (SELECT auth.uid()) 
            OR 
            -- Sitios donde soy miembro
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = sites.id 
                AND sm.user_id = (SELECT auth.uid())
                AND sm.status = 'active'
            )
        );
    
    -- 3. Política para UPDATE (actualizar sitios)
    RAISE NOTICE 'Creando política de UPDATE...';
    CREATE POLICY "sites_update_policy" ON public.sites
        FOR UPDATE 
        TO authenticated
        USING (user_id = (SELECT auth.uid()))
        WITH CHECK (user_id = (SELECT auth.uid()));
    
    -- 4. Política para DELETE (eliminar sitios) - solo dueños
    RAISE NOTICE 'Creando política de DELETE...';
    CREATE POLICY "sites_delete_policy" ON public.sites
        FOR DELETE 
        TO authenticated
        USING (user_id = (SELECT auth.uid()));
    
    RAISE NOTICE '✅ Todas las políticas creadas exitosamente';
END $$;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
    insert_policies INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ VERIFICACIÓN FINAL';
    RAISE NOTICE '================================================================';
    
    -- Contar políticas de INSERT
    SELECT COUNT(*) INTO insert_policies
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sites'
    AND cmd = 'INSERT';
    
    RAISE NOTICE 'Políticas de INSERT para sites: %', insert_policies;
    
    -- Mostrar resumen de políticas
    FOR rec IN
        SELECT cmd, COUNT(*) as count
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sites'
        GROUP BY cmd
        ORDER BY cmd
    LOOP
        RAISE NOTICE 'Operación %: % políticas', rec.cmd, rec.count;
    END LOOP;
    
    IF insert_policies > 0 THEN
        RAISE NOTICE '🎉 SUCCESS: Las políticas de INSERT están configuradas correctamente';
        RAISE NOTICE '    Los usuarios autenticados ahora pueden crear sitios';
    ELSE
        RAISE NOTICE '❌ ERROR: No se encontraron políticas de INSERT';
    END IF;
END $$;

-- ============================================================================
-- MENSAJE FINAL
-- ============================================================================

SELECT 'FIX APLICADO: Sites INSERT RLS policies arregladas' AS status; 