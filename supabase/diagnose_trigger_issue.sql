-- =====================================================
-- DIAGNÓSTICO AVANZADO DEL PROBLEMA DEL TRIGGER
-- =====================================================

-- 1. VERIFICAR SI EL TRIGGER EXISTE Y ESTÁ HABILITADO
-- =====================================================

SELECT 'ESTADO DEL TRIGGER' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- 2. VERIFICAR LA FUNCIÓN handle_new_user
-- =====================================================

SELECT 'CONTENIDO DE LA FUNCIÓN' as info;

SELECT 
    proname,
    prosrc as function_body
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 3. VERIFICAR PERMISOS DE LA FUNCIÓN
-- =====================================================

SELECT 'PERMISOS DE LA FUNCIÓN' as info;

SELECT 
    proname,
    proowner::regrole as owner,
    prosecdef as security_definer,
    proacl as permissions
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 4. PROBAR MANUALMENTE LA FUNCIÓN CON EL USUARIO EXISTENTE
-- =====================================================

SELECT 'PROBANDO FUNCIÓN MANUALMENTE' as info;

-- Obtener el usuario que se registró
DO $$
DECLARE
    user_record RECORD;
    test_result TEXT;
BEGIN
    -- Buscar el usuario sergio.prado@me.com
    SELECT id, email, raw_user_meta_data, created_at
    INTO user_record
    FROM auth.users 
    WHERE email = 'sergio.prado@me.com'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF FOUND THEN
        RAISE NOTICE 'Usuario encontrado: % (ID: %)', user_record.email, user_record.id;
        RAISE NOTICE 'Metadatos: %', user_record.raw_user_meta_data;
        RAISE NOTICE 'Código de referido: %', user_record.raw_user_meta_data ->> 'referral_code';
        
        -- Intentar procesar el código manualmente
        BEGIN
            PERFORM register_referral_code_use(
                user_record.raw_user_meta_data ->> 'referral_code', 
                user_record.id
            );
            RAISE NOTICE 'Procesamiento manual exitoso';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error en procesamiento manual: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'Usuario no encontrado';
    END IF;
END $$;

-- 5. VERIFICAR SI SE CREÓ EL PERFIL
-- =====================================================

SELECT 'VERIFICAR PERFIL CREADO' as info;

SELECT 
    id,
    email,
    name,
    created_at
FROM public.profiles 
WHERE email = 'sergio.prado@me.com';

-- 6. VERIFICAR ESTADO ACTUAL DEL CÓDIGO FOUNDER
-- =====================================================

SELECT 'ESTADO DEL CÓDIGO FOUNDER' as info;

SELECT 
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- 7. VERIFICAR USOS DEL CÓDIGO FOUNDER
-- =====================================================

SELECT 'USOS DEL CÓDIGO FOUNDER' as info;

SELECT 
    rcu.id,
    rcu.user_id,
    p.email,
    rcu.used_at
FROM public.referral_code_uses rcu
JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
LEFT JOIN public.profiles p ON rcu.user_id = p.id
WHERE rc.code = 'FOUNDER'
ORDER BY rcu.used_at DESC;

-- 8. VERIFICAR LOGS DEL SISTEMA (si están disponibles)
-- =====================================================

-- Esta consulta puede no funcionar dependiendo de la configuración
SELECT 'INTENTANDO VER LOGS' as info;

-- 9. CREAR FUNCIÓN DE PRUEBA DIRECTA
-- =====================================================

CREATE OR REPLACE FUNCTION test_trigger_directly()
RETURNS TEXT AS $$
DECLARE
    result_text TEXT := '';
    user_id UUID;
    referral_code TEXT := 'FOUNDER';
BEGIN
    -- Buscar el usuario de prueba
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = 'sergio.prado@me.com'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF user_id IS NULL THEN
        RETURN 'ERROR: Usuario no encontrado';
    END IF;
    
    result_text := result_text || 'Usuario encontrado: ' || user_id::TEXT || E'\n';
    
    -- Verificar si ya tiene uso registrado
    IF EXISTS (
        SELECT 1 FROM public.referral_code_uses rcu
        JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
        WHERE rcu.user_id = user_id AND rc.code = referral_code
    ) THEN
        result_text := result_text || 'Ya tiene uso registrado' || E'\n';
    ELSE
        result_text := result_text || 'No tiene uso registrado' || E'\n';
        
        -- Intentar registrar el uso
        BEGIN
            PERFORM register_referral_code_use(referral_code, user_id);
            result_text := result_text || 'Uso registrado exitosamente' || E'\n';
        EXCEPTION WHEN OTHERS THEN
            result_text := result_text || 'Error registrando uso: ' || SQLERRM || E'\n';
        END;
    END IF;
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql;

-- 10. EJECUTAR PRUEBA DIRECTA
-- =====================================================

SELECT 'RESULTADO DE PRUEBA DIRECTA' as info;
SELECT test_trigger_directly() as resultado;

-- 11. VERIFICAR RESULTADO FINAL
-- =====================================================

SELECT 'VERIFICACIÓN FINAL' as info;

SELECT 
    u.email,
    u.raw_user_meta_data ->> 'referral_code' as codigo_enviado,
    rc.code as codigo_usado,
    rcu.used_at,
    CASE 
        WHEN rcu.used_at IS NOT NULL THEN 'PROCESADO'
        ELSE 'NO PROCESADO'
    END as estado
FROM auth.users u
LEFT JOIN public.referral_code_uses rcu ON u.id = rcu.user_id
LEFT JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
WHERE u.email = 'sergio.prado@me.com'
ORDER BY u.created_at DESC
LIMIT 1;

-- 12. LIMPIAR FUNCIÓN DE PRUEBA
-- =====================================================

DROP FUNCTION IF EXISTS test_trigger_directly(); 