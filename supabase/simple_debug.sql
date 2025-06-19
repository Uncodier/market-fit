-- =====================================================
-- DEBUG SIMPLE PARA TRIGGER DE REFERRAL CODES
-- =====================================================

-- 1. VERIFICAR TRIGGER (CONSULTA SIMPLE)
-- =====================================================

SELECT 'VERIFICANDO TRIGGER' as info;

SELECT COUNT(*) as trigger_exists
FROM pg_trigger 
WHERE tgname = 'increment_referral_usage_trigger';

-- 2. VERIFICAR FUNCIÓN
-- =====================================================

SELECT 'VERIFICANDO FUNCIÓN' as info;

SELECT COUNT(*) as function_exists
FROM pg_proc 
WHERE proname = 'increment_referral_usage';

-- 3. ESTADO ACTUAL FOUNDER
-- =====================================================

SELECT 'ESTADO FOUNDER' as info;

SELECT 
    code,
    current_uses,
    max_uses
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- 4. RECREAR TRIGGER CON LOGGING
-- =====================================================

SELECT 'RECREANDO TRIGGER CON LOGGING' as info;

-- Función con logging
CREATE OR REPLACE FUNCTION public.increment_referral_usage()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE 'TRIGGER: Incrementando current_uses para referral_code_id = %', NEW.referral_code_id;
    
    UPDATE public.referral_codes 
    SET current_uses = current_uses + 1
    WHERE id = NEW.referral_code_id;
    
    RAISE NOTICE 'TRIGGER: Incremento completado';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger
DROP TRIGGER IF EXISTS increment_referral_usage_trigger ON public.referral_code_uses;

CREATE TRIGGER increment_referral_usage_trigger
    AFTER INSERT ON public.referral_code_uses
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_referral_usage();

-- 5. HACER PRUEBA MANUAL
-- =====================================================

SELECT 'HACIENDO PRUEBA MANUAL' as info;

-- Obtener IDs necesarios
DO $$
DECLARE
    founder_id UUID;
    user_id UUID;
BEGIN
    SELECT id INTO founder_id FROM public.referral_codes WHERE code = 'FOUNDER';
    SELECT id INTO user_id FROM auth.users LIMIT 1;
    
    IF founder_id IS NULL THEN
        RAISE NOTICE 'ERROR: Código FOUNDER no encontrado';
        RETURN;
    END IF;
    
    IF user_id IS NULL THEN
        RAISE NOTICE 'ERROR: No hay usuarios disponibles';
        RETURN;
    END IF;
    
    RAISE NOTICE 'INSERTANDO: founder_id=%, user_id=%', founder_id, user_id;
    
    -- Hacer la inserción
    INSERT INTO public.referral_code_uses (referral_code_id, user_id, used_at)
    VALUES (founder_id, user_id, NOW());
    
    RAISE NOTICE 'INSERCIÓN COMPLETADA';
END $$;

-- 6. VERIFICAR RESULTADO
-- =====================================================

SELECT 'RESULTADO FINAL' as info;

SELECT 
    code,
    current_uses,
    max_uses
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- 7. LIMPIAR DATOS DE PRUEBA
-- =====================================================

DELETE FROM public.referral_code_uses 
WHERE id = (SELECT id FROM public.referral_code_uses ORDER BY used_at DESC LIMIT 1);

UPDATE public.referral_codes 
SET current_uses = current_uses - 1
WHERE code = 'FOUNDER' AND current_uses > 0;

SELECT 'DEBUG COMPLETADO' as final_status; 