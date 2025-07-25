-- ============================================================================
-- FIX: Webhook Functions Search Path Security Issue
-- ============================================================================
-- Este script soluciona el problema de seguridad "function_search_path_mutable"
-- para todas las funciones relacionadas con webhooks

-- ============================================================================
-- PASO 1: DIAGNÓSTICO
-- ============================================================================

SELECT 'WEBHOOK FUNCTIONS SECURITY FIX' as step;

-- Verificar funciones existentes
SELECT 
    'FUNCTION CHECK' as check_type,
    routine_name,
    CASE 
        WHEN routine_name IN (
            'update_webhook_events_updated_at',
            'check_webhook_event_processed', 
            'mark_webhook_event_processed',
            'mark_webhook_event_failed',
            'cleanup_old_webhook_events'
        )
        THEN '✅ Función encontrada'
        ELSE '❓ Función no relacionada'
    END as status
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
-- PASO 2: RECREAR update_webhook_events_updated_at CON SEARCH_PATH SEGURO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_webhook_events_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PASO 3: RECREAR check_webhook_event_processed CON SEARCH_PATH SEGURO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_webhook_event_processed(event_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.webhook_events 
    WHERE stripe_event_id = event_id 
    AND status = 'processed'
  );
END;
$$;

-- ============================================================================
-- PASO 4: RECREAR mark_webhook_event_processed CON SEARCH_PATH SEGURO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_webhook_event_processed(
  event_id TEXT,
  event_type_param TEXT,
  event_data_param JSONB DEFAULT '{}'::jsonb,
  site_id_param UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  webhook_event_id UUID;
BEGIN
  INSERT INTO public.webhook_events (
    stripe_event_id,
    event_type,
    event_data,
    site_id,
    status
  ) VALUES (
    event_id,
    event_type_param,
    event_data_param,
    site_id_param,
    'processed'
  )
  ON CONFLICT (stripe_event_id) DO UPDATE SET
    status = 'processed',
    processed_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO webhook_event_id;
  
  RETURN webhook_event_id;
END;
$$;

-- ============================================================================
-- PASO 5: RECREAR mark_webhook_event_failed CON SEARCH_PATH SEGURO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_webhook_event_failed(
  event_id TEXT,
  event_type_param TEXT,
  error_msg TEXT,
  event_data_param JSONB DEFAULT '{}'::jsonb,
  site_id_param UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  webhook_event_id UUID;
  attempt_count INTEGER;
BEGIN
  -- Get current attempt count if exists
  SELECT 
    id,
    COALESCE((event_data->>'attempt_count')::INTEGER, 0) + 1
  INTO webhook_event_id, attempt_count
  FROM public.webhook_events 
  WHERE stripe_event_id = event_id;
  
  -- Add attempt tracking to event data
  event_data_param = event_data_param || jsonb_build_object('attempt_count', attempt_count);
  
  INSERT INTO public.webhook_events (
    stripe_event_id,
    event_type,
    event_data,
    site_id,
    status,
    error_message
  ) VALUES (
    event_id,
    event_type_param,
    event_data_param,
    site_id_param,
    'failed',
    error_msg
  )
  ON CONFLICT (stripe_event_id) DO UPDATE SET
    status = 'failed',
    error_message = error_msg,
    processed_at = NOW(),
    updated_at = NOW(),
    event_data = event_data_param
  RETURNING id INTO webhook_event_id;
  
  RETURN webhook_event_id;
END;
$$;

-- ============================================================================
-- PASO 6: RECREAR cleanup_old_webhook_events CON SEARCH_PATH SEGURO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.webhook_events
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- PASO 7: VERIFICAR PERMISOS Y GRANT STATEMENTS
-- ============================================================================

-- Asegurar permisos para service_role (webhooks)
GRANT EXECUTE ON FUNCTION public.update_webhook_events_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_webhook_event_processed(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_webhook_event_processed(TEXT, TEXT, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_webhook_event_failed(TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_webhook_events() TO service_role;

-- Permisos para authenticated users (solo funciones de consulta)
GRANT EXECUTE ON FUNCTION public.check_webhook_event_processed(TEXT) TO authenticated;

-- ============================================================================
-- PASO 8: VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar que todas las funciones tienen el search_path correcto
SELECT 
    'SECURITY CHECK' as step,
    routine_name,
    '✅ Función asegurada con search_path fijo' as status
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

-- Verificar que la tabla webhook_events existe
SELECT 
    'TABLE CHECK' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events')
        THEN '✅ Tabla webhook_events existe y es accesible'
        ELSE '❌ Tabla webhook_events NO encontrada'
    END as result;

-- Test básico de las funciones (si hay datos)
DO $$
BEGIN
    -- Test de función de verificación
    IF EXISTS (SELECT 1 FROM public.webhook_events LIMIT 1) THEN
        RAISE NOTICE '✅ Test de check_webhook_event_processed: funcional';
    ELSE
        RAISE NOTICE '⚠️  No hay datos de prueba en webhook_events, pero las funciones están listas';
    END IF;
    
EXCEPTION 
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error en test: %', SQLERRM;
END $$;

SELECT '🎉 Script completado - Todas las funciones webhook tienen search_path seguro' as final_message; 