-- Migración para corregir las políticas de RLS de assets
-- Fecha: 28/02/2024

-- 1. Eliminar la política temporal y el trigger de diagnóstico
DROP POLICY IF EXISTS "Política temporal para crear assets" ON public.assets;
DROP TRIGGER IF EXISTS log_asset_insert_trigger ON public.assets;

-- 2. Eliminar la función de diagnóstico
DROP FUNCTION IF EXISTS public.log_asset_insert();

-- 3. Restaurar las políticas correctas para assets
-- Política para SELECT: permitir a los usuarios leer sus propios assets o assets públicos
CREATE POLICY "Permitir a los usuarios leer sus propios assets"
ON public.assets
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  is_public = true OR
  EXISTS (
    SELECT 1 FROM public.sites 
    WHERE public.sites.id = public.assets.site_id 
    AND public.sites.user_id = auth.uid()
  )
);

-- Política para INSERT: permitir a los usuarios crear assets en sus propios sitios
CREATE POLICY "Permitir a los usuarios crear assets en sus sitios"
ON public.assets
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.sites 
    WHERE public.sites.id = public.assets.site_id 
    AND public.sites.user_id = auth.uid()
  )
);

-- Política para UPDATE: permitir a los usuarios actualizar sus propios assets
CREATE POLICY "Permitir a los usuarios actualizar sus propios assets"
ON public.assets
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.sites 
    WHERE public.sites.id = public.assets.site_id 
    AND public.sites.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.sites 
    WHERE public.sites.id = public.assets.site_id 
    AND public.sites.user_id = auth.uid()
  )
);

-- Política para DELETE: permitir a los usuarios eliminar sus propios assets
CREATE POLICY "Permitir a los usuarios eliminar sus propios assets"
ON public.assets
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.sites 
    WHERE public.sites.id = public.assets.site_id 
    AND public.sites.user_id = auth.uid()
  )
);

-- 4. Eliminar la tabla de logs de depuración si ya no es necesaria
-- DROP TABLE IF EXISTS public.debug_logs;
-- Comentado para mantener los logs para análisis posterior si es necesario 