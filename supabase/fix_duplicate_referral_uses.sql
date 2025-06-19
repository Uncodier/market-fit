-- =====================================================
-- CORRECCIÓN DE CÓDIGOS DE REFERIDO DUPLICADOS
-- =====================================================

-- 1. IDENTIFICAR USUARIOS CON CÓDIGOS DUPLICADOS
-- =====================================================

SELECT 'IDENTIFICANDO USUARIOS CON CÓDIGOS DUPLICADOS' as info;

SELECT 
    u.email,
    COUNT(rcu.id) as total_uses,
    rc.code,
    rc.current_uses as code_current_uses
FROM auth.users u
JOIN public.referral_code_uses rcu ON u.id = rcu.user_id
JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
GROUP BY u.id, u.email, rc.code, rc.current_uses
HAVING COUNT(rcu.id) > 1;

-- 2. VER ESTADO ACTUAL DEL CÓDIGO FOUNDER
-- =====================================================

SELECT 'ESTADO ACTUAL DEL CÓDIGO FOUNDER' as info;

SELECT 
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- 3. ELIMINAR USOS DUPLICADOS (MANTENER SOLO EL PRIMERO)
-- =====================================================

SELECT 'ELIMINANDO USOS DUPLICADOS' as info;

WITH duplicated_uses AS (
    SELECT 
        rcu.id,
        rcu.user_id,
        rc.code,
        ROW_NUMBER() OVER (PARTITION BY rcu.user_id ORDER BY rcu.used_at ASC) as row_num
    FROM public.referral_code_uses rcu
    JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
)
DELETE FROM public.referral_code_uses 
WHERE id IN (
    SELECT id FROM duplicated_uses WHERE row_num > 1
);

-- 4. RECALCULAR EL CONTADOR current_uses PARA TODOS LOS CÓDIGOS
-- =====================================================

SELECT 'RECALCULANDO CONTADORES' as info;

UPDATE public.referral_codes 
SET current_uses = (
    SELECT COUNT(*)
    FROM public.referral_code_uses rcu
    WHERE rcu.referral_code_id = referral_codes.id
);

-- 5. VERIFICAR RESULTADO FINAL
-- =====================================================

SELECT 'VERIFICACIÓN FINAL' as info;

-- Estado de todos los códigos
SELECT 
    'CÓDIGOS ACTUALIZADOS' as tipo,
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
ORDER BY code;

-- Usuarios con códigos (sin duplicados)
SELECT 
    'USUARIOS CON CÓDIGOS' as tipo,
    u.email,
    rc.code,
    rcu.used_at
FROM auth.users u
JOIN public.referral_code_uses rcu ON u.id = rcu.user_id
JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
ORDER BY rcu.used_at DESC;

SELECT 'CORRECCIÓN COMPLETADA' as final_status; 