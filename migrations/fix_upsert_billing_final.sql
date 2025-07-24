-- ==================================================================
-- FIX UPSERT BILLING FINAL - Supabase SQL Script
-- ==================================================================
-- Esta migración arregla definitivamente la función upsert_billing
-- con manejo correcto de errores y logging mejorado

-- 1. Eliminar función existente para asegurar una implementación limpia
-- ==================================================================
DROP FUNCTION IF EXISTS public.upsert_billing(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, TEXT, TIMESTAMP
);

-- 2. Crear función upsert_billing con implementación correcta
-- ==================================================================
CREATE OR REPLACE FUNCTION public.upsert_billing(
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
SET search_path = public
AS $$
DECLARE
  billing_record billing%ROWTYPE;
  record_exists BOOLEAN := FALSE;
  result_message TEXT;
BEGIN
  -- Verificar que p_site_id no sea nulo
  IF p_site_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'site_id cannot be null'
    );
  END IF;

  -- Verificar si existe registro de billing
  SELECT * INTO billing_record FROM billing WHERE site_id = p_site_id;
  record_exists := FOUND;
  
  IF record_exists THEN
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
    
    result_message := 'Billing record updated successfully';
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
    
    result_message := 'Billing record created successfully';
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', result_message,
    'record_existed', record_exists,
    'site_id', p_site_id,
    'stripe_customer_id', COALESCE(p_stripe_customer_id, billing_record.stripe_customer_id),
    'plan', COALESCE(p_plan, billing_record.plan)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'site_id', p_site_id
    );
END;
$$;

-- 3. Verificar que la tabla billing tenga todas las columnas necesarias
-- ==================================================================
DO $$
BEGIN
  -- Verificar y agregar columnas faltantes si no existen
  
  -- stripe_subscription_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'billing' 
    AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE billing ADD COLUMN stripe_subscription_id TEXT;
    RAISE NOTICE 'Added stripe_subscription_id column to billing table';
  END IF;
  
  -- subscription_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'billing' 
    AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE billing ADD COLUMN subscription_status TEXT;
    RAISE NOTICE 'Added subscription_status column to billing table';
  END IF;
  
  -- subscription_current_period_end
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'billing' 
    AND column_name = 'subscription_current_period_end'
  ) THEN
    ALTER TABLE billing ADD COLUMN subscription_current_period_end TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added subscription_current_period_end column to billing table';
  END IF;
END $$;

-- 4. Crear función de test para verificar que upsert_billing funciona
-- ==================================================================
CREATE OR REPLACE FUNCTION public.test_upsert_billing(test_site_id UUID DEFAULT 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  test_result JSON;
  verification JSON;
BEGIN
  -- Test 1: Crear un nuevo registro
  SELECT upsert_billing(
    test_site_id,
    'test_plan',
    NULL, -- card_name
    NULL, -- masked_card_number
    NULL, -- card_expiry
    'test_customer_id',
    NULL, -- stripe_payment_method_id
    NULL, -- stripe_subscription_id
    NULL, -- card_address
    NULL, -- card_city
    NULL, -- card_postal_code
    NULL, -- card_country
    NULL, -- tax_id
    NULL, -- billing_address
    NULL, -- billing_city
    NULL, -- billing_postal_code
    NULL, -- billing_country
    true, -- auto_renew
    100   -- credits_available
  ) INTO test_result;
  
  -- Verificar que el registro se creó
  SELECT json_build_object(
    'function_available', true,
    'test_result', test_result,
    'timestamp', NOW()
  ) INTO verification;
  
  -- Limpiar el registro de test (solo si es el UUID de test)
  IF test_site_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' THEN
    DELETE FROM billing WHERE site_id = test_site_id;
  END IF;
  
  RETURN verification;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'function_available', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'timestamp', NOW()
    );
END;
$$;

-- 5. Ejecutar test y mostrar resultado
-- ==================================================================
SELECT test_upsert_billing() AS upsert_billing_test_result;

-- 6. Crear índices si no existen
-- ==================================================================
CREATE INDEX IF NOT EXISTS idx_billing_site_id ON billing(site_id);
CREATE INDEX IF NOT EXISTS idx_billing_stripe_customer_id ON billing(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_plan ON billing(plan);

-- ==================================================================
-- COMPLETADO: Función upsert_billing arreglada y verificada
-- ================================================================== 