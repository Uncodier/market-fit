-- =====================================================
-- CORRECCIÓN DEL ERROR DE VARIABLE AMBIGUA
-- =====================================================

-- Recrear la función sin ambigüedad en las variables
CREATE OR REPLACE FUNCTION test_trigger_directly()
RETURNS TEXT AS $$
DECLARE
    result_text TEXT := '';
    target_user_id UUID;
    referral_code_param TEXT := 'FOUNDER';
BEGIN
    -- Buscar el usuario de prueba
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'sergio.prado@me.com'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF target_user_id IS NULL THEN
        RETURN 'ERROR: Usuario no encontrado';
    END IF;
    
    result_text := result_text || 'Usuario encontrado: ' || target_user_id::TEXT || E'\n';
    
    -- Verificar si ya tiene uso registrado
    IF EXISTS (
        SELECT 1 FROM public.referral_code_uses rcu
        JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
        WHERE rcu.user_id = target_user_id AND rc.code = referral_code_param
    ) THEN
        result_text := result_text || 'Ya tiene uso registrado' || E'\n';
    ELSE
        result_text := result_text || 'No tiene uso registrado' || E'\n';
        
        -- Intentar registrar el uso
        BEGIN
            PERFORM register_referral_code_use(referral_code_param, target_user_id);
            result_text := result_text || 'Uso registrado exitosamente' || E'\n';
        EXCEPTION WHEN OTHERS THEN
            result_text := result_text || 'Error registrando uso: ' || SQLERRM || E'\n';
        END;
    END IF;
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la función corregida
SELECT 'RESULTADO DE PRUEBA DIRECTA (CORREGIDA)' as info;
SELECT test_trigger_directly() as resultado;

-- Verificar resultado final
SELECT 'VERIFICACIÓN FINAL DESPUÉS DE CORRECCIÓN' as info;

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

-- Verificar el estado del código FOUNDER
SELECT 'ESTADO ACTUAL DEL CÓDIGO FOUNDER' as info;

SELECT 
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- Limpiar función de prueba
DROP FUNCTION IF EXISTS test_trigger_directly(); 