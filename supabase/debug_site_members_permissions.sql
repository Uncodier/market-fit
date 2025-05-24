-- =====================================================
-- DIAGNÓSTICO Y REPARACIÓN DE PERMISOS SITE_MEMBERS
-- =====================================================

-- 1. VERIFICAR POLÍTICAS ACTUALES
-- =====================================================

SELECT 
    'POLÍTICAS RLS ACTUALES EN site_members' AS resultado,
    '========================================' AS separador;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'site_members' 
ORDER BY policyname;

-- 2. VERIFICAR VISTAS DE ACCESO
-- =====================================================

SELECT 
    'VISTAS DE ACCESO DISPONIBLES' AS resultado,
    '=============================' AS separador;

-- Verificar qué vistas existen
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE viewname LIKE '%site%' 
  AND viewname LIKE '%access%' 
   OR viewname LIKE '%ownership%'
ORDER BY viewname;

-- 3. VERIFICAR ESTRUCTURA DE TABLA
-- =====================================================

SELECT 
    'ESTRUCTURA DE TABLA site_members' AS resultado,
    '=================================' AS separador;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'site_members' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. VERIFICAR CONSTRAINTS
-- =====================================================

SELECT 
    'CONSTRAINTS EN site_members' AS resultado,
    '============================' AS separador;

SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'site_members'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 5. VERIFICAR DATOS DE EJEMPLO
-- =====================================================

SELECT 
    'EJEMPLO DE DATOS ACTUALES' AS resultado,
    '=========================' AS separador;

-- Verificar algunos site_members existentes
SELECT 
    sm.id,
    sm.site_id,
    sm.email,
    sm.role,
    sm.status,
    s.name as site_name,
    s.user_id as site_owner_id
FROM site_members sm
LEFT JOIN sites s ON sm.site_id = s.id
LIMIT 5;

-- 6. CREAR POLÍTICAS CORREGIDAS SI ES NECESARIO
-- =====================================================

-- Eliminar políticas existentes que podrían estar causando problemas
DROP POLICY IF EXISTS "Site owners can view site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can add site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can update site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can delete site members" ON public.site_members;

-- Crear políticas simplificadas que definitivamente funcionan
-- Política SELECT: Los users pueden ver site_members de sus sitios
CREATE POLICY "Allow site owners to view members"
ON public.site_members
FOR SELECT
USING (
  -- El usuario es el owner directo del site
  site_id IN (
    SELECT id FROM public.sites WHERE user_id = auth.uid()
  )
  OR
  -- El usuario es el mismo member
  user_id = auth.uid()
);

-- Política INSERT: Los site owners pueden agregar members
CREATE POLICY "Allow site owners to add members"
ON public.site_members
FOR INSERT
WITH CHECK (
  -- Solo los owners directos del site pueden agregar members
  site_id IN (
    SELECT id FROM public.sites WHERE user_id = auth.uid()
  )
);

-- Política UPDATE: Los site owners pueden actualizar members
CREATE POLICY "Allow site owners to update members"
ON public.site_members
FOR UPDATE
USING (
  -- Solo los owners directos del site pueden actualizar members
  site_id IN (
    SELECT id FROM public.sites WHERE user_id = auth.uid()
  )
);

-- Política DELETE: Los site owners pueden eliminar members
CREATE POLICY "Allow site owners to delete members"
ON public.site_members
FOR DELETE
USING (
  -- Solo los owners directos del site pueden eliminar members
  site_id IN (
    SELECT id FROM public.sites WHERE user_id = auth.uid()
  )
);

-- 7. VERIFICAR RESULTADOS
-- =====================================================

SELECT 
    'POLÍTICAS DESPUÉS DE LA CORRECCIÓN' AS resultado,
    '===================================' AS separador;

SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'site_members' 
ORDER BY policyname;

-- 8. MENSAJE FINAL
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DIAGNÓSTICO Y REPARACIÓN COMPLETADOS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Las políticas han sido simplificadas para asegurar que:';
    RAISE NOTICE '1. Los site owners pueden ver todos los members de sus sites';
    RAISE NOTICE '2. Los site owners pueden agregar nuevos members (pending)';
    RAISE NOTICE '3. Los site owners pueden actualizar members existentes';
    RAISE NOTICE '4. Los site owners pueden eliminar members';
    RAISE NOTICE '';
    RAISE NOTICE 'Ahora intenta agregar un team member de nuevo.';
    RAISE NOTICE '';
END $$; 