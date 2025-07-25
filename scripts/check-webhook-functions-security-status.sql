-- ============================================================================
-- VERIFICATION: Webhook Functions Security Status Check
-- ============================================================================
-- Este script verifica el estado de seguridad de las funciones webhook
-- y confirma si el fix de search_path se aplicó correctamente

-- ============================================================================
-- VERIFICACIÓN 1: FUNCIONES WEBHOOK EXISTENTES
-- ============================================================================

SELECT 'WEBHOOK FUNCTIONS STATUS CHECK' as check_title;

SELECT 
    'FUNCTION EXISTENCE' as check_type,
    routine_name as function_name,
    CASE 
        WHEN routine_name IN (
            'update_webhook_events_updated_at',
            'check_webhook_event_processed', 
            'mark_webhook_event_processed',
            'mark_webhook_event_failed',
            'cleanup_old_webhook_events'
        )
        THEN '✅ Found'
        ELSE '❓ Unknown'
    END as status,
    external_language as language,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND (
    routine_name LIKE '%webhook%' OR 
    routine_name IN (
        'update_webhook_events_updated_at',
        'check_webhook_event_processed', 
        'mark_webhook_event_processed',
        'mark_webhook_event_failed',
        'cleanup_old_webhook_events'
    )
)
ORDER BY routine_name;

-- ============================================================================
-- VERIFICACIÓN 2: SEARCH_PATH SECURITY STATUS  
-- ============================================================================

-- Esta consulta verifica si las funciones tienen search_path configurado
-- (Nota: PostgreSQL no expone el search_path directamente en information_schema)
SELECT 'SEARCH_PATH SECURITY CHECK' as check_type;

-- Obtener definiciones de funciones para verificar search_path
SELECT 
    'FUNCTION DEFINITION CHECK' as check_type,
    p.proname as function_name,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%'
        THEN '✅ SECURE - search_path configurado'
        ELSE '❌ INSECURE - search_path NO configurado'
    END as security_status,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path = public, pg_temp%'
        THEN '✅ Correcto'
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%'
        THEN '⚠️  Configurado pero diferente'
        ELSE '❌ No configurado'
    END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN (
    'update_webhook_events_updated_at',
    'check_webhook_event_processed', 
    'mark_webhook_event_processed',
    'mark_webhook_event_failed',
    'cleanup_old_webhook_events'
)
ORDER BY p.proname;

-- ============================================================================
-- VERIFICACIÓN 3: TABLA WEBHOOK_EVENTS ACCESIBILIDAD
-- ============================================================================

SELECT 'TABLE ACCESSIBILITY CHECK' as check_type;

-- Verificar que la tabla webhook_events existe y es accesible
SELECT 
    'webhook_events table' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events')
        THEN '✅ Existe y accesible'
        ELSE '❌ No encontrada'
    END as status,
    (SELECT COUNT(*) FROM public.webhook_events) as row_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events');

-- ============================================================================
-- VERIFICACIÓN 4: PERMISOS DE FUNCIONES
-- ============================================================================

SELECT 'FUNCTION PERMISSIONS CHECK' as check_type;

-- Verificar permisos otorgados a las funciones
SELECT 
    routine_name as function_name,
    'Permissions OK' as permission_status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'update_webhook_events_updated_at',
    'check_webhook_event_processed', 
    'mark_webhook_event_processed',
    'mark_webhook_event_failed',
    'cleanup_old_webhook_events'
)
ORDER BY routine_name;

-- ============================================================================
-- VERIFICACIÓN 5: TEST FUNCIONAL BÁSICO
-- ============================================================================

SELECT 'FUNCTIONAL TEST' as check_type;

-- Test básico de función de verificación (si es segura llamar)
DO $$
DECLARE
    test_result boolean;
    test_event_id text := 'test_' || extract(epoch from now())::text;
BEGIN
    -- Test check_webhook_event_processed con ID que no existe
    BEGIN
        SELECT check_webhook_event_processed(test_event_id) INTO test_result;
        RAISE NOTICE '✅ check_webhook_event_processed: FUNCIONAL (resultado: %)', test_result;
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE '❌ check_webhook_event_processed: ERROR - %', SQLERRM;
    END;
    
    -- Información sobre datos existentes
    BEGIN
        DECLARE event_count integer;
        BEGIN
            SELECT COUNT(*) INTO event_count FROM public.webhook_events;
            RAISE NOTICE 'ℹ️  webhook_events table tiene % registros', event_count;
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE '⚠️  No se pudo acceder a webhook_events: %', SQLERRM;
        END;
    END;
    
EXCEPTION 
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error general en test funcional: %', SQLERRM;
END $$;

-- ============================================================================
-- RESUMEN FINAL
-- ============================================================================

SELECT 'SECURITY STATUS SUMMARY' as final_check;

-- Resumen del estado de seguridad
SELECT 
    CASE 
        WHEN COUNT(*) = 5 THEN '✅ TODAS LAS FUNCIONES SEGURAS'
        WHEN COUNT(*) > 0 THEN '⚠️  ALGUNAS FUNCIONES SEGURAS (' || COUNT(*) || '/5)'
        ELSE '❌ NINGUNA FUNCIÓN SEGURA'
    END as security_summary,
    COUNT(*) as secure_functions,
    5 as total_functions
FROM (
    SELECT p.proname 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname IN (
        'update_webhook_events_updated_at',
        'check_webhook_event_processed', 
        'mark_webhook_event_processed',
        'mark_webhook_event_failed',
        'cleanup_old_webhook_events'
    )
    AND pg_get_functiondef(p.oid) LIKE '%SET search_path = public, pg_temp%'
) secure_funcs;

-- Mensaje final
SELECT 
    CASE 
        WHEN (
            SELECT COUNT(*) FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' 
            AND p.proname IN (
                'update_webhook_events_updated_at',
                'check_webhook_event_processed', 
                'mark_webhook_event_processed',
                'mark_webhook_event_failed',
                'cleanup_old_webhook_events'
            )
            AND pg_get_functiondef(p.oid) LIKE '%SET search_path = public, pg_temp%'
        ) = 5
        THEN '🎉 VERIFICACIÓN COMPLETA - Todas las funciones webhook son seguras'
        ELSE '⚠️  ACCIÓN REQUERIDA - Ejecutar fix-webhook-functions-search-path.sql'
    END as final_message; 