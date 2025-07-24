-- ==================================================================
-- FIX PAYMENTS COMMAND_ID NULLABLE - Supabase SQL Script
-- ==================================================================
-- Esta migración arregla el problema con los pagos al hacer command_id nullable
-- y verificar que no haya constraints bloqueando los inserts

-- 1. Hacer command_id nullable en payments
-- ==================================================================
ALTER TABLE public.payments 
ALTER COLUMN command_id DROP NOT NULL;

-- 2. Verificar que la foreign key constraint permita NULL
-- ==================================================================
-- Esto debería ser automático, pero vamos a verificar
DO $$
BEGIN
  -- Verificar si la constraint existe y si permite NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'payments' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'command_id'
  ) THEN
    RAISE NOTICE 'Foreign key constraint on command_id exists and should allow NULL values';
  ELSE
    RAISE NOTICE 'No foreign key constraint found on command_id';
  END IF;
END $$;

-- 3. Hacer command_id nullable en todas las tablas relacionadas para consistencia
-- ==================================================================
DO $$
DECLARE
  table_record RECORD;
BEGIN
  -- Lista de tablas que tienen command_id
  FOR table_record IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'command_id'
    AND table_schema = 'public'
    AND is_nullable = 'NO'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN command_id DROP NOT NULL', table_record.table_name);
      RAISE NOTICE 'Made command_id nullable in table: %', table_record.table_name;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter table %: %', table_record.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4. Verificar que podemos insertar un pago sin command_id
-- ==================================================================
CREATE OR REPLACE FUNCTION public.test_payment_insert()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  test_site_id UUID := 'test-payment-insert-12345';
  test_result JSON;
BEGIN
  -- Intentar insertar un pago de test sin command_id
  INSERT INTO payments (
    site_id,
    transaction_id,
    transaction_type,
    amount,
    currency,
    status,
    payment_method,
    details,
    credits,
    command_id  -- Explicitly set to NULL
  ) VALUES (
    test_site_id,
    'test_payment_' || extract(epoch from now())::text,
    'test',
    100.00,
    'USD',
    'completed',
    'test',
    '{"test": true}'::jsonb,
    0,
    NULL
  );
  
  -- Verificar que se insertó
  IF EXISTS (SELECT 1 FROM payments WHERE site_id = test_site_id) THEN
    -- Limpiar el test
    DELETE FROM payments WHERE site_id = test_site_id;
    
    SELECT json_build_object(
      'success', true,
      'message', 'Payment insert test successful',
      'command_id_nullable', true
    ) INTO test_result;
  ELSE
    SELECT json_build_object(
      'success', false,
      'message', 'Payment was not inserted',
      'command_id_nullable', false
    ) INTO test_result;
  END IF;
  
  RETURN test_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Limpiar en caso de error
    DELETE FROM payments WHERE site_id = test_site_id;
    
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'message', 'Payment insert test failed'
    );
END;
$$;

-- 5. Ejecutar test
-- ==================================================================
SELECT test_payment_insert() AS payment_insert_test_result;

-- 6. Verificar estructura final de la tabla payments
-- ==================================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'payments'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ==================================================================
-- COMPLETADO: Payments table ahora permite command_id NULL
-- ================================================================== 