CREATE OR REPLACE FUNCTION public.deduct_credits(p_site_id UUID, p_credits NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits NUMERIC;
  v_current_balance NUMERIC;
  v_credits_to_deduct NUMERIC;
  v_balance_to_deduct NUMERIC;
BEGIN
  -- Select the current credits and balance, and lock the row for update
  SELECT credits_available, account_balance INTO v_current_credits, v_current_balance
  FROM public.billing
  WHERE site_id = p_site_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RAISE EXCEPTION 'Billing record not found for site';
  END IF;

  -- Null safety for balance
  v_current_balance := COALESCE(v_current_balance, 0);

  IF (v_current_credits + v_current_balance) < p_credits THEN
    RAISE EXCEPTION 'Insufficient total usable credits';
  END IF;

  -- First deduct from regular credits
  IF v_current_credits >= p_credits THEN
    v_credits_to_deduct := p_credits;
    v_balance_to_deduct := 0;
  ELSE
    v_credits_to_deduct := v_current_credits;
    v_balance_to_deduct := p_credits - v_current_credits;
  END IF;

  -- Deduct the credits and/or balance
  UPDATE public.billing
  SET credits_available = credits_available - v_credits_to_deduct,
      account_balance = account_balance - v_balance_to_deduct,
      credits_used = COALESCE(credits_used, 0) + p_credits,
      updated_at = NOW()
  WHERE site_id = p_site_id;

  RETURN (v_current_credits - v_credits_to_deduct) + (v_current_balance - v_balance_to_deduct);
END;
$$;
