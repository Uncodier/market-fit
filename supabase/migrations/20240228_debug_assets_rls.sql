-- Migración para diagnosticar y solucionar temporalmente el problema de RLS en assets
-- Fecha: 28/02/2024

-- 1. Primero, vamos a crear una función para verificar si un usuario tiene acceso a un sitio
CREATE OR REPLACE FUNCTION public.user_has_access_to_site(user_id_param UUID, site_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  site_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.sites 
    WHERE id = site_id_param 
    AND user_id = user_id_param
  ) INTO site_exists;
  
  RETURN site_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear una política temporal más permisiva para INSERT
DROP POLICY IF EXISTS "Permitir a los usuarios crear assets en sus sitios" ON public.assets;

CREATE POLICY "Política temporal para crear assets" 
ON public.assets 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 3. Crear una función para registrar intentos de inserción (para diagnóstico)
CREATE OR REPLACE FUNCTION public.log_asset_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear una tabla de logs si no existe
  CREATE TABLE IF NOT EXISTS public.debug_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation TEXT,
    user_id UUID,
    site_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Registrar el intento de inserción
  INSERT INTO public.debug_logs (operation, user_id, site_id, details)
  VALUES (
    'asset_insert',
    NEW.user_id,
    NEW.site_id,
    jsonb_build_object(
      'auth_uid', auth.uid(),
      'has_site_access', public.user_has_access_to_site(NEW.user_id, NEW.site_id),
      'asset_name', NEW.name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear el trigger para el log
DROP TRIGGER IF EXISTS log_asset_insert_trigger ON public.assets;
CREATE TRIGGER log_asset_insert_trigger
BEFORE INSERT ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.log_asset_insert();

-- NOTA: Esta es una solución temporal para diagnóstico.
-- Una vez identificado el problema, deberás restaurar las políticas de seguridad adecuadas. 