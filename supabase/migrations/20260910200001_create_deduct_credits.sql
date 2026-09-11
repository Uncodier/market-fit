CREATE OR REPLACE FUNCTION public.deduct_credits(p_site_id UUID, p_credits NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits NUMERIC;
BEGIN
  -- Select the current credits and lock the row for update
  SELECT credits_available INTO v_current_credits
  FROM public.billing
  WHERE site_id = p_site_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RAISE EXCEPTION 'Billing record not found for site';
  END IF;

  IF v_current_credits < p_credits THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Deduct the credits
  UPDATE public.billing
  SET credits_available = credits_available - p_credits,
      credits_used = COALESCE(credits_used, 0) + p_credits,
      updated_at = NOW()
  WHERE site_id = p_site_id;

  RETURN v_current_credits - p_credits;
END;
$$;
