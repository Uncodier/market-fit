-- =====================================================
-- VERIFICACIONES RÁPIDAS DEL SISTEMA DE REFERRAL CODES
-- =====================================================

-- 1. Verificar si las tablas existen
SELECT 
    'referral_codes' as tabla,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_codes') 
         THEN '✅ Existe' 
         ELSE '❌ No existe' 
    END as estado
UNION ALL
SELECT 
    'referral_code_uses' as tabla,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_code_uses') 
         THEN '✅ Existe' 
         ELSE '❌ No existe' 
    END as estado;

-- 2. Ver códigos de referido disponibles
SELECT 'CÓDIGOS DISPONIBLES:' as info;
SELECT code, description, is_active, current_uses, max_uses 
FROM public.referral_codes 
ORDER BY code;

-- 3. Ver usos registrados
SELECT 'USOS REGISTRADOS:' as info;
SELECT 
    rc.code, 
    p.email, 
    p.name, 
    rcu.used_at 
FROM public.referral_code_uses rcu
JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
LEFT JOIN public.profiles p ON rcu.user_id = p.id
ORDER BY rcu.used_at DESC;

-- 4. Verificar funciones importantes
SELECT 
    'validate_referral_code' as funcion,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_referral_code') 
         THEN '✅ Existe' 
         ELSE '❌ No existe' 
    END as estado
UNION ALL
SELECT 
    'register_referral_code_use' as funcion,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_referral_code_use') 
         THEN '✅ Existe' 
         ELSE '❌ No existe' 
    END as estado;

-- 5. Probar validación de código
SELECT 'PRUEBA DE VALIDACIÓN:' as info;
SELECT 
    'WELCOME2024' as codigo,
    validate_referral_code('WELCOME2024') as es_valido;

-- 6. Ver usuarios recientes y sus metadatos
SELECT 'USUARIOS RECIENTES:' as info;
SELECT 
    email,
    raw_user_meta_data->>'name' as nombre,
    raw_user_meta_data->>'referral_code' as codigo_referido,
    created_at
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10; 