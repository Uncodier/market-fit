-- =====================================================
-- FUNCIÓN RPC PARA PROCESAR CÓDIGOS DE REFERIDO
-- Maneja la inserción y el incremento de forma atómica
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_referral_code_use(
    p_referral_code_id UUID,
    p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_use_record RECORD;
    v_result JSON;
BEGIN
    -- Insert the referral code use record
    INSERT INTO public.referral_code_uses (referral_code_id, user_id, used_at)
    VALUES (p_referral_code_id, p_user_id, NOW())
    RETURNING * INTO v_use_record;
    
    -- Increment the current_uses counter
    UPDATE public.referral_codes 
    SET current_uses = current_uses + 1
    WHERE id = p_referral_code_id;
    
    -- Return the created record as JSON
    SELECT json_build_object(
        'id', v_use_record.id,
        'referral_code_id', v_use_record.referral_code_id,
        'user_id', v_use_record.user_id,
        'used_at', v_use_record.used_at
    ) INTO v_result;
    
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and re-raise
        RAISE EXCEPTION 'Error processing referral code use: %', SQLERRM;
END;
$$; 