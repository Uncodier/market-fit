-- =====================================================
-- CREAR TRIGGER SIMPLE PARA INCREMENTAR current_uses
-- =====================================================

-- 1. CREAR FUNCIÓN PARA INCREMENTAR EL CONTADOR
-- =====================================================

CREATE OR REPLACE FUNCTION public.increment_referral_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.referral_codes 
    SET current_uses = current_uses + 1
    WHERE id = NEW.referral_code_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CREAR EL TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS increment_referral_usage_trigger ON public.referral_code_uses;

CREATE TRIGGER increment_referral_usage_trigger
    AFTER INSERT ON public.referral_code_uses
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_referral_usage();

-- 3. VERIFICAR ESTADO
-- =====================================================

SELECT 'TRIGGER CREADO EXITOSAMENTE' as status;

SELECT 
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
WHERE code = 'FOUNDER';

SELECT 'CONFIGURACIÓN COMPLETADA' as final_status; 