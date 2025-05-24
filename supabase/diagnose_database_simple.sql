-- SCRIPT DE DIAGNÓSTICO SIMPLIFICADO PARA SUPABASE
-- Ejecuta cada sección por separado si hay errores

-- 1. Verificar qué tablas existen
SELECT 'TABLAS EXISTENTES:' as info;
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('sites', 'site_members', 'site_ownership', 'profiles')
ORDER BY tablename;

-- 2. Verificar si RLS está habilitado
SELECT 'ESTADO RLS:' as info;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('sites', 'site_members', 'profiles')
ORDER BY tablename;

-- 3. Verificar estructura de site_members
SELECT 'ESTRUCTURA DE SITE_MEMBERS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'site_members'
ORDER BY ordinal_position;

-- 4. Contar registros en tablas principales
SELECT 'CONTEO DE REGISTROS:' as info;
SELECT 'sites' as tabla, count(*) as total FROM public.sites
UNION ALL
SELECT 'site_members' as tabla, count(*) as total FROM public.site_members;

-- 5. Verificar el usuario actual
SELECT 'USUARIO ACTUAL:' as info;
SELECT 
    current_user as db_user,
    current_setting('request.jwt.claims', true)::json->>'sub' as auth_uid;

-- 6. Verificar ownership de sitios
SELECT 'OWNERSHIP DE SITIOS:' as info;
SELECT id as site_id, user_id as owner_id 
FROM public.sites 
LIMIT 3;

-- 7. Verificar site_members existentes
SELECT 'SITE_MEMBERS EXISTENTES:' as info;
SELECT id, site_id, user_id, email, role, status
FROM public.site_members 
LIMIT 5;

-- 8. Intentar inserción de prueba manual
SELECT 'PRUEBA MANUAL DE INSERCIÓN:' as info;
INSERT INTO public.site_members (
    site_id, 
    user_id, 
    email, 
    role, 
    status, 
    added_by
) 
SELECT 
    s.id as site_id,
    NULL as user_id,  
    'test@example.com' as email,
    'collaborator' as role,
    'pending' as status,
    s.user_id as added_by
FROM public.sites s 
LIMIT 1
RETURNING id, email, role; 