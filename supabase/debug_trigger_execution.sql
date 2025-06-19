-- =====================================================
-- DIAGNÓSTICO DEL TRIGGER DE REFERRAL CODES
-- =====================================================

-- 1. VERIFICAR SI EL TRIGGER EXISTE
-- =====================================================

SELECT 'VERIFICANDO TRIGGER' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name
FROM pg_trigger t
WHERE tgname = 'increment_referral_usage_trigger';

-- 2. VERIFICAR LA FUNCIÓN DEL TRIGGER
-- =====================================================

SELECT 'VERIFICANDO FUNCIÓN' as info;

SELECT 
    proname,
    prorettype::regtype as return_type,
    pronargs as num_args
FROM pg_proc 
WHERE proname = 'increment_referral_usage';

-- 3. ESTADO ACTUAL DEL CÓDIGO FOUNDER
-- =====================================================

SELECT 'ESTADO ACTUAL FOUNDER' as info;

SELECT 
    id,
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- 4. CONTAR USOS REALES EN LA TABLA
-- =====================================================

SELECT 'USOS REALES EN TABLA' as info;

SELECT COUNT(*) as total_usos
FROM public.referral_code_uses rcu
JOIN public.referral_codes rc ON rcu.referral_code_id = rc.id
WHERE rc.code = 'FOUNDER';

-- 5. CREAR FUNCIÓN CON LOGGING PARA DEBUG
-- =====================================================

SELECT 'CREANDO FUNCIÓN CON DEBUG' as info;

CREATE OR REPLACE FUNCTION public.increment_referral_usage_debug()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE 'TRIGGER EJECUTADO: referral_code_id = %', NEW.referral_code_id;
    RAISE NOTICE 'TRIGGER EJECUTADO: user_id = %', NEW.user_id;
    
    UPDATE public.referral_codes 
    SET current_uses = current_uses + 1
    WHERE id = NEW.referral_code_id;
    
    RAISE NOTICE 'TRIGGER: UPDATE ejecutado para referral_code_id = %', NEW.referral_code_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. REEMPLAZAR EL TRIGGER CON LA VERSIÓN DEBUG
-- =====================================================

DROP TRIGGER IF EXISTS increment_referral_usage_trigger ON public.referral_code_uses;

CREATE TRIGGER increment_referral_usage_trigger
    AFTER INSERT ON public.referral_code_uses
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_referral_usage_debug();

-- 7. PROBAR CON UNA INSERCIÓN MANUAL
-- =====================================================

SELECT 'PROBANDO INSERCIÓN MANUAL' as info;

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
    
    -- Obtener un usuario existente
    SELECT id INTO test_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'No hay usuarios disponibles';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Insertando con founder_id: % y user_id: %', founder_id, test_user_id;
    
    -- Insertar y ver si el trigger se ejecuta
    INSERT INTO public.referral_code_uses (referral_code_id, user_id, used_at)
    VALUES (founder_id, test_user_id, NOW());
    
    RAISE NOTICE 'Inserción completada';
END $$;

-- 8. VERIFICAR RESULTADO
-- =====================================================

SELECT 'RESULTADO DESPUÉS DE INSERCIÓN' as info;

SELECT 
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- 9. LIMPIAR LA INSERCIÓN DE PRUEBA
-- =====================================================

SELECT 'LIMPIANDO INSERCIÓN DE PRUEBA' as info;

DELETE FROM public.referral_code_uses 
WHERE id = (SELECT id FROM public.referral_code_uses ORDER BY used_at DESC LIMIT 1);

-- Ajustar el contador manualmente
UPDATE public.referral_codes 
SET current_uses = current_uses - 1
WHERE code = 'FOUNDER' AND current_uses > 0;

SELECT 'DEBUG COMPLETADO' as final_status; 