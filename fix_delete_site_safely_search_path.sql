-- FIX: delete_site_safely search_path problem
-- El problema es que la función tiene search_path = '' y no puede encontrar la tabla sites

-- ============================================================================
-- OPCIÓN 1: Arreglar el search_path de la función
-- ============================================================================

-- Establecer search_path correcto para que pueda encontrar public.sites
ALTER FUNCTION public.delete_site_safely(UUID) SET search_path = 'public';

-- ============================================================================
-- OPCIÓN 2: Recrear la función con referencias explícitas al esquema
-- ============================================================================

-- Crear versión mejorada de la función con referencias explícitas
CREATE OR REPLACE FUNCTION public.delete_site_safely(site_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verificar que el usuario tiene permisos (owner del sitio)
    IF NOT EXISTS (
        SELECT 1 FROM public.sites s
        WHERE s.id = site_id_param 
        AND s.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only site owner can delete the site';
    END IF;
    
    -- Establecer variable de contexto para indicar que estamos eliminando un sitio
    PERFORM set_config('app.deleting_site', site_id_param::text, true);
    
    -- Eliminar el sitio (CASCADE eliminará todo lo demás)
    DELETE FROM public.sites WHERE id = site_id_param;
    
    -- Limpiar la variable de contexto
    PERFORM set_config('app.deleting_site', '', true);
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        -- Limpiar la variable en caso de error
        PERFORM set_config('app.deleting_site', '', true);
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICAR QUE FUNCIONA
-- ============================================================================

-- Verificar que la función tiene el search_path correcto
DO $$
DECLARE
    func_config TEXT[];
BEGIN
    SELECT proconfig INTO func_config
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'delete_site_safely';
    
    RAISE NOTICE 'Configuración de la función: %', func_config;
    
    -- También verificar que podemos ver la tabla desde la función
    RAISE NOTICE 'Probando acceso a public.sites desde contexto similar...';
    
    IF EXISTS (SELECT 1 FROM public.sites LIMIT 1) THEN
        RAISE NOTICE '✅ Acceso a public.sites: OK';
    ELSE
        RAISE NOTICE '⚠️  Tabla public.sites vacía, pero accesible';
    END IF;
END $$;

-- ============================================================================
-- CONCEDER PERMISOS NUEVAMENTE (por si acaso)
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.delete_site_safely(UUID) TO authenticated;

-- ============================================================================
-- MENSAJE DE ÉXITO
-- ============================================================================

SELECT 'FIX APLICADO: delete_site_safely search_path arreglado' AS status; 