-- =====================================================
-- ELIMINAR TRIGGER DE CÓDIGOS DE REFERIDO
-- Ya no necesitamos el trigger porque manejamos todo en la API
-- =====================================================

-- Eliminar el trigger si existe
DROP TRIGGER IF EXISTS increment_referral_usage_trigger ON public.referral_code_uses;

-- Eliminar la función del trigger si existe
DROP FUNCTION IF EXISTS public.increment_referral_usage();

-- Verificar que se eliminaron correctamente
SELECT 
    'Triggers eliminados correctamente' as status,
    COUNT(*) as remaining_triggers
FROM information_schema.triggers 
WHERE trigger_name = 'increment_referral_usage_trigger';

SELECT 
    'Funciones eliminadas correctamente' as status,
    COUNT(*) as remaining_functions
FROM information_schema.routines 
WHERE routine_name = 'increment_referral_usage' 
AND routine_schema = 'public'; 