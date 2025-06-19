-- =====================================================
-- TEST DE LA NUEVA APROXIMACIÓN SIN TRIGGER
-- Prueba la función RPC que maneja todo desde la API
-- =====================================================

-- Ver estado inicial
SELECT 'ESTADO INICIAL' as momento, code, current_uses, max_uses
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- Obtener IDs necesarios para la prueba
WITH test_data AS (
    SELECT 
        rc.id as referral_code_id,
        u.id as user_id
    FROM public.referral_codes rc, auth.users u
    WHERE rc.code = 'FOUNDER' 
    LIMIT 1
)
SELECT 
    'IDs PARA PRUEBA' as info,
    referral_code_id,
    user_id
FROM test_data;

-- Probar la función RPC
WITH test_data AS (
    SELECT 
        rc.id as referral_code_id,
        u.id as user_id
    FROM public.referral_codes rc, auth.users u
    WHERE rc.code = 'FOUNDER' 
    LIMIT 1
)
SELECT public.process_referral_code_use(
    test_data.referral_code_id,
    test_data.user_id
) as resultado
FROM test_data;

-- Ver estado después de la prueba
SELECT 'DESPUÉS DE RPC' as momento, code, current_uses, max_uses
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- Limpiar datos de prueba
DELETE FROM public.referral_code_uses 
WHERE id = (SELECT id FROM public.referral_code_uses ORDER BY used_at DESC LIMIT 1);

-- Decrementar contador manualmente para limpiar
UPDATE public.referral_codes 
SET current_uses = current_uses - 1
WHERE code = 'FOUNDER' AND current_uses > 0;

-- Ver estado final (debería ser igual al inicial)
SELECT 'ESTADO FINAL' as momento, code, current_uses, max_uses
FROM public.referral_codes 
WHERE code = 'FOUNDER'; 