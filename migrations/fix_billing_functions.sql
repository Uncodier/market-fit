-- ==================================================================
-- FIX BILLING FUNCTIONS - Supabase SQL Script
-- ==================================================================
-- Este script arregla los errores 404 y 406 en el sistema de billing
-- Ejecutar directamente en la consola SQL de Supabase

-- 1. Crear función upsert_billing
-- ==================================================================
CREATE OR REPLACE FUNCTION upsert_billing(
  p_site_id UUID,
  p_plan TEXT DEFAULT NULL,
  p_card_name TEXT DEFAULT NULL,
  p_masked_card_number TEXT DEFAULT NULL,
  p_card_expiry TEXT DEFAULT NULL,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_stripe_payment_method_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_card_address TEXT DEFAULT NULL,
  p_card_city TEXT DEFAULT NULL,
  p_card_postal_code TEXT DEFAULT NULL,
  p_card_country TEXT DEFAULT NULL,
  p_tax_id TEXT DEFAULT NULL,
  p_billing_address TEXT DEFAULT NULL,
  p_billing_city TEXT DEFAULT NULL,
  p_billing_postal_code TEXT DEFAULT NULL,
  p_billing_country TEXT DEFAULT NULL,
  p_auto_renew BOOLEAN DEFAULT NULL,
  p_credits_available INTEGER DEFAULT NULL,
  p_subscription_status TEXT DEFAULT NULL,
  p_subscription_current_period_end TIMESTAMP DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  billing_record billing%ROWTYPE;
BEGIN
  -- Verificar si existe registro de billing
  SELECT * INTO billing_record FROM billing WHERE site_id = p_site_id;
  
  IF FOUND THEN
    -- Actualizar registro existente
    UPDATE billing SET
      plan = COALESCE(p_plan, plan),
      card_name = COALESCE(p_card_name, card_name),
      masked_card_number = COALESCE(p_masked_card_number, masked_card_number),
      card_expiry = COALESCE(p_card_expiry, card_expiry),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      stripe_payment_method_id = COALESCE(p_stripe_payment_method_id, stripe_payment_method_id),
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      card_address = COALESCE(p_card_address, card_address),
      card_city = COALESCE(p_card_city, card_city),
      card_postal_code = COALESCE(p_card_postal_code, card_postal_code),
      card_country = COALESCE(p_card_country, card_country),
      tax_id = COALESCE(p_tax_id, tax_id),
      billing_address = COALESCE(p_billing_address, billing_address),
      billing_city = COALESCE(p_billing_city, billing_city),
      billing_postal_code = COALESCE(p_billing_postal_code, billing_postal_code),
      billing_country = COALESCE(p_billing_country, billing_country),
      auto_renew = COALESCE(p_auto_renew, auto_renew),
      credits_available = COALESCE(p_credits_available, credits_available),
      subscription_status = COALESCE(p_subscription_status, subscription_status),
      subscription_current_period_end = COALESCE(p_subscription_current_period_end, subscription_current_period_end),
      updated_at = NOW()
    WHERE site_id = p_site_id;
  ELSE
    -- Crear nuevo registro
    INSERT INTO billing (
      site_id,
      plan,
      card_name,
      masked_card_number,
      card_expiry,
      stripe_customer_id,
      stripe_payment_method_id,
      stripe_subscription_id,
      card_address,
      card_city,
      card_postal_code,
      card_country,
      tax_id,
      billing_address,
      billing_city,
      billing_postal_code,
      billing_country,
      auto_renew,
      credits_available,
      subscription_status,
      subscription_current_period_end,
      created_at,
      updated_at
    ) VALUES (
      p_site_id,
      COALESCE(p_plan, 'commission'),
      p_card_name,
      p_masked_card_number,
      p_card_expiry,
      p_stripe_customer_id,
      p_stripe_payment_method_id,
      p_stripe_subscription_id,
      p_card_address,
      p_card_city,
      p_card_postal_code,
      p_card_country,
      p_tax_id,
      p_billing_address,
      p_billing_city,
      p_billing_postal_code,
      p_billing_country,
      COALESCE(p_auto_renew, true),
      COALESCE(p_credits_available, 0),
      p_subscription_status,
      p_subscription_current_period_end,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Billing information updated successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 2. Crear función add_credits
-- ==================================================================
CREATE OR REPLACE FUNCTION add_credits(
  p_site_id UUID,
  p_credits INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Actualizar el registro de billing para agregar créditos
  UPDATE billing 
  SET 
    credits_available = COALESCE(credits_available, 0) + p_credits,
    updated_at = NOW()
  WHERE site_id = p_site_id;
  
  -- Si no existe registro de billing, crear uno
  IF NOT FOUND THEN
    INSERT INTO billing (
      site_id,
      plan,
      credits_available,
      auto_renew,
      created_at,
      updated_at
    ) VALUES (
      p_site_id,
      'commission',
      p_credits,
      true,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'credits_added', p_credits,
    'message', 'Credits added successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 3. Agregar columnas faltantes a la tabla billing (si no existen)
-- ==================================================================
DO $$
BEGIN
  -- Verificar y agregar stripe_subscription_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'billing' 
    AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE billing ADD COLUMN stripe_subscription_id TEXT;
    RAISE NOTICE 'Added stripe_subscription_id column to billing table';
  END IF;
  
  -- Verificar y agregar subscription_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'billing' 
    AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE billing ADD COLUMN subscription_status TEXT;
    RAISE NOTICE 'Added subscription_status column to billing table';
  END IF;
  
  -- Verificar y agregar subscription_current_period_end
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'billing' 
    AND column_name = 'subscription_current_period_end'
  ) THEN
    ALTER TABLE billing ADD COLUMN subscription_current_period_end TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added subscription_current_period_end column to billing table';
  END IF;
END $$;

-- 4. Verificar y arreglar políticas RLS para la tabla billing
-- ==================================================================
-- Habilitar RLS si no está habilitado
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;

-- Eliminar TODAS las políticas existentes para billing (incluyendo la optimizada)
DROP POLICY IF EXISTS "billing_user_policy" ON billing;
DROP POLICY IF EXISTS "Users can view billing for their sites" ON billing;
DROP POLICY IF EXISTS "Users can update billing for their sites" ON billing;
DROP POLICY IF EXISTS "billing_optimized_policy" ON billing;

-- Crear política optimizada para billing (ahora sin conflictos)
CREATE POLICY "billing_optimized_policy" ON billing
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = billing.site_id AND (
      s.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
      )
    )
  )
);

