-- =====================================================
-- DIAGNÓSTICO Y CORRECCIÓN DEL TRIGGER AUTOMÁTICO
-- =====================================================

-- 1. VERIFICAR SI EL TRIGGER EXISTE
-- =====================================================

SELECT 
    'VERIFICACIÓN DE TRIGGER' as info,
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- 2. VERIFICAR PERMISOS EN LA TABLA auth.users
-- =====================================================

SELECT 
    'PERMISOS EN auth.users' as info,
    pt.schemaname,
    pt.tablename,
    'auth.users table exists' as status
FROM pg_tables pt
WHERE pt.schemaname = 'auth' AND pt.tablename = 'users';

-- 3. VERIFICAR LA FUNCIÓN handle_new_user
-- =====================================================

SELECT 
    'FUNCIÓN handle_new_user' as info,
    proname,
    prosecdef as is_security_definer,
    proowner::regrole as owner
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 4. ELIMINAR Y RECREAR EL TRIGGER COMPLETAMENTE
-- =====================================================

-- Eliminar trigger existente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Verificar que se eliminó
SELECT 'Trigger eliminado' as status;

-- Recrear la función handle_new_user con logging mejorado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  referral_code_value TEXT;
  profile_created BOOLEAN := FALSE;
  referral_processed BOOLEAN := FALSE;
BEGIN
  -- Log del inicio
  RAISE LOG 'handle_new_user triggered for user: % (email: %)', NEW.id, NEW.email;
  
  BEGIN
    -- Crear perfil de usuario
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
    
    profile_created := TRUE;
    RAISE LOG 'Profile created successfully for user: %', NEW.id;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    -- Continuar con el procesamiento aunque falle la creación del perfil
  END;
  
  -- Procesar código de referido
  referral_code_value := NEW.raw_user_meta_data->>'referral_code';
  
  IF referral_code_value IS NOT NULL AND referral_code_value != '' THEN
    RAISE LOG 'Processing referral code % for user %', referral_code_value, NEW.id;
    
    BEGIN
      -- Usar la función de registro de código de referido
      SELECT register_referral_code_use(referral_code_value, NEW.id) INTO referral_processed;
      
      IF referral_processed THEN
        RAISE LOG 'Referral code % processed successfully for user %', referral_code_value, NEW.id;
      ELSE
        RAISE LOG 'Failed to process referral code % for user %', referral_code_value, NEW.id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error processing referral code % for user %: %', referral_code_value, NEW.id, SQLERRM;
    END;
  ELSE
    RAISE LOG 'No referral code found for user %', NEW.id;
  END IF;
  
  RAISE LOG 'handle_new_user completed for user % - Profile: %, Referral: %', 
    NEW.id, profile_created, referral_processed;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RECREAR EL TRIGGER
-- =====================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. VERIFICAR QUE EL TRIGGER SE CREÓ CORRECTAMENTE
-- =====================================================

SELECT 
    'TRIGGER RECREADO' as status,
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 7. HABILITAR LOGGING PARA VER LA ACTIVIDAD DEL TRIGGER
-- =====================================================

-- Configurar el nivel de log para ver los mensajes LOG
-- (Esto puede requerir permisos de superusuario)
-- SET log_min_messages = 'log';

SELECT 'Trigger recreado y configurado' as final_status;

-- 8. FUNCIÓN DE PRUEBA PARA SIMULAR INSERCIÓN EN auth.users
-- =====================================================

CREATE OR REPLACE FUNCTION test_auth_trigger(
  test_email TEXT,
  test_name TEXT,
  test_referral_code TEXT
)
RETURNS TEXT AS $$
DECLARE
  test_user_id UUID;
  result_text TEXT;
BEGIN
  test_user_id := gen_random_uuid();
  
  -- Simular inserción en auth.users (esto disparará el trigger)
  -- NOTA: Esto es solo para testing, en producción Supabase Auth maneja esto
  BEGIN
    INSERT INTO auth.users (
      id,
      email,
      raw_user_meta_data,
      created_at,
      updated_at,
      email_confirmed_at,
      aud,
      role
    ) VALUES (
      test_user_id,
      test_email,
      jsonb_build_object(
        'name', test_name,
        'referral_code', test_referral_code
      ),
      NOW(),
      NOW(),
      NOW(),
      'authenticated',
      'authenticated'
    );
    
    result_text := 'SUCCESS: Test user created with ID ' || test_user_id::TEXT;
    
  EXCEPTION WHEN OTHERS THEN
    result_text := 'ERROR: ' || SQLERRM;
  END;
  
  RETURN result_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. EJECUTAR PRUEBA DEL TRIGGER
-- =====================================================

SELECT 'EJECUTANDO PRUEBA DEL TRIGGER:' as info;
SELECT test_auth_trigger('trigger-test@example.com', 'Trigger Test User', 'FOUNDER');

-- 10. VERIFICAR RESULTADOS DE LA PRUEBA
-- =====================================================

SELECT 'VERIFICAR PERFIL CREADO:' as info;
SELECT id, email, name FROM public.profiles 
WHERE email = 'trigger-test@example.com';

SELECT 'VERIFICAR USO DE CÓDIGO:' as info;
SELECT 
  rc.code,
  COUNT(rcu.id) as total_uses,
  rc.current_uses as counter_value
FROM public.referral_codes rc
LEFT JOIN public.referral_code_uses rcu ON rc.id = rcu.referral_code_id
WHERE rc.code = 'FOUNDER'
GROUP BY rc.id, rc.code, rc.current_uses;

-- 11. LIMPIAR DATOS DE PRUEBA
-- =====================================================

-- Eliminar usuario de prueba creado
DELETE FROM auth.users WHERE email = 'trigger-test@example.com';
DELETE FROM public.profiles WHERE email = 'trigger-test@example.com';

-- Eliminar función de prueba
DROP FUNCTION IF EXISTS test_auth_trigger(TEXT, TEXT, TEXT);

SELECT 'Limpieza completada' as cleanup_status; 