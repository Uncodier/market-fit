-- =====================================================
-- CREAR TRIGGER PARA INCREMENTAR current_uses
-- =====================================================

-- 1. CREAR FUNCIÓN PARA INCREMENTAR EL CONTADOR
-- =====================================================

CREATE OR REPLACE FUNCTION public.increment_referral_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Incrementar el contador current_uses del código de referido
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

-- 3. VERIFICAR QUE EL TRIGGER SE CREÓ CORRECTAMENTE
-- =====================================================

SELECT 'VERIFICANDO TRIGGER CREADO' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'increment_referral_usage_trigger';

-- 4. ESTADO ACTUAL DEL CÓDIGO FOUNDER ANTES DE LA PRUEBA
-- =====================================================

SELECT 'ESTADO ANTES DE PRUEBA' as info;

SELECT 
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- 5. PROBAR EL TRIGGER CON UNA INSERCIÓN DE PRUEBA
-- =====================================================

SELECT 'PROBANDO TRIGGER' as info;

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
    
    -- Obtener un usuario real existente para la prueba
    SELECT id INTO test_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'No hay usuarios disponibles para la prueba';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Insertando uso de prueba con usuario real: %', test_user_id;
    
    -- Insertar uso de prueba
    INSERT INTO public.referral_code_uses (referral_code_id, user_id, used_at)
    VALUES (founder_id, test_user_id, NOW());
    
    RAISE NOTICE 'Inserción de prueba completada';
END $$;

-- 6. VERIFICAR QUE EL CONTADOR SE INCREMENTÓ
-- =====================================================

SELECT 'ESTADO DESPUÉS DE PRUEBA' as info;

SELECT 
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
WHERE code = 'FOUNDER';

-- 7. LIMPIAR LA INSERCIÓN DE PRUEBA
-- =====================================================

SELECT 'LIMPIANDO DATOS DE PRUEBA' as info;

-- Eliminar el uso de prueba que acabamos de insertar
DO $$
DECLARE
    founder_id UUID;
    test_user_id UUID;
BEGIN
    -- Obtener IDs
    SELECT id INTO founder_id FROM public.referral_codes WHERE code = 'FOUNDER';
    SELECT id INTO test_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;
    
    -- Eliminar el uso de prueba específico
    DELETE FROM public.referral_code_uses 
    WHERE referral_code_id = founder_id 
    AND user_id = test_user_id
    AND used_at >= NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Datos de prueba eliminados';
END $$;

-- Decrementar el contador manualmente para compensar
UPDATE public.referral_codes 
SET current_uses = current_uses - 1
WHERE code = 'FOUNDER' AND current_uses > 0;

-- 8. ESTADO FINAL
-- =====================================================

SELECT 'ESTADO FINAL' as info;

SELECT 
    code,
    current_uses,
    max_uses,
    is_active
FROM public.referral_codes 
WHERE code = 'FOUNDER';

SELECT 'TRIGGER CREADO Y PROBADO EXITOSAMENTE' as final_status; 