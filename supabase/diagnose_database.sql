-- SCRIPT DE DIAGNÓSTICO PARA SUPABASE
-- Ejecuta este script completo en la terminal SQL de Supabase

-- 1. Verificar qué tablas existen en el esquema público
SELECT 'TABLAS EXISTENTES:' as info;
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('sites', 'site_members', 'site_ownership', 'profiles', 'site_membership_access')
ORDER BY tablename;

-- 2. Verificar políticas RLS en site_members
SELECT 'POLÍTICAS RLS EN SITE_MEMBERS:' as info;
SELECT 
    pol.polname as policy_name,
    CASE pol.polcmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT' 
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
        ELSE pol.polcmd::text
    END as command,
    pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
JOIN pg_class pc ON pol.polrelid = pc.oid
JOIN pg_namespace pn ON pc.relnamespace = pn.oid
WHERE pn.nspname = 'public' 
  AND pc.relname = 'site_members';

-- 3. Verificar políticas RLS en profiles
SELECT 'POLÍTICAS RLS EN PROFILES:' as info;
SELECT 
    pol.polname as policy_name,
    CASE pol.polcmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT' 
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
        ELSE pol.polcmd::text
    END as command,
    pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
JOIN pg_class pc ON pol.polrelid = pc.oid
JOIN pg_namespace pn ON pc.relnamespace = pn.oid
WHERE pn.nspname = 'public' 
  AND pc.relname = 'profiles';

-- 4. Verificar si RLS está habilitado
SELECT 'ESTADO RLS:' as info;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('sites', 'site_members', 'site_ownership', 'profiles')
ORDER BY tablename;

-- 5. Verificar estructura de site_members
SELECT 'ESTRUCTURA DE SITE_MEMBERS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'site_members'
ORDER BY ordinal_position;

-- 6. Buscar funciones que mencionen site_membership_access
SELECT 'FUNCIONES QUE MENCIONAN TABLAS PROBLEMÁTICAS:' as info;
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    LEFT(pg_get_functiondef(p.oid), 200) as function_definition_preview
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) ILIKE '%site_membership_access%'
   OR pg_get_functiondef(p.oid) ILIKE '%site_members%'
LIMIT 10;

-- 7. Verificar triggers en site_members
SELECT 'TRIGGERS EN SITE_MEMBERS:' as info;
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.action_timing,
    t.action_statement
FROM information_schema.triggers t
WHERE t.event_object_schema = 'public'
  AND t.event_object_table = 'site_members';

-- 8. Verificar datos actuales en site_ownership (si existe)
SELECT 'DATOS EN SITE_OWNERSHIP:' as info;
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'site_ownership') THEN
        RAISE NOTICE 'La tabla site_ownership existe';
        PERFORM * FROM public.site_ownership LIMIT 1;
    ELSE
        RAISE NOTICE 'La tabla site_ownership NO existe';
    END IF;
END $$;

-- 9. Verificar datos actuales en site_members
SELECT 'MUESTRA DE DATOS EN SITE_MEMBERS:' as info;
SELECT count(*) as total_members FROM public.site_members;
SELECT role, status, count(*) 
FROM public.site_members 
GROUP BY role, status 
ORDER BY role, status;

-- 10. Verificar el usuario actual y permisos
SELECT 'USUARIO ACTUAL:' as info;
SELECT 
    current_user as current_user,
    session_user as session_user,
    current_setting('request.jwt.claims', true)::json->>'sub' as auth_uid;

-- 11. Test de inserción simple (para ver qué error específico da)
SELECT 'PRUEBA DE INSERCIÓN:' as info;
DO $$
DECLARE
    test_site_id uuid;
    current_user_id uuid;
BEGIN
    -- Obtener un site_id existente
    SELECT id INTO test_site_id FROM public.sites LIMIT 1;
    
    -- Obtener el user_id actual
    current_user_id := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
    
    IF test_site_id IS NOT NULL AND current_user_id IS NOT NULL THEN
        RAISE NOTICE 'Intentando insertar en site_members con site_id: % y user_id: %', test_site_id, current_user_id;
        
        -- Intentar inserción de prueba
        INSERT INTO public.site_members (
            site_id, 
            user_id, 
            email, 
            role, 
            status, 
            added_by
        ) VALUES (
            test_site_id,
            NULL, -- Simular pending user
            'test@example.com',
            'collaborator',
            'pending',
            current_user_id
        );
        
        RAISE NOTICE 'Inserción exitosa - eliminando registro de prueba';
        DELETE FROM public.site_members WHERE email = 'test@example.com';
        
    ELSE
        RAISE NOTICE 'No se pudo obtener site_id o user_id para la prueba';
        RAISE NOTICE 'test_site_id: %, current_user_id: %', test_site_id, current_user_id;
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error en inserción de prueba: %', SQLERRM;
END $$; 