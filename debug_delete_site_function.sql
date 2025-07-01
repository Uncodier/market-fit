-- DIAGNÓSTICO: Función delete_site_safely y tabla sites
-- Ejecuta esto en Supabase SQL Editor para diagnosticar el problema

-- ============================================================================
-- 1. VERIFICAR SI LA TABLA SITES EXISTE
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '🔍 VERIFICANDO TABLA SITES...';
    
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sites'
    ) THEN
        RAISE NOTICE '✅ Tabla public.sites EXISTE';
        
        -- Mostrar columnas de la tabla
        RAISE NOTICE '📋 Columnas de la tabla sites:';
        FOR rec IN 
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'sites'
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '   - %: %', rec.column_name, rec.data_type;
        END LOOP;
        
    ELSE
        RAISE NOTICE '❌ Tabla public.sites NO EXISTE';
        
        -- Buscar tablas similares
        RAISE NOTICE '🔍 Buscando tablas similares...';
        FOR rec IN 
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name ILIKE '%site%'
        LOOP
            RAISE NOTICE '   - Encontrada: %', rec.table_name;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 2. VERIFICAR SI LA FUNCIÓN delete_site_safely EXISTE
-- ============================================================================

DO $$
DECLARE
    func_exists BOOLEAN;
    func_definition TEXT;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICANDO FUNCIÓN delete_site_safely...';
    
    -- Verificar si existe
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'delete_site_safely'
    ) INTO func_exists;
    
    IF func_exists THEN
        RAISE NOTICE '✅ Función public.delete_site_safely EXISTE';
        
        -- Obtener información de la función
        FOR rec IN
            SELECT 
                p.proname as function_name,
                pg_get_function_arguments(p.oid) as arguments,
                pg_get_function_result(p.oid) as return_type,
                p.prosecdef as security_definer,
                COALESCE(p.proconfig, '{}') as config
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname = 'delete_site_safely'
        LOOP
            RAISE NOTICE '📋 Detalles de la función:';
            RAISE NOTICE '   - Argumentos: %', rec.arguments;
            RAISE NOTICE '   - Retorna: %', rec.return_type;
            RAISE NOTICE '   - Security Definer: %', rec.security_definer;
            RAISE NOTICE '   - Configuración: %', rec.config;
        END LOOP;
        
    ELSE
        RAISE NOTICE '❌ Función public.delete_site_safely NO EXISTE';
        
        -- Buscar funciones similares
        RAISE NOTICE '🔍 Buscando funciones similares...';
        FOR rec IN 
            SELECT p.proname
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname ILIKE '%delete%site%'
        LOOP
            RAISE NOTICE '   - Encontrada: %', rec.proname;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 3. VERIFICAR PERMISOS DE LA FUNCIÓN
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICANDO PERMISOS...';
    
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'delete_site_safely'
    ) THEN
        -- Verificar permisos
        FOR rec IN
            SELECT 
                grantee,
                privilege_type
            FROM information_schema.routine_privileges
            WHERE routine_schema = 'public'
            AND routine_name = 'delete_site_safely'
        LOOP
            RAISE NOTICE '✅ Permiso: % tiene %', rec.grantee, rec.privilege_type;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 4. PROBAR ACCESO DIRECTO A LA TABLA SITES
-- ============================================================================

DO $$
DECLARE
    site_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 PROBANDO ACCESO A TABLA SITES...';
    
    BEGIN
        SELECT COUNT(*) INTO site_count FROM public.sites;
        RAISE NOTICE '✅ Acceso exitoso. Sitios encontrados: %', site_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '❌ Error: Tabla sites no existe (undefined_table)';
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error accediendo a sites: % - %', SQLSTATE, SQLERRM;
    END;
END $$;

-- ============================================================================
-- 5. MOSTRAR SEARCH_PATH ACTUAL
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 SEARCH_PATH ACTUAL: %', current_setting('search_path');
END $$; 