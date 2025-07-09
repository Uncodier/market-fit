-- ============================================================================
-- DIAGNÓSTICO: ENCONTRAR increment_visitor_sessions PROBLEMÁTICA
-- ============================================================================
-- Este script encuentra y analiza la función increment_visitor_sessions
-- que está causando la advertencia de seguridad.
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 DIAGNÓSTICO: increment_visitor_sessions';
    RAISE NOTICE '=======================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASO 1: BUSCAR TODAS LAS FUNCIONES CON ESE NOMBRE
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    func_count INTEGER := 0;
BEGIN
    RAISE NOTICE '📋 TODAS LAS FUNCIONES increment_visitor_sessions:';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '';
    
    FOR func_record IN
        SELECT 
            p.oid,
            p.proname,
            n.nspname as schema_name,
            pg_get_function_identity_arguments(p.oid) as args,
            pg_get_function_result(p.oid) as return_type,
            CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security_type,
            p.prosecdef,
            p.provolatile,
            CASE 
                WHEN p.proconfig IS NULL THEN 'NO search_path set ⚠️'
                ELSE 'search_path: ' || array_to_string(p.proconfig, ', ')
            END as search_path_status
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'increment_visitor_sessions'
        ORDER BY n.nspname, p.oid
    LOOP
        func_count := func_count + 1;
        
        RAISE NOTICE '🔍 FUNCIÓN #%:', func_count;
        RAISE NOTICE '   📍 Schema: %', func_record.schema_name;
        RAISE NOTICE '   🔧 Nombre: %', func_record.proname;
        RAISE NOTICE '   📝 Argumentos: %', COALESCE(func_record.args, 'ninguno');
        RAISE NOTICE '   🔄 Retorna: %', func_record.return_type;
        RAISE NOTICE '   🔒 Seguridad: %', func_record.security_type;
        RAISE NOTICE '   🛡️  search_path: %', func_record.search_path_status;
        RAISE NOTICE '   ⚡ OID: %', func_record.oid;
        
        -- Determinar si esta función causa la advertencia
        IF NOT func_record.prosecdef OR func_record.search_path_status LIKE 'NO search_path set%' THEN
            RAISE NOTICE '   🚨 ESTA FUNCIÓN CAUSA LA ADVERTENCIA DE SEGURIDAD!';
        ELSE
            RAISE NOTICE '   ✅ Esta función es segura';
        END IF;
        
        RAISE NOTICE '';
    END LOOP;
    
    IF func_count = 0 THEN
        RAISE NOTICE '❌ NO SE ENCONTRARON FUNCIONES increment_visitor_sessions';
        RAISE NOTICE '';
        RAISE NOTICE '💡 Posibles causas:';
        RAISE NOTICE '   • La función fue eliminada';
        RAISE NOTICE '   • Está en otro schema';
        RAISE NOTICE '   • Tiene un nombre ligeramente diferente';
    ELSE
        RAISE NOTICE '📊 TOTAL FUNCIONES ENCONTRADAS: %', func_count;
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASO 2: MOSTRAR DEFINICIONES COMPLETAS
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    func_definition TEXT;
    func_count INTEGER := 0;
BEGIN
    RAISE NOTICE '📜 DEFINICIONES COMPLETAS DE LAS FUNCIONES:';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '';
    
    FOR func_record IN
        SELECT 
            p.oid,
            p.proname,
            n.nspname as schema_name,
            pg_get_function_identity_arguments(p.oid) as args,
            pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'increment_visitor_sessions'
        ORDER BY n.nspname, p.oid
    LOOP
        func_count := func_count + 1;
        
        RAISE NOTICE '📋 DEFINICIÓN FUNCIÓN #%:', func_count;
        RAISE NOTICE '========================';
        RAISE NOTICE 'Schema: % | Argumentos: %', func_record.schema_name, COALESCE(func_record.args, 'ninguno');
        RAISE NOTICE '';
        RAISE NOTICE '%', func_record.definition;
        RAISE NOTICE '';
        RAISE NOTICE '--- FIN DEFINICIÓN FUNCIÓN #% ---', func_count;
        RAISE NOTICE '';
    END LOOP;
END $$;

