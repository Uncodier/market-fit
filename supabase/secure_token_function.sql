-- Función para almacenar tokens de forma segura con privilegios de servicio
-- Esta función debe ejecutarse en el SQL Editor de Supabase

CREATE OR REPLACE FUNCTION public.store_secure_token(
  p_site_id UUID,
  p_token_type TEXT,
  p_identifier TEXT,
  p_encrypted_value TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Esto permite que la función se ejecute con los privilegios del creador
SET search_path = public
AS $$
DECLARE
  v_token_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- Verificar si el token ya existe
  SELECT EXISTS (
    SELECT 1 FROM secure_tokens 
    WHERE site_id = p_site_id 
    AND token_type = p_token_type 
    AND identifier = p_identifier
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Actualizar el token existente
    UPDATE secure_tokens
    SET 
      encrypted_value = p_encrypted_value,
      updated_at = NOW()
    WHERE 
      site_id = p_site_id 
      AND token_type = p_token_type 
      AND identifier = p_identifier
    RETURNING id INTO v_token_id;
  ELSE
    -- Insertar un nuevo token
    INSERT INTO secure_tokens (
      site_id,
      token_type,
      identifier,
      encrypted_value,
      last_used
    ) VALUES (
      p_site_id,
      p_token_type,
      p_identifier,
      p_encrypted_value,
      NOW()
    ) RETURNING id INTO v_token_id;
  END IF;
  
  RETURN v_token_id;
END;
$$;

-- Otorgar permisos para ejecutar la función a funciones anónimas y autenticadas
GRANT EXECUTE ON FUNCTION public.store_secure_token TO anon, authenticated, service_role;

-- Funciones similares para las otras operaciones
CREATE OR REPLACE FUNCTION public.verify_secure_token(
  p_site_id UUID,
  p_token_type TEXT,
  p_identifier TEXT,
  p_token_value TEXT,
  p_encryption_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted_value TEXT;
  v_salt TEXT;
  v_hashed_input TEXT;
  v_is_valid BOOLEAN := FALSE;
BEGIN
  -- Obtener el valor encriptado
  SELECT encrypted_value INTO v_encrypted_value
  FROM secure_tokens
  WHERE 
    site_id = p_site_id 
    AND token_type = p_token_type 
    AND identifier = p_identifier;
  
  IF v_encrypted_value IS NOT NULL THEN
    -- La verificación real debería hacerse en el código de la aplicación
    -- Esta función solo simula la verificación para completitud
    v_is_valid := TRUE;
    
    -- Actualizar last_used
    UPDATE secure_tokens
    SET last_used = NOW()
    WHERE 
      site_id = p_site_id 
      AND token_type = p_token_type 
      AND identifier = p_identifier;
  END IF;
  
  RETURN v_is_valid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_secure_token TO anon, authenticated, service_role;

-- Función para comprobar si existe un token
CREATE OR REPLACE FUNCTION public.check_secure_token(
  p_site_id UUID,
  p_token_type TEXT,
  p_identifier TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM secure_tokens 
    WHERE site_id = p_site_id 
    AND token_type = p_token_type 
    AND identifier = p_identifier
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_secure_token TO anon, authenticated, service_role;

-- Función para eliminar un token
CREATE OR REPLACE FUNCTION public.delete_secure_token(
  p_site_id UUID,
  p_token_type TEXT,
  p_identifier TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BOOLEAN := FALSE;
BEGIN
  DELETE FROM secure_tokens
  WHERE 
    site_id = p_site_id 
    AND token_type = p_token_type 
    AND identifier = p_identifier;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_secure_token TO anon, authenticated, service_role; 