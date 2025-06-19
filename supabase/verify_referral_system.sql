-- =====================================================
-- SCRIPT DE VERIFICACIÓN DEL SISTEMA DE REFERRAL CODES
-- =====================================================

-- 1. VERIFICAR QUE LAS TABLAS EXISTAN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== VERIFICACIÓN DE TABLAS ===';
    
    -- Verificar tabla referral_codes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_codes') THEN
        RAISE NOTICE '✅ Tabla referral_codes existe';
    ELSE
        RAISE NOTICE '❌ Tabla referral_codes NO existe';
    END IF;
    
    -- Verificar tabla referral_code_uses
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_code_uses') THEN
        RAISE NOTICE '✅ Tabla referral_code_uses existe';
    ELSE
        RAISE NOTICE '❌ Tabla referral_code_uses NO existe';
    END IF;
END $$;

-- 2. VERIFICAR QUE LAS FUNCIONES EXISTAN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== VERIFICACIÓN DE FUNCIONES ===';
    
    -- Verificar función validate_referral_code
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_referral_code') THEN
        RAISE NOTICE '✅ Función validate_referral_code existe';
    ELSE
        RAISE NOTICE '❌ Función validate_referral_code NO existe';
    END IF;
    
    -- Verificar función register_referral_code_use
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_referral_code_use') THEN
        RAISE NOTICE '✅ Función register_referral_code_use existe';
    ELSE
        RAISE NOTICE '❌ Función register_referral_code_use NO existe';
    END IF;
    
    -- Verificar función handle_new_user
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
        RAISE NOTICE '✅ Función handle_new_user existe';
    ELSE
        RAISE NOTICE '❌ Función handle_new_user NO existe';
    END IF;
END $$;

-- 3. MOSTRAR CÓDIGOS DE REFERIDO EXISTENTES
-- =====================================================

SELECT 
    '=== CÓDIGOS DE REFERIDO EXISTENTES ===' AS info;

SELECT 
    id,
    code,
    description,
    is_active,
    max_uses,
    current_uses,
    expires_at,
    created_at
FROM public.referral_codes
ORDER BY created_at DESC;

-- 4. MOSTRAR USOS DE CÓDIGOS DE REFERIDO
-- =====================================================

SELECT 
    '=== USOS DE CÓDIGOS DE REFERIDO ===' AS info;

SELECT 
    rcu.id,
    rc.code,
    rcu.user_id,
    p.email as user_email,
    p.name as user_name,
    rcu.used_at
FROM public.referral_code_uses rcu
JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
LEFT JOIN public.profiles p ON rcu.user_id = p.id
ORDER BY rcu.used_at DESC;

-- 5. PROBAR LA FUNCIÓN DE VALIDACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== PRUEBAS DE VALIDACIÓN ===';
    
    -- Probar código válido
    IF validate_referral_code('WELCOME2024') THEN
        RAISE NOTICE '✅ Código WELCOME2024 es válido';
    ELSE
        RAISE NOTICE '❌ Código WELCOME2024 es inválido';
    END IF;
    
    -- Probar código inválido
    IF validate_referral_code('INVALID123') THEN
        RAISE NOTICE '❌ Código INVALID123 es válido (ERROR)';
    ELSE
        RAISE NOTICE '✅ Código INVALID123 es inválido (correcto)';
    END IF;
END $$;

-- 6. VERIFICAR TRIGGER EN AUTH.USERS
-- =====================================================

SELECT 
    '=== VERIFICACIÓN DE TRIGGER ===' AS info;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 7. SIMULAR CREACIÓN DE USUARIO CON CÓDIGO DE REFERIDO
-- =====================================================

-- NOTA: Esta sección es solo para mostrar cómo se vería el proceso
-- NO ejecutar en producción

/*
-- Ejemplo de inserción que simula el trigger de Supabase Auth:
INSERT INTO auth.users (
    id, 
    email, 
    raw_user_meta_data,
    created_at,
    updated_at,
    email_confirmed_at,
    aud,
    role
) VALUES (
    gen_random_uuid(),
    'test@example.com',
    '{"name": "Test User", "referral_code": "WELCOME2024"}'::jsonb,
    NOW(),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated'
);
*/

-- 8. CONSULTA PARA VER USUARIOS RECIENTES Y SUS REFERRAL CODES
-- =====================================================

SELECT 
    '=== USUARIOS RECIENTES Y CÓDIGOS USADOS ===' AS info;

SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'name' as name,
    u.raw_user_meta_data->>'referral_code' as referral_code_in_metadata,
    u.created_at,
    rcu.id as referral_use_id,
    rc.code as used_referral_code,
    rcu.used_at
FROM auth.users u
LEFT JOIN public.referral_code_uses rcu ON u.id = rcu.user_id
LEFT JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
WHERE u.created_at > NOW() - INTERVAL '1 day'
ORDER BY u.created_at DESC;

