-- =====================================================
-- SCRIPT DE DEBUG AVANZADO PARA SISTEMA DE REFERRAL CODES
-- =====================================================

-- 1. CREAR FUNCIÓN DE LOGGING PARA DEBUG
-- =====================================================

CREATE OR REPLACE FUNCTION log_debug(message TEXT)
RETURNS VOID AS $$
BEGIN
  RAISE NOTICE '[DEBUG] %', message;
  -- También podríamos insertar en una tabla de logs si fuera necesario
END;
$$ LANGUAGE plpgsql;

-- 2. CREAR VERSIÓN DEBUG DE handle_new_user
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_debug()
RETURNS TRIGGER AS $$
DECLARE
  referral_code_value TEXT;
  validation_result BOOLEAN;
  registration_result BOOLEAN;
BEGIN
  PERFORM log_debug('=== INICIO handle_new_user_debug ===');
  PERFORM log_debug('Usuario ID: ' || NEW.id::TEXT);
  PERFORM log_debug('Email: ' || NEW.email);
  PERFORM log_debug('Metadatos completos: ' || COALESCE(NEW.raw_user_meta_data::TEXT, 'NULL'));
  
  -- Extraer código de referido
  referral_code_value := NEW.raw_user_meta_data->>'referral_code';
  PERFORM log_debug('Código extraído: ' || COALESCE(referral_code_value, 'NULL'));
  PERFORM log_debug('Longitud del código: ' || COALESCE(LENGTH(referral_code_value)::TEXT, 'NULL'));
  
  BEGIN
    -- Crear perfil
    PERFORM log_debug('Creando perfil...');
    INSERT INTO public.profiles (
      id,
      email,
      name,
      avatar_url,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.raw_user_meta_data->>'avatar_url',
      NOW(),
      NOW()
    );
    PERFORM log_debug('✅ Perfil creado exitosamente');
    
  EXCEPTION WHEN OTHERS THEN
    PERFORM log_debug('❌ Error creando perfil: ' || SQLERRM);
  END;
  
  -- Procesar código de referido si existe
  IF referral_code_value IS NOT NULL AND referral_code_value != '' THEN
    PERFORM log_debug('Procesando código de referido: ' || referral_code_value);
    
    -- Validar código
    BEGIN
      SELECT validate_referral_code(referral_code_value) INTO validation_result;
      PERFORM log_debug('Resultado validación: ' || validation_result::TEXT);
      
      IF validation_result THEN
        -- Registrar uso
        PERFORM log_debug('Registrando uso del código...');
        SELECT register_referral_code_use(referral_code_value, NEW.id) INTO registration_result;
        PERFORM log_debug('Resultado registro: ' || registration_result::TEXT);
        
        IF registration_result THEN
          PERFORM log_debug('✅ Código de referido procesado exitosamente');
        ELSE
          PERFORM log_debug('❌ Falló el registro del código');
        END IF;
      ELSE
        PERFORM log_debug('❌ Código de referido inválido');
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      PERFORM log_debug('❌ Error procesando código de referido: ' || SQLERRM);
    END;
  ELSE
    PERFORM log_debug('No hay código de referido para procesar');
  END IF;
  
  PERFORM log_debug('=== FIN handle_new_user_debug ===');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FUNCIÓN PARA SIMULAR CREACIÓN DE USUARIO
-- =====================================================

CREATE OR REPLACE FUNCTION simulate_user_creation(
  test_email TEXT,
  test_name TEXT,
  test_referral_code TEXT
)
RETURNS TEXT AS $$
DECLARE
  test_user_id UUID;
  test_user_record RECORD;
  trigger_result RECORD;
