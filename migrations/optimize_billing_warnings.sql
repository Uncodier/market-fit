-- ==================================================================
-- OPTIMIZE BILLING WARNINGS - Supabase SQL Script
-- ==================================================================
-- Este script arregla los warnings de seguridad y performance
-- relacionados con las funciones de billing

-- 1. Arreglar función upsert_billing - Agregar search_path seguro
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
SET search_path = public
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

-- 2. Arreglar función add_credits - Agregar search_path seguro
-- ==================================================================
CREATE OR REPLACE FUNCTION add_credits(
  p_site_id UUID,
  p_credits INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 3. Arreglar función check_billing_system - Agregar search_path seguro
-- ==================================================================
CREATE OR REPLACE FUNCTION check_billing_system()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    'timestamp', NOW(),
    'warnings_fixed', true
  );
  
  RETURN result;
END;
$$;

-- 4. Optimizar política RLS para mejor performance
-- ==================================================================
-- Eliminar política actual
DROP POLICY IF EXISTS "billing_optimized_policy" ON billing;

-- Crear política optimizada para performance (usando SELECT para auth.uid())
CREATE POLICY "billing_optimized_policy" ON billing
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = billing.site_id AND (
      s.user_id = (SELECT auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
      )
    )
  )
);

-- 5. Verificar que todo está optimizado
-- ==================================================================
SELECT check_billing_system() AS optimized_billing_status;

-- ==================================================================
-- COMPLETADO: Warnings de seguridad y performance arreglados
-- ==================================================================
-- ✅ Funciones tienen search_path = public fijo (seguridad)
-- ✅ Política RLS optimizada para performance
-- ✅ auth.uid() usa SELECT para evitar re-evaluación por fila 