-- ============================================================================
-- PASO 3: BUSCAR EN OTROS SCHEMAS
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    other_schemas_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 BUSCAR EN OTROS SCHEMAS:';
    RAISE NOTICE '==========================';
    RAISE NOTICE '';
    
    FOR func_record IN
        SELECT 
            n.nspname as schema_name,
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'increment_visitor_sessions'
        AND n.nspname != 'public'
        ORDER BY n.nspname
    LOOP
        other_schemas_count := other_schemas_count + 1;
        RAISE NOTICE '   📍 Encontrada en schema: % | Función: %(%)', 
                     func_record.schema_name, 
                     func_record.proname, 
                     COALESCE(func_record.args, 'ninguno');
    END LOOP;
    
    IF other_schemas_count = 0 THEN
        RAISE NOTICE '   ✅ No se encontraron funciones en otros schemas';
    ELSE
        RAISE NOTICE '   📊 Total en otros schemas: %', other_schemas_count;
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASO 4: BUSCAR FUNCIONES SIMILARES
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    similar_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 BUSCAR FUNCIONES SIMILARES:';
    RAISE NOTICE '==============================';
    RAISE NOTICE '';
    
    FOR func_record IN
        SELECT 
            n.nspname as schema_name,
            p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname LIKE '%visitor%session%' 
        OR p.proname LIKE '%increment%visitor%'
        OR p.proname LIKE '%session%increment%'
        ORDER BY n.nspname, p.proname
    LOOP
        similar_count := similar_count + 1;
        RAISE NOTICE '   📋 %: %', func_record.schema_name, func_record.proname;
    END LOOP;
    
    IF similar_count = 0 THEN
        RAISE NOTICE '   ✅ No se encontraron funciones similares';
    ELSE
        RAISE NOTICE '   📊 Total funciones similares: %', similar_count;
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASO 5: VERIFICAR CONFIGURACIÓN DE SEGURIDAD
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    insecure_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔒 ANÁLISIS DE SEGURIDAD:';
    RAISE NOTICE '========================';
    RAISE NOTICE '';
    
    FOR func_record IN
        SELECT 
            n.nspname as schema_name,
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args,
            p.prosecdef,
            p.proconfig,
            CASE 
                WHEN p.proconfig IS NULL THEN false
                WHEN array_to_string(p.proconfig, ' ') LIKE '%search_path%' THEN true
                ELSE false
            END as has_search_path
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'increment_visitor_sessions'
        ORDER BY n.nspname, p.oid
    LOOP
        RAISE NOTICE '🔍 Función: %.%(%)', 
                     func_record.schema_name,
                     func_record.proname, 
                     COALESCE(func_record.args, 'ninguno');
        
        RAISE NOTICE '   SECURITY DEFINER: %', 
                     CASE WHEN func_record.prosecdef THEN '✅ SÍ' ELSE '❌ NO' END;
        
        RAISE NOTICE '   search_path configurado: %', 
                     CASE WHEN func_record.has_search_path THEN '✅ SÍ' ELSE '❌ NO' END;
        
        IF func_record.proconfig IS NOT NULL THEN
            RAISE NOTICE '   Configuración: %', array_to_string(func_record.proconfig, ', ');
        END IF;
        
        -- Determinar si es insegura
        IF NOT func_record.prosecdef OR NOT func_record.has_search_path THEN
            insecure_count := insecure_count + 1;
            RAISE NOTICE '   🚨 ESTA FUNCIÓN ES INSEGURA - CAUSA LA ADVERTENCIA';
        ELSE
            RAISE NOTICE '   ✅ Esta función es segura';
        END IF;
        
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '📊 RESUMEN DE SEGURIDAD:';
    RAISE NOTICE '   Funciones inseguras: %', insecure_count;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASO 6: GENERAR COMANDO DE ELIMINACIÓN
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    drop_commands TEXT := '';
    cmd_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🗑️  COMANDOS PARA ELIMINAR FUNCIONES PROBLEMÁTICAS:';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    
    FOR func_record IN
        SELECT 
            n.nspname as schema_name,
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args,
            p.prosecdef,
            CASE 
                WHEN p.proconfig IS NULL THEN false
                WHEN array_to_string(p.proconfig, ' ') LIKE '%search_path%' THEN true
                ELSE false
            END as has_search_path
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'increment_visitor_sessions'
        ORDER BY n.nspname, p.oid
    LOOP
        -- Solo generar comando para funciones inseguras
        IF NOT func_record.prosecdef OR NOT func_record.has_search_path THEN
            cmd_count := cmd_count + 1;
            
            RAISE NOTICE '🗑️  Comando #%:', cmd_count;
            RAISE NOTICE 'DROP FUNCTION IF EXISTS %.%(%);', 
                         func_record.schema_name,
                         func_record.proname,
                         COALESCE(func_record.args, '');
            RAISE NOTICE '';
        END IF;
    END LOOP;
    
    IF cmd_count = 0 THEN
        RAISE NOTICE '✅ No hay funciones inseguras para eliminar';
    ELSE
        RAISE NOTICE '💡 Ejecuta los comandos de arriba para eliminar las funciones problemáticas';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- RESUMEN FINAL
-- ============================================================================

DO $$
DECLARE
    total_functions INTEGER;
    insecure_functions INTEGER;
BEGIN
    -- Contar funciones totales
    SELECT COUNT(*) INTO total_functions
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'increment_visitor_sessions';
    
    -- Contar funciones inseguras
    SELECT COUNT(*) INTO insecure_functions
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'increment_visitor_sessions'
    AND (NOT p.prosecdef OR p.proconfig IS NULL OR array_to_string(p.proconfig, ' ') NOT LIKE '%search_path%');
    
    RAISE NOTICE '📋 RESUMEN FINAL DEL DIAGNÓSTICO:';
    RAISE NOTICE '===============================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Estadísticas:';
    RAISE NOTICE '   • Total funciones encontradas: %', total_functions;
    RAISE NOTICE '   • Funciones inseguras: %', insecure_functions;
    RAISE NOTICE '   • Funciones seguras: %', total_functions - insecure_functions;
    RAISE NOTICE '';
    
    IF insecure_functions > 0 THEN
        RAISE NOTICE '🚨 PROBLEMA ENCONTRADO:';
        RAISE NOTICE '   • Hay % función(es) increment_visitor_sessions insegura(s)', insecure_functions;
        RAISE NOTICE '   • Esta(s) función(es) causa(n) la advertencia function_search_path_mutable';
        RAISE NOTICE '';
        RAISE NOTICE '🔧 SOLUCIÓN:';
        RAISE NOTICE '   1. Usa los comandos DROP mostrados arriba';
        RAISE NOTICE '   2. Ejecuta migrations/fix_increment_visitor_sessions_final.sql';
        RAISE NOTICE '   3. Espera 1-2 minutos para que se actualice el linter';
    ELSE
        RAISE NOTICE '✅ NO HAY PROBLEMAS:';
        RAISE NOTICE '   • Todas las funciones increment_visitor_sessions son seguras';
        RAISE NOTICE '   • La advertencia debería desaparecer en 1-2 minutos';
    END IF;
    
    RAISE NOTICE '';
END $$; 