BEGIN
  -- Generar ID único para el test
  test_user_id := gen_random_uuid();
  
  PERFORM log_debug('=== SIMULACIÓN DE CREACIÓN DE USUARIO ===');
  PERFORM log_debug('Email: ' || test_email);
  PERFORM log_debug('Nombre: ' || test_name);
  PERFORM log_debug('Código: ' || test_referral_code);
  PERFORM log_debug('ID generado: ' || test_user_id::TEXT);
  
  -- Crear registro simulado
  SELECT 
    test_user_id as id,
    test_email as email,
    jsonb_build_object(
      'name', test_name,
      'referral_code', test_referral_code
    ) as raw_user_meta_data,
    NOW() as created_at,
    NOW() as updated_at
  INTO test_user_record;
  
  -- Ejecutar la función de trigger manualmente
  PERFORM handle_new_user_debug() FROM (
    SELECT 
      test_user_record.id as id,
      test_user_record.email as email,
      test_user_record.raw_user_meta_data as raw_user_meta_data,
      test_user_record.created_at as created_at,
      test_user_record.updated_at as updated_at
  ) AS NEW;
  
  RETURN 'Simulación completada - revisa los logs NOTICE arriba';
  
EXCEPTION WHEN OTHERS THEN
  RETURN 'Error en simulación: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 4. FUNCIÓN PARA VERIFICAR ESTADO ACTUAL
-- =====================================================

CREATE OR REPLACE FUNCTION check_referral_system_status()
RETURNS TABLE (
  component TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Verificar tablas
  RETURN QUERY
  SELECT 
    'Tabla referral_codes'::TEXT,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_codes') 
         THEN '✅ Existe' ELSE '❌ No existe' END,
    (SELECT COUNT(*)::TEXT || ' códigos' FROM public.referral_codes)::TEXT;
    
  RETURN QUERY
  SELECT 
    'Tabla referral_code_uses'::TEXT,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_code_uses') 
         THEN '✅ Existe' ELSE '❌ No existe' END,
    (SELECT COUNT(*)::TEXT || ' usos' FROM public.referral_code_uses)::TEXT;
  
  -- Verificar funciones
  RETURN QUERY
  SELECT 
    'Función validate_referral_code'::TEXT,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_referral_code') 
         THEN '✅ Existe' ELSE '❌ No existe' END,
    'Valida códigos de referido'::TEXT;
    
  RETURN QUERY
  SELECT 
    'Función register_referral_code_use'::TEXT,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_referral_code_use') 
         THEN '✅ Existe' ELSE '❌ No existe' END,
    'Registra uso de códigos'::TEXT;
    
  RETURN QUERY
  SELECT 
    'Función handle_new_user'::TEXT,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') 
         THEN '✅ Existe' ELSE '❌ No existe' END,
    'Trigger de nuevos usuarios'::TEXT;
  
  -- Verificar trigger
  RETURN QUERY
  SELECT 
    'Trigger on_auth_user_created'::TEXT,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created') 
         THEN '✅ Existe' ELSE '❌ No existe' END,
    'Trigger en auth.users'::TEXT;
    
  -- Verificar códigos activos
  RETURN QUERY
  SELECT 
    'Códigos activos'::TEXT,
    (SELECT COUNT(*)::TEXT FROM public.referral_codes WHERE is_active = true),
    (SELECT string_agg(code, ', ') FROM public.referral_codes WHERE is_active = true)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 5. EJECUTAR VERIFICACIONES
-- =====================================================

SELECT '=== ESTADO DEL SISTEMA ===' as info;
SELECT * FROM check_referral_system_status();

-- 6. PROBAR CON CÓDIGO CONOCIDO
-- =====================================================

SELECT '=== SIMULACIÓN CON CÓDIGO FOUNDER ===' as info;
SELECT simulate_user_creation('test@example.com', 'Test User', 'FOUNDER');

-- 7. VERIFICAR RESULTADOS
-- =====================================================

SELECT '=== VERIFICAR SI SE CREÓ EL USO ===' as info;
SELECT 
  rc.code,
  COUNT(rcu.id) as usos_registrados,
  rc.current_uses as contador_tabla
FROM public.referral_codes rc
LEFT JOIN public.referral_code_uses rcu ON rc.id = rcu.referral_code_id
WHERE rc.code = 'FOUNDER'
GROUP BY rc.id, rc.code, rc.current_uses;

-- 8. LIMPIAR FUNCIONES DE DEBUG
-- =====================================================

-- Comentar estas líneas para mantener las funciones de debug:
-- DROP FUNCTION IF EXISTS log_debug(TEXT);
-- DROP FUNCTION IF EXISTS simulate_user_creation(TEXT, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS check_referral_system_status();
-- DROP FUNCTION IF EXISTS handle_new_user_debug(); 