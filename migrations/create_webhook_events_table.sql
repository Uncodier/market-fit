-- ==================================================================
-- CREATE WEBHOOK EVENTS TRACKING TABLE - Supabase SQL Script
-- ==================================================================
-- Esta migración crea una tabla para rastrear eventos de webhook procesados
-- para implementar idempotencia y evitar procesamiento duplicado

-- 1. Crear tabla webhook_events
-- ==================================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status VARCHAR(50) NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'skipped')),
  event_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  site_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Crear índices para optimizar consultas
-- ==================================================================
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_site_id ON webhook_events(site_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);

-- 3. Crear trigger para updated_at
-- ==================================================================
CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_events_updated_at_trigger
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_events_updated_at();

-- 4. Configurar RLS (Row Level Security)
-- ==================================================================
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Política para service role (webhooks pueden insertar/leer todo)
CREATE POLICY "webhook_events_service_role_policy" ON webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política para usuarios autenticados (solo pueden ver eventos de sus sitios)
CREATE POLICY "webhook_events_users_policy" ON webhook_events
  FOR SELECT
  TO authenticated
  USING (
    site_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM sites s 
      WHERE s.id = webhook_events.site_id AND (
        s.user_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- 5. Dar permisos necesarios
-- ==================================================================
GRANT SELECT, INSERT, UPDATE ON webhook_events TO service_role;
GRANT SELECT ON webhook_events TO authenticated;

-- 6. Función para verificar si un evento ya fue procesado
-- ==================================================================
CREATE OR REPLACE FUNCTION check_webhook_event_processed(event_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM webhook_events 
    WHERE stripe_event_id = event_id 
    AND status = 'processed'
  );
END;
$$;

-- 7. Función para marcar evento como procesado
-- ==================================================================
CREATE OR REPLACE FUNCTION mark_webhook_event_processed(
  event_id TEXT,
  event_type_param TEXT,
  event_data_param JSONB DEFAULT '{}'::jsonb,
  site_id_param UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  webhook_event_id UUID;
BEGIN
  INSERT INTO webhook_events (
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

-- 8. Función para marcar evento como fallido
-- ==================================================================
CREATE OR REPLACE FUNCTION mark_webhook_event_failed(
  event_id TEXT,
  event_type_param TEXT,
  error_msg TEXT,
  event_data_param JSONB DEFAULT '{}'::jsonb,
  site_id_param UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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
  FROM webhook_events 
  WHERE stripe_event_id = event_id;
  
  -- Add attempt tracking to event data
  event_data_param = event_data_param || jsonb_build_object('attempt_count', attempt_count);
  
  INSERT INTO webhook_events (
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

-- 9. Función de limpieza para eventos antiguos (más de 30 días)
-- ==================================================================
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_events 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 10. Verificar que todo se creó correctamente
-- ==================================================================
SELECT 
  'webhook_events table created successfully' as status,
  COUNT(*) as function_count
FROM information_schema.routines 
WHERE routine_name IN (
  'check_webhook_event_processed',
  'mark_webhook_event_processed', 
  'mark_webhook_event_failed',
  'cleanup_old_webhook_events'
)
AND routine_schema = 'public';

-- ==================================================================
-- COMPLETADO: Tabla webhook_events y funciones helper creadas
-- ================================================================== 