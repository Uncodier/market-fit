-- =====================================================
-- CORRECCIÓN SIMPLE DEL TRIGGER DE REFERRAL CODES
-- =====================================================

-- 1. VERIFICAR ESTADO ACTUAL
-- =====================================================

SELECT 'VERIFICANDO TRIGGER EXISTENTE' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 2. ELIMINAR TRIGGER EXISTENTE
-- =====================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

SELECT 'Trigger eliminado' as status;

-- 3. RECREAR FUNCIÓN handle_new_user (VERSIÓN SIMPLE)
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  referral_code_value TEXT;
  user_name TEXT;
BEGIN
  -- Extraer valores de metadatos de forma segura
  BEGIN
    referral_code_value := NEW.raw_user_meta_data ->> 'referral_code';
    user_name := NEW.raw_user_meta_data ->> 'name';
  EXCEPTION WHEN OTHERS THEN
    referral_code_value := NULL;
    user_name := NEW.email;
  END;
  
  -- Crear perfil de usuario
  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      name,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(user_name, NEW.email),
      NOW(),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Si falla la creación del perfil, continuar
    NULL;
  END;
  
  -- Procesar código de referido si existe
  IF referral_code_value IS NOT NULL AND referral_code_value != '' THEN
    BEGIN
      PERFORM register_referral_code_use(referral_code_value, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el procesamiento del código, continuar
      NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RECREAR EL TRIGGER
-- =====================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. VERIFICAR QUE EL TRIGGER SE CREÓ
-- =====================================================

SELECT 'TRIGGER RECREADO EXITOSAMENTE' as status;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 6. VERIFICAR FUNCIONES NECESARIAS
-- =====================================================

SELECT 'VERIFICANDO FUNCIONES' as info;

SELECT 
    proname as function_name,
    'EXISTS' as status
FROM pg_proc 
WHERE proname IN ('handle_new_user', 'register_referral_code_use', 'validate_referral_code')
ORDER BY proname;

-- 7. MOSTRAR CÓDIGOS DE REFERIDO DISPONIBLES
-- =====================================================

SELECT 'CÓDIGOS DISPONIBLES' as info;

SELECT 
    code,
    is_active,
    current_uses,
    max_uses
FROM public.referral_codes 
WHERE is_active = true
ORDER BY code;

-- 8. VERIFICAR USUARIOS RECIENTES
-- =====================================================

SELECT 'USUARIOS RECIENTES (últimos 7 días)' as info;

SELECT 
    email,
    created_at
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;

SELECT 'CONFIGURACIÓN COMPLETADA' as final_status; 