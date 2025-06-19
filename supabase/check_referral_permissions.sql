-- =====================================================
-- VERIFICAR PERMISOS DE TABLA referral_code_uses
-- =====================================================

-- 1. VERIFICAR POLÍTICAS RLS DE LA TABLA
-- =====================================================

SELECT 'POLÍTICAS RLS DE referral_code_uses' as info;

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
WHERE tablename = 'referral_code_uses';

-- 2. VERIFICAR SI RLS ESTÁ HABILITADO
-- =====================================================

SELECT 'ESTADO RLS DE LA TABLA' as info;

SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables 
WHERE tablename = 'referral_code_uses';

-- 3. VERIFICAR ESTRUCTURA DE LA TABLA
-- =====================================================

SELECT 'ESTRUCTURA DE LA TABLA referral_code_uses' as info;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'referral_code_uses'
ORDER BY ordinal_position;

-- 4. VERIFICAR TRIGGERS EN LA TABLA
-- =====================================================

SELECT 'TRIGGERS EN referral_code_uses' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgtype,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'referral_code_uses';

-- 5. PROBAR INSERCIÓN MANUAL
-- =====================================================

SELECT 'PROBANDO INSERCIÓN MANUAL' as info;

-- Obtener ID del código FOUNDER
DO $$
DECLARE
    founder_id UUID;
    test_user_id UUID;
BEGIN
    -- Obtener ID del código FOUNDER
    SELECT id INTO founder_id FROM public.referral_codes WHERE code = 'FOUNDER';
    
    IF founder_id IS NULL THEN
        RAISE NOTICE 'Código FOUNDER no encontrado';
        RETURN;
    END IF;
    
    -- Obtener un usuario de prueba
    SELECT id INTO test_user_id FROM auth.users WHERE email = 'sergio.prado@me.com';
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'Usuario de prueba no encontrado';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Código FOUNDER ID: %', founder_id;
    RAISE NOTICE 'Usuario ID: %', test_user_id;
    
    -- Intentar insertar (esto debería fallar si ya existe)
    BEGIN
        INSERT INTO public.referral_code_uses (referral_code_id, user_id, used_at)
        VALUES (founder_id, test_user_id, NOW());
        
        RAISE NOTICE 'Inserción exitosa';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Error en inserción: %', SQLERRM;
    END;
END $$;

SELECT 'VERIFICACIÓN COMPLETADA' as final_status; 