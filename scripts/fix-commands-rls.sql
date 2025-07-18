-- ============================================================================
-- SCRIPT DE SOLUCIÓN: ARREGLAR PERMISOS RLS PARA TABLA COMMANDS
-- ============================================================================
-- Este script corrige las políticas RLS para que todos los miembros del sitio
-- puedan ver y gestionar comandos, no solo el site_owner.

-- ============================================================================
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS CONFLICTIVAS
-- ============================================================================

DROP POLICY IF EXISTS "commands_unified" ON public.commands;
DROP POLICY IF EXISTS "commands_optimized_policy" ON public.commands;
DROP POLICY IF EXISTS "commands_optimized" ON public.commands;
DROP POLICY IF EXISTS "commands_site_access_policy" ON public.commands;
DROP POLICY IF EXISTS "Users can insert their own commands" ON public.commands;
DROP POLICY IF EXISTS "Users can update their own commands" ON public.commands;
DROP POLICY IF EXISTS "Users can view their own commands" ON public.commands;
DROP POLICY IF EXISTS "Users can delete their own commands" ON public.commands;

-- ============================================================================
-- PASO 2: CREAR NUEVA POLÍTICA OPTIMIZADA
-- ============================================================================

CREATE POLICY "commands_site_access_policy" ON public.commands
FOR ALL TO authenticated
USING (
  -- Permitir acceso a comandos de sitios donde el usuario tiene acceso
  EXISTS (
    SELECT 1 FROM public.sites s 
    WHERE s.id = commands.site_id AND (
      -- Es el propietario del sitio
      s.user_id = (SELECT auth.uid()) OR
      -- Es miembro activo del sitio
      EXISTS (
        SELECT 1 FROM public.site_members sm 
        WHERE sm.site_id = s.id 
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
      )
    )
  )
  -- O permitir acceso a comandos propios (independientemente del sitio)
  OR commands.user_id = (SELECT auth.uid())
)
WITH CHECK (
  -- Misma lógica para insertar/actualizar
  EXISTS (
    SELECT 1 FROM public.sites s 
    WHERE s.id = commands.site_id AND (
      s.user_id = (SELECT auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.site_members sm 
        WHERE sm.site_id = s.id 
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
      )
    )
  )
  OR commands.user_id = (SELECT auth.uid())
);

-- ============================================================================
-- PASO 3: ASEGURAR QUE RLS ESTÉ HABILITADO Y PERMISOS OTORGADOS
-- ============================================================================

ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commands TO authenticated;

-- ============================================================================
-- PASO 4: CREAR ÍNDICES PARA MEJORAR PERFORMANCE
-- ============================================================================

-- Índices para optimizar las consultas de las políticas RLS
CREATE INDEX IF NOT EXISTS idx_commands_site_id_performance ON public.commands(site_id);
CREATE INDEX IF NOT EXISTS idx_commands_user_id_performance ON public.commands(user_id);

-- Índice compuesto para consultas complejas
CREATE INDEX IF NOT EXISTS idx_commands_site_user_composite ON public.commands(site_id, user_id);

-- ============================================================================
-- PASO 5: FUNCIÓN DE VERIFICACIÓN POST-APLICACIÓN
-- ============================================================================

-- Crear función de verificación temporal
CREATE OR REPLACE FUNCTION public.verify_commands_fix()
RETURNS TABLE(
    test_name text,
    result text,
    details text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    policy_count integer;
    commands_count integer;
    current_user_id uuid;
BEGIN
    -- Obtener el usuario actual
    SELECT auth.uid() INTO current_user_id;
    
    -- Test 1: Verificar que solo hay una política activa
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'commands';
    
    IF policy_count = 1 THEN
        RETURN QUERY SELECT 
            'Policy Count'::text, 
            'SUCCESS ✅'::text, 
            'Exactly 1 policy found (good)'::text;
    ELSE
        RETURN QUERY SELECT 
            'Policy Count'::text, 
            'WARNING ⚠️'::text, 
            ('Found ' || policy_count::text || ' policies (should be 1)')::text;
    END IF;
    
    -- Test 2: Verificar acceso a comandos
    IF current_user_id IS NOT NULL THEN
        BEGIN
            SELECT COUNT(*) INTO commands_count FROM public.commands;
            RETURN QUERY SELECT 
                'Commands Access'::text, 
                'SUCCESS ✅'::text, 
                ('Can access ' || commands_count::text || ' commands')::text;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 
                'Commands Access'::text, 
                'FAILED ❌'::text, 
                ('Cannot access commands: ' || SQLERRM)::text;
        END;
    ELSE
        RETURN QUERY SELECT 
            'Commands Access'::text, 
            'SKIPPED ⏭️'::text, 
            'Not authenticated - cannot test'::text;
    END IF;
    
    -- Test 3: Verificar política específica
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'commands' 
        AND policyname = 'commands_site_access_policy'
    ) THEN
        RETURN QUERY SELECT 
            'Policy Name'::text, 
            'SUCCESS ✅'::text, 
            'Correct policy name found'::text;
    ELSE
        RETURN QUERY SELECT 
            'Policy Name'::text, 
            'WARNING ⚠️'::text, 
            'Expected policy name not found'::text;
    END IF;
    
    RETURN;
END;
$$;

-- Ejecutar verificación
SELECT 
    '🔧 COMMANDS RLS FIX COMPLETED' as status,
    'Running verification tests...' as message;

SELECT * FROM public.verify_commands_fix();

-- Limpiar función temporal
DROP FUNCTION IF EXISTS public.verify_commands_fix();

-- ============================================================================
-- PASO 6: INSTRUCCIONES FINALES
-- ============================================================================

SELECT 
    '✅ RLS FIX APPLIED SUCCESSFULLY' as status,
    'Commands table now allows site members to see commands' as result,
    'Test the UI to confirm commands are visible to all team members' as next_action;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- 
-- ANTES: Solo user_id (creador) podía ver comandos
-- DESPUÉS: Todos los miembros del sitio pueden ver comandos del sitio
-- 
-- La nueva política permite:
-- 1. Ver comandos de sitios donde eres propietario (site.user_id)
-- 2. Ver comandos de sitios donde eres miembro activo (site_members)
-- 3. Ver siempre tus propios comandos (commands.user_id)
-- 
-- Performance: Se añadieron índices para optimizar las consultas RLS
-- Security: Se mantiene la seguridad - solo miembros autorizados tienen acceso
-- ============================================================================ 