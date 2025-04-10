-- Función para insertar pagos de prueba para un sitio específico
CREATE OR REPLACE FUNCTION insert_test_payments(p_site_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_billing_id UUID;
BEGIN
  -- Intentar encontrar el billing_id para el sitio
  SELECT id INTO v_billing_id FROM billing WHERE site_id = p_site_id;
  
  -- Insertar algunos datos de prueba para el historial de pagos
  INSERT INTO payments (
    site_id,
    billing_id,
    transaction_id,
    transaction_type,
    amount,
    status,
    details,
    credits,
    created_at
  ) VALUES
  (
    p_site_id,
    v_billing_id,
    'tx_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
    'subscription',
    29.00,
    'success',
    '{"description": "Monthly Starter Plan"}'::jsonb,
    100,
    NOW() - interval '30 days'
  ),
  (
    p_site_id,
    v_billing_id,
    'tx_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
    'credit_purchase',
    19.00,
    'success',
    '{"description": "Credit Pack Purchase"}'::jsonb,
    50,
    NOW() - interval '15 days'
  ),
  (
    p_site_id,
    v_billing_id,
    'tx_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
    'credit_purchase',
    49.00,
    'success',
    '{"description": "Premium Credit Pack"}'::jsonb,
    200,
    NOW() - interval '5 days'
  ),
  (
    p_site_id,
    v_billing_id,
    'tx_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
    'refund',
    -19.00,
    'success',
    '{"description": "Refund for unused credits"}'::jsonb,
    -50,
    NOW() - interval '2 days'
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Exponer la función como RPC para usarla desde la interfaz
CREATE OR REPLACE FUNCTION public.generate_test_payment_history(site_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_site_access BOOLEAN;
BEGIN
  -- Comprobar acceso (ajustar según tu esquema)
  SELECT EXISTS (
    SELECT 1 FROM sites WHERE id = site_id AND user_id = auth.uid()
  ) INTO v_site_access;
  
  IF NOT v_site_access THEN
    RAISE EXCEPTION 'Access denied to site';
  END IF;
  
  RETURN insert_test_payments(site_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 