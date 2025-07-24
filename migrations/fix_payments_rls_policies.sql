-- ==================================================================
-- FIX PAYMENTS RLS POLICIES - Supabase SQL Script
-- ==================================================================
-- Esta migración arregla las políticas RLS para permitir que el service role
-- (webhooks de Stripe) pueda insertar pagos correctamente

-- 1. Verificar políticas actuales de payments
-- ==================================================================
SELECT 
    'CURRENT POLICIES' as step,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'payments';

-- 2. Eliminar políticas conflictivas existentes
-- ==================================================================
DROP POLICY IF EXISTS "payments_select_optimized" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_optimized" ON public.payments;
DROP POLICY IF EXISTS "System can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view payments for their sites" ON public.payments;
DROP POLICY IF EXISTS "payments_user_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_optimized_policy" ON public.payments;

-- 3. Crear política para SELECT (usuarios autenticados)
-- ==================================================================
CREATE POLICY "payments_select_policy" ON public.payments
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sites s 
    WHERE s.id = payments.site_id AND (
      s.user_id = (SELECT auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
      )
    )
  )
);

-- 4. Crear política para INSERT (service role y usuarios autenticados)
-- ==================================================================
CREATE POLICY "payments_insert_policy" ON public.payments
FOR INSERT 
TO service_role, authenticated
WITH CHECK (true);

-- 5. Crear política para UPDATE (solo usuarios autenticados con acceso al sitio)
-- ==================================================================
CREATE POLICY "payments_update_policy" ON public.payments
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sites s 
    WHERE s.id = payments.site_id AND (
      s.user_id = (SELECT auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sites s 
    WHERE s.id = payments.site_id AND (
      s.user_id = (SELECT auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
      )
    )
  )
);

-- 6. Asegurar que RLS esté habilitado y dar permisos
-- ==================================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Dar permisos explícitos
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payments TO service_role;

-- 7. Función para probar el acceso del service role
-- ==================================================================
CREATE OR REPLACE FUNCTION public.test_payments_service_role_access()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_site_id UUID := 'test-service-role-payments-123';
  test_result JSON;
  payment_id UUID;
BEGIN
  -- Simular inserción como service role
  SET LOCAL role = 'service_role';
  
  -- Intentar insertar un pago
  INSERT INTO public.payments (
    site_id,
    transaction_id,
    transaction_type,
    amount,
    currency,
    status,
    payment_method,
    details,
    credits
  ) VALUES (
    test_site_id,
    'test_service_role_' || extract(epoch from now())::text,
    'test',
    100.00,
    'USD',
    'completed',
    'stripe',
    '{"test": "service_role_access"}'::jsonb,
    0
  ) RETURNING id INTO payment_id;
  
  -- Verificar que se insertó
  IF payment_id IS NOT NULL THEN
    -- Limpiar el test
    DELETE FROM public.payments WHERE id = payment_id;
    
    SELECT json_build_object(
      'success', true,
      'message', 'Service role can insert payments successfully',
      'payment_id', payment_id,
      'test_site_id', test_site_id
    ) INTO test_result;
  ELSE
    SELECT json_build_object(
      'success', false,
      'message', 'Service role insert returned NULL',
      'test_site_id', test_site_id
    ) INTO test_result;
  END IF;
  
  RETURN test_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Limpiar en caso de error
    BEGIN
      DELETE FROM public.payments WHERE site_id = test_site_id;
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
    
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'message', 'Service role cannot insert payments'
    );
END;
$$;

-- 8. Ejecutar test del service role
-- ==================================================================
SELECT test_payments_service_role_access() AS service_role_access_test;

-- 9. Verificar políticas finales
-- ==================================================================
SELECT 
    'FINAL POLICIES' as step,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'payments'
ORDER BY policyname;

-- 10. Crear función de diagnóstico permanente
-- ==================================================================
CREATE OR REPLACE FUNCTION public.diagnose_payments_access()
RETURNS TABLE(
    check_type text,
    status text,
    details text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check 1: RLS enabled
    RETURN QUERY
    SELECT 
        'RLS Status'::text,
        CASE 
            WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'payments') THEN 'ENABLED'
            ELSE 'DISABLED'
        END::text,
        'Row Level Security status on payments table'::text;
    
    -- Check 2: Policies count
    RETURN QUERY
    SELECT 
        'Policies Count'::text,
        (SELECT COUNT(*)::text FROM pg_policies WHERE tablename = 'payments')::text,
        'Number of RLS policies on payments table'::text;
    
    -- Check 3: Service role permissions
    RETURN QUERY
    SELECT 
        'Service Role Access'::text,
        CASE 
            WHEN has_table_privilege('service_role', 'public.payments', 'INSERT') THEN 'GRANTED'
            ELSE 'DENIED'
        END::text,
        'INSERT permission for service_role on payments'::text;
        
    -- Check 4: Table exists and accessible
    RETURN QUERY
    SELECT 
        'Table Access'::text,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN 'ACCESSIBLE'
            ELSE 'NOT_ACCESSIBLE'
        END::text,
        'Basic table access check'::text;
END;
$$;

-- 11. Ejecutar diagnóstico
-- ==================================================================
SELECT * FROM public.diagnose_payments_access();

-- ==================================================================
-- COMPLETADO: Políticas RLS para payments arregladas
-- Service role ahora puede insertar pagos desde webhooks
-- ================================================================== 