-- 5. Crear función de diagnóstico para verificar el estado
-- ==================================================================
CREATE OR REPLACE FUNCTION check_billing_system()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_count INTEGER;
  table_count INTEGER;
  policy_count INTEGER;
  result JSON;
BEGIN
  -- Verificar funciones
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
  AND p.proname IN ('upsert_billing', 'add_credits');
  
  -- Verificar tabla billing
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_name = 'billing';
  
  -- Verificar políticas RLS
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'billing';
  
  result := json_build_object(
    'status', 'success',
    'functions_found', function_count,
    'expected_functions', 2,
    'billing_table_exists', table_count > 0,
    'rls_policies_count', policy_count,
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$;

-- 6. Ejecutar diagnóstico
-- ==================================================================
SELECT check_billing_system() AS billing_system_status;

-- 7. Crear índices para optimización (si no existen)
-- ==================================================================
CREATE INDEX IF NOT EXISTS idx_billing_site_id ON billing(site_id);
CREATE INDEX IF NOT EXISTS idx_billing_stripe_customer_id ON billing(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_plan ON billing(plan);

-- ==================================================================
-- COMPLETADO: Sistema de billing reparado
-- ==================================================================
-- Las funciones upsert_billing y add_credits ahora están disponibles
-- Las políticas RLS han sido optimizadas
-- Se agregaron las columnas faltantes
-- Se crearon índices para mejor rendimiento 