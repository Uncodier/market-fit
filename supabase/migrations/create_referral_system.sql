-- =====================================================
-- SISTEMA DE CÓDIGOS DE REFERIDO (REFERRAL CODES)
-- =====================================================

-- 1. CREAR TABLAS SI NO EXISTEN
-- =====================================================

-- Tabla de códigos de referido
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  max_uses INTEGER, -- NULL = ilimitado
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de usos de códigos de referido
CREATE TABLE IF NOT EXISTS public.referral_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referral_code_id, user_id) -- Un usuario solo puede usar un código una vez
);

-- 2. CREAR ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_is_active ON public.referral_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_referral_codes_expires_at ON public.referral_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_referral_code_uses_referral_code_id ON public.referral_code_uses(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_code_uses_user_id ON public.referral_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_code_uses_used_at ON public.referral_code_uses(used_at);

-- 3. HABILITAR RLS
-- =====================================================

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_code_uses ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE SEGURIDAD
-- =====================================================

-- Políticas para referral_codes
CREATE POLICY "Anyone can view active referral codes" 
  ON public.referral_codes FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Authenticated users can create referral codes" 
  ON public.referral_codes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own referral codes" 
  ON public.referral_codes FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Políticas para referral_code_uses
CREATE POLICY "Users can view their own referral code uses" 
  ON public.referral_code_uses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert referral code uses" 
  ON public.referral_code_uses FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Permitir inserción por triggers

-- 5. FUNCIÓN PARA VALIDAR CÓDIGO DE REFERIDO
-- =====================================================

CREATE OR REPLACE FUNCTION validate_referral_code(code_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  referral_record RECORD;
BEGIN
  -- Buscar el código de referido
  SELECT id, code, is_active, max_uses, current_uses, expires_at
  INTO referral_record
  FROM public.referral_codes
  WHERE code = code_param;
  
  -- Si no existe el código
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar si está activo
  IF NOT referral_record.is_active THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar si ha expirado
  IF referral_record.expires_at IS NOT NULL AND referral_record.expires_at < NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar si ha alcanzado el máximo de usos
  IF referral_record.max_uses IS NOT NULL AND referral_record.current_uses >= referral_record.max_uses THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNCIÓN PARA REGISTRAR EL USO DE UN CÓDIGO DE REFERIDO
-- =====================================================

CREATE OR REPLACE FUNCTION register_referral_code_use(code_param TEXT, user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  referral_record RECORD;
  use_exists BOOLEAN;
BEGIN
  -- Verificar si el código es válido
  IF NOT validate_referral_code(code_param) THEN
    RAISE NOTICE 'Código de referido inválido: %', code_param;
    RETURN FALSE;
  END IF;
  
  -- Obtener el ID del código de referido
  SELECT id INTO referral_record
  FROM public.referral_codes
  WHERE code = code_param;
  
  -- Verificar si el usuario ya usó este código
  SELECT EXISTS(
    SELECT 1 FROM public.referral_code_uses 
    WHERE referral_code_id = referral_record.id AND user_id = user_id_param
  ) INTO use_exists;
  
  IF use_exists THEN
    RAISE NOTICE 'Usuario % ya usó el código %', user_id_param, code_param;
    RETURN FALSE;
  END IF;
  
  -- Registrar el uso
  INSERT INTO public.referral_code_uses (referral_code_id, user_id)
  VALUES (referral_record.id, user_id_param);
  
  -- Incrementar el contador de usos
  UPDATE public.referral_codes
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE id = referral_record.id;
  
  RAISE NOTICE 'Código de referido % usado exitosamente por usuario %', code_param, user_id_param;
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error registrando uso de código de referido: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. MODIFICAR LA FUNCIÓN handle_new_user PARA INCLUIR CÓDIGOS DE REFERIDO
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  referral_code TEXT;
BEGIN
  -- Crear el perfil del usuario
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Verificar si hay un código de referido en los metadatos
  referral_code := NEW.raw_user_meta_data->>'referral_code';
  
  IF referral_code IS NOT NULL AND referral_code != '' THEN
    -- Intentar registrar el uso del código de referido
    PERFORM register_referral_code_use(referral_code, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. TRIGGER PARA ACTUALIZAR updated_at
-- =====================================================

CREATE TRIGGER update_referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. FUNCIONES DE UTILIDAD
-- =====================================================

-- Función para obtener estadísticas de un código de referido
CREATE OR REPLACE FUNCTION get_referral_code_stats(code_param TEXT)
RETURNS TABLE (
  id UUID,
  code TEXT,
  description TEXT,
  is_active BOOLEAN,
  max_uses INTEGER,
  current_uses INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  recent_uses_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id,
    rc.code,
    rc.description,
    rc.is_active,
    rc.max_uses,
    rc.current_uses,
    rc.expires_at,
    rc.created_at,
    (SELECT COUNT(*)::INTEGER 
     FROM public.referral_code_uses rcu 
     WHERE rcu.referral_code_id = rc.id 
     AND rcu.used_at > NOW() - INTERVAL '30 days') AS recent_uses_count
  FROM public.referral_codes rc
  WHERE rc.code = code_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener todos los usos de un código de referido
CREATE OR REPLACE FUNCTION get_referral_code_usage(code_param TEXT)
RETURNS TABLE (
  use_id UUID,
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  used_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rcu.id AS use_id,
    rcu.user_id,
    p.email AS user_email,
    p.name AS user_name,
    rcu.used_at
  FROM public.referral_code_uses rcu
  JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
  LEFT JOIN public.profiles p ON rcu.user_id = p.id
  WHERE rc.code = code_param
  ORDER BY rcu.used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. INSERTAR ALGUNOS CÓDIGOS DE REFERIDO DE PRUEBA
-- =====================================================

-- Insertar códigos de prueba solo si no existen
INSERT INTO public.referral_codes (code, description, max_uses)
VALUES 
  ('WELCOME2024', 'Código de bienvenida para 2024', 1000),
  ('BETA', 'Acceso beta temprano', 500),
  ('FRIEND', 'Código para amigos', NULL),
  ('TEAM10', 'Código para equipos de 10 personas', 100)
ON CONFLICT (code) DO NOTHING;

-- 11. COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE public.referral_codes IS 'Tabla de códigos de referido para el sistema de invitaciones';
COMMENT ON TABLE public.referral_code_uses IS 'Registro de usos de códigos de referido por usuario';
COMMENT ON FUNCTION validate_referral_code(TEXT) IS 'Valida si un código de referido es válido y puede ser usado';
COMMENT ON FUNCTION register_referral_code_use(TEXT, UUID) IS 'Registra el uso de un código de referido por un usuario';
COMMENT ON FUNCTION get_referral_code_stats(TEXT) IS 'Obtiene estadísticas detalladas de un código de referido';
COMMENT ON FUNCTION get_referral_code_usage(TEXT) IS 'Obtiene todos los usos de un código de referido específico';

-- 12. CONCEDER PERMISOS
-- =====================================================

-- Permitir a usuarios autenticados ejecutar las funciones
GRANT EXECUTE ON FUNCTION validate_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_referral_code_stats(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_referral_code_usage(TEXT) TO authenticated;

-- Permitir al sistema ejecutar la función de registro
GRANT EXECUTE ON FUNCTION register_referral_code_use(TEXT, UUID) TO postgres; 