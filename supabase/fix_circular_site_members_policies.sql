-- =====================================================
-- CORREGIR PROBLEMA CIRCULAR EN POLÍTICAS SITE_MEMBERS
-- Usar site_ownership para evitar dependencias circulares
-- =====================================================

-- 1. VERIFICAR QUE SITE_OWNERSHIP EXISTE
-- =====================================================

SELECT 
    'VERIFICANDO TABLA SITE_OWNERSHIP' AS resultado,
    '================================' AS separador;

SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'site_ownership' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. VERIFICAR DATOS EN SITE_OWNERSHIP
-- =====================================================

SELECT 
    'CONTENIDO DE SITE_OWNERSHIP' AS resultado,
    '===========================' AS separador;

SELECT 
    so.site_id,
    so.user_id,
    s.name as site_name
FROM site_ownership so
LEFT JOIN sites s ON so.site_id = s.id
LIMIT 5;

-- 3. ELIMINAR POLÍTICAS PROBLEMÁTICAS
-- =====================================================

-- Eliminar las políticas que creamos que causaron el problema circular
DROP POLICY IF EXISTS "Allow site owners to view members" ON public.site_members;
DROP POLICY IF EXISTS "Allow site owners to add members" ON public.site_members;
DROP POLICY IF EXISTS "Allow site owners to update members" ON public.site_members;
DROP POLICY IF EXISTS "Allow site owners to delete members" ON public.site_members;

-- 4. CREAR POLÍTICAS CORRECTAS USANDO SITE_OWNERSHIP
-- =====================================================

-- Política SELECT: Los users pueden ver site_members usando site_ownership
CREATE POLICY "Site owners can view site members"
ON public.site_members
FOR SELECT
USING (
  -- Usar site_ownership para evitar dependencias circulares
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- El usuario puede ver sus propios registros
  user_id = auth.uid()
);

-- Política INSERT: Los site owners pueden agregar members usando site_ownership
CREATE POLICY "Site owners and admins can add site members"
ON public.site_members
FOR INSERT
WITH CHECK (
  -- Usar site_ownership para verificar ownership sin dependencias circulares
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- También permitir a admins existentes agregar nuevos members
  site_id IN (
    SELECT site_id FROM public.site_members 
    WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin') 
      AND status = 'active'
  )
);

-- Política UPDATE: Los site owners pueden actualizar members
CREATE POLICY "Site owners and admins can update site members"
ON public.site_members
FOR UPDATE
USING (
  -- Usar site_ownership para verificar ownership
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- También permitir a admins existentes actualizar members
  site_id IN (
    SELECT site_id FROM public.site_members 
    WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin') 
      AND status = 'active'
  )
);

-- Política DELETE: Los site owners pueden eliminar members
CREATE POLICY "Site owners and admins can delete site members"
ON public.site_members
FOR DELETE
USING (
  -- Usar site_ownership para verificar ownership
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- También permitir a admins existentes eliminar members
  site_id IN (
    SELECT site_id FROM public.site_members 
    WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin') 
      AND status = 'active'
  )
);

-- 5. VERIFICAR POLÍTICAS DE SITES (NO TOCAR SI ESTÁN BIEN)
-- =====================================================

SELECT 
    'POLÍTICAS ACTUALES EN SITES' AS resultado,
    '============================' AS separador;

SELECT 
    policyname,
    cmd,
    LEFT(qual, 100) as policy_condition
FROM pg_policies 
WHERE tablename = 'sites' 
ORDER BY policyname;

-- 6. ASEGURAR QUE SITE_OWNERSHIP ESTÁ SINCRONIZADO
-- =====================================================

-- Sincronizar cualquier site que pueda faltar en site_ownership
INSERT INTO public.site_ownership (site_id, user_id)
SELECT id AS site_id, user_id FROM public.sites
WHERE id NOT IN (SELECT site_id FROM public.site_ownership)
ON CONFLICT (site_id) DO UPDATE SET user_id = EXCLUDED.user_id;

-- 7. VERIFICAR RESULTADOS FINALES
-- =====================================================

SELECT 
    'POLÍTICAS CORREGIDAS EN site_members' AS resultado,
    '====================================' AS separador;

SELECT 
    policyname,
    cmd,
    LEFT(with_check, 100) as with_check_condition
FROM pg_policies 
WHERE tablename = 'site_members' 
ORDER BY policyname;

-- 8. MENSAJE FINAL
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PROBLEMA CIRCULAR CORREGIDO';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Las políticas ahora usan site_ownership para evitar dependencias circulares:';
    RAISE NOTICE '1. site_members políticas usan site_ownership (no sites directamente)';
    RAISE NOTICE '2. sites políticas pueden usar site_members sin problemas';
    RAISE NOTICE '3. site_ownership está sincronizado con sites';
    RAISE NOTICE '';
    RAISE NOTICE 'Ahora deberías poder:';
    RAISE NOTICE '- Ver el sitio normalmente';
    RAISE NOTICE '- Agregar team members sin errores 500';
    RAISE NOTICE '';
END $$; 