-- 9. FUNCIÓN PARA PROBAR MANUALMENTE EL REGISTRO DE CÓDIGO
-- =====================================================

CREATE OR REPLACE FUNCTION test_referral_registration(
    test_email TEXT,
    test_name TEXT,
    test_referral_code TEXT
)
RETURNS TEXT AS $$
DECLARE
    test_user_id UUID;
    registration_result BOOLEAN;
BEGIN
    -- Generar un ID de usuario de prueba
    test_user_id := gen_random_uuid();
    
    -- Intentar registrar el uso del código
    SELECT register_referral_code_use(test_referral_code, test_user_id) INTO registration_result;
    
    IF registration_result THEN
        RETURN 'SUCCESS: Código ' || test_referral_code || ' registrado para usuario ' || test_user_id;
    ELSE
        RETURN 'FAILURE: No se pudo registrar el código ' || test_referral_code;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'ERROR: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar prueba
SELECT test_referral_registration('test@example.com', 'Test User', 'WELCOME2024');

-- 10. VERIFICAR CONTADORES DE USO
-- =====================================================

SELECT 
    '=== CONTADORES DE USO ===' AS info;

SELECT 
    rc.code,
    rc.current_uses as contador_en_tabla,
    COUNT(rcu.id) as usos_reales,
    CASE 
        WHEN rc.current_uses = COUNT(rcu.id) THEN '✅ Coincide'
        ELSE '❌ No coincide'
    END as verificacion
FROM public.referral_codes rc
LEFT JOIN public.referral_code_uses rcu ON rc.id = rcu.referral_code_id
GROUP BY rc.id, rc.code, rc.current_uses
ORDER BY rc.code;

-- 11. LIMPIAR FUNCIÓN DE PRUEBA
-- =====================================================

DROP FUNCTION IF EXISTS test_referral_registration(TEXT, TEXT, TEXT);

-- 12. RESUMEN FINAL
-- =====================================================

DO $$
DECLARE
    total_codes INTEGER;
    total_uses INTEGER;
    active_codes INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_codes FROM public.referral_codes;
    SELECT COUNT(*) INTO total_uses FROM public.referral_code_uses;
    SELECT COUNT(*) INTO active_codes FROM public.referral_codes WHERE is_active = true;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== RESUMEN FINAL ===';
    RAISE NOTICE 'Total códigos de referido: %', total_codes;
    RAISE NOTICE 'Códigos activos: %', active_codes;
    RAISE NOTICE 'Total usos registrados: %', total_uses;
    RAISE NOTICE '';
    
    IF total_codes > 0 AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_referral_code') THEN
        RAISE NOTICE '✅ Sistema de referral codes configurado correctamente';
    ELSE
        RAISE NOTICE '❌ Sistema de referral codes necesita configuración';
    END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN DEL SISTEMA DE REFERRAL CODES
-- =====================================================

-- 1. VERIFICAR QUE EL TRIGGER DE INCREMENTO EXISTE
-- =====================================================

SELECT 'VERIFICANDO TRIGGER DE INCREMENTO' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'increment_referral_usage_trigger';

-- 2. VER EL CONTENIDO DE LA FUNCIÓN DEL TRIGGER
-- =====================================================

SELECT 'CONTENIDO DE LA FUNCIÓN increment_referral_usage' as info;

SELECT 
    proname,
    prosrc as function_body
FROM pg_proc 
WHERE proname = 'increment_referral_usage';

-- 3. ESTADO ACTUAL DEL CÓDIGO FOUNDER
-- =====================================================

SELECT 'ESTADO ACTUAL DEL CÓDIGO FOUNDER' as info;

SELECT 
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- 4. CONTAR USOS REALES EN LA TABLA
-- =====================================================

SELECT 'USOS REALES EN LA TABLA' as info;

SELECT 
    rc.code,
    COUNT(rcu.id) as usos_reales,
    rc.current_uses as contador_tabla
FROM public.referral_codes rc
LEFT JOIN public.referral_code_uses rcu ON rc.id = rcu.referral_code_id
WHERE rc.code = 'FOUNDER'
GROUP BY rc.code, rc.current_uses;

-- 5. VERIFICAR SI HAY USUARIOS DUPLICADOS
-- =====================================================

SELECT 'VERIFICANDO USUARIOS DUPLICADOS' as info;

SELECT 
    u.email,
    COUNT(rcu.id) as total_uses,
    rc.code
FROM auth.users u
JOIN public.referral_code_uses rcu ON u.id = rcu.user_id
JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
WHERE rc.code = 'FOUNDER'
GROUP BY u.id, u.email, rc.code
HAVING COUNT(rcu.id) > 1;

SELECT 'VERIFICACIÓN COMPLETADA' as final_status; 