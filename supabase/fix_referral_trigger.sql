-- =====================================================
-- CORRECCIÓN DEL TRIGGER DE REFERRAL CODES
-- =====================================================

-- 1. ELIMINAR EL TRIGGER ACTUAL PARA RECREARLO
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. VER LA FUNCIÓN ACTUAL handle_new_user
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 3. CREAR UNA VERSIÓN ROBUSTA DE handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  referral_code_value TEXT;
  profile_insert_result RECORD;
BEGIN
  -- Registrar el inicio de la función
  RAISE LOG 'handle_new_user: Starting for user %', NEW.id;
  
  BEGIN
    -- Extraer referral code de los metadatos
    referral_code_value := NEW.raw_user_meta_data->>'referral_code';
    
    RAISE LOG 'handle_new_user: Referral code found: %', COALESCE(referral_code_value, 'NULL');
    
    -- Insertar perfil de usuario
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
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
    
    RAISE LOG 'handle_new_user: Profile created successfully for user %', NEW.id;
    
    -- Si hay un código de referido, procesarlo
    IF referral_code_value IS NOT NULL AND referral_code_value != '' THEN
      RAISE LOG 'handle_new_user: Processing referral code: %', referral_code_value;
      
      -- Registrar el uso del código de referido (usando la función existente)
      PERFORM public.register_referral_code_use(referral_code_value, NEW.id);
      
      RAISE LOG 'handle_new_user: Referral code processed successfully';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log del error pero no fallar completamente
    RAISE LOG 'handle_new_user: Error occurred - SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
    
    -- Si falló la inserción del perfil, intentar una inserción mínima
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
      BEGIN
        INSERT INTO public.profiles (id, email, created_at, updated_at) 
        VALUES (NEW.id, NEW.email, NOW(), NOW());
        RAISE LOG 'handle_new_user: Minimal profile created as fallback';
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'handle_new_user: Even fallback profile creation failed';
      END;
    END IF;
  END;
  
  RAISE LOG 'handle_new_user: Completed for user %', NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RECREAR EL TRIGGER
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. VERIFICAR QUE TODO ESTÉ CONFIGURADO
SELECT 
  'Trigger recreated' as status,
  tgname as trigger_name,
  tgenabled as is_enabled
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 6. VERIFICAR LAS FUNCIONES
SELECT 
  proname as function_name,
  'EXISTS' as status
FROM pg_proc 
WHERE proname IN ('handle_new_user', 'register_referral_code_use', 'validate_referral_code')
ORDER BY proname; 