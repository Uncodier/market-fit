-- =====================================================
-- TEST SIMPLE DEL TRIGGER - TODO EN UNA CONSULTA
-- =====================================================

-- Recrear el trigger primero
CREATE OR REPLACE FUNCTION public.increment_referral_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.referral_codes 
    SET current_uses = current_uses + 1
    WHERE id = NEW.referral_code_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS increment_referral_usage_trigger ON public.referral_code_uses;

CREATE TRIGGER increment_referral_usage_trigger
    AFTER INSERT ON public.referral_code_uses
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_referral_usage();

-- Ahora hacer la prueba y mostrar todo junto
WITH 
estado_antes AS (
    SELECT 'ANTES' as momento, code, current_uses, max_uses
    FROM public.referral_codes 
    WHERE code = 'FOUNDER'
),
insercion AS (
    INSERT INTO public.referral_code_uses (referral_code_id, user_id, used_at)
    SELECT 
        rc.id,
        u.id,
        NOW()
    FROM public.referral_codes rc, auth.users u
    WHERE rc.code = 'FOUNDER' 
    LIMIT 1
    RETURNING referral_code_id, user_id
),
estado_despues AS (
    SELECT 'DESPUÉS' as momento, code, current_uses, max_uses
    FROM public.referral_codes 
    WHERE code = 'FOUNDER'
),
limpieza AS (
    DELETE FROM public.referral_code_uses 
    WHERE id = (SELECT id FROM public.referral_code_uses ORDER BY used_at DESC LIMIT 1)
    RETURNING id
),
ajuste AS (
    UPDATE public.referral_codes 
    SET current_uses = current_uses - 1
    WHERE code = 'FOUNDER' AND current_uses > 0
    RETURNING code, current_uses as current_uses_final
)
SELECT * FROM estado_antes
UNION ALL
SELECT * FROM estado_despues
UNION ALL
SELECT 'FINAL' as momento, ajuste.code, current_uses_final as current_uses, public.referral_codes.max_uses
FROM ajuste, public.referral_codes 
WHERE public.referral_codes.code = 'FOUNDER' AND ajuste.code = public.referral_codes.code; 