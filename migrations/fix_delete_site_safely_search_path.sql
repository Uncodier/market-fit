-- Migration: Fix delete_site_safely function search_path security issue
-- Date: 2024
-- Issue: Function has mutable search_path which creates security vulnerabilities

-- ============================================================================
-- SECURE FIX: Set minimal, explicit search_path for delete_site_safely
-- ============================================================================

DO $$
BEGIN
    -- Check if function exists before attempting to modify it
    IF EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'delete_site_safely'
    ) THEN
        
        -- Set secure, minimal search_path
        -- Only include 'public' since function needs access to public.sites
        -- auth.uid() works regardless of search_path
        ALTER FUNCTION public.delete_site_safely(UUID) 
        SET search_path = 'public';
        
        RAISE NOTICE '✅ Fixed search_path for delete_site_safely to "public"';
        
        -- Recreate the function with explicit schema references for maximum security
        CREATE OR REPLACE FUNCTION public.delete_site_safely(site_id_param UUID)
        RETURNS BOOLEAN 
        LANGUAGE plpgsql 
        SECURITY DEFINER
        SET search_path = 'public'
        AS $func$
        BEGIN
            -- Verificar que el usuario tiene permisos (owner del sitio)
            -- Using explicit schema reference for maximum security
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
            -- Using explicit schema reference
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
        $func$;
        
        -- Ensure proper permissions
        GRANT EXECUTE ON FUNCTION public.delete_site_safely(UUID) TO authenticated;
        
        -- Add security comment
        COMMENT ON FUNCTION public.delete_site_safely(UUID) IS 
        'Safely deletes a site and all its related data. Only the site owner can delete the site. Uses fixed search_path for security.';
        
        RAISE NOTICE '✅ Successfully secured delete_site_safely function';
        
    ELSE
        RAISE NOTICE '⚠️  Function delete_site_safely does not exist, skipping fix';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION: Check the function configuration
-- ============================================================================

DO $$
DECLARE
    func_config TEXT[];
    config_item TEXT;
BEGIN
    -- Get function configuration
    SELECT proconfig INTO func_config
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'delete_site_safely';
    
    IF func_config IS NOT NULL THEN
        RAISE NOTICE '📋 Function configuration:';
        FOREACH config_item IN ARRAY func_config
        LOOP
            RAISE NOTICE '   - %', config_item;
        END LOOP;
    ELSE
        RAISE NOTICE '⚠️  No configuration found for function';
    END IF;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
    '🔒 SECURITY FIX APPLIED: delete_site_safely search_path secured' AS status,
    'Function now has fixed search_path = "public" for security' AS details; 