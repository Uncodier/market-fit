-- Add a dedicated column for real money balance (earned from sales)
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS account_balance NUMERIC DEFAULT 0;

-- Update the deduct_credits function to deduct from account_balance instead for payouts
CREATE OR REPLACE FUNCTION public.deduct_balance(p_site_id UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
BEGIN
  SELECT account_balance INTO v_current_balance
  FROM public.billing
  WHERE site_id = p_site_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Billing record not found for site';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.billing
  SET account_balance = account_balance - p_amount,
      updated_at = NOW()
  WHERE site_id = p_site_id;

  RETURN v_current_balance - p_amount;
END;
$$;

-- Create an add_balance function for sales
CREATE OR REPLACE FUNCTION public.add_balance(p_site_id UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
BEGIN
  -- Insert or update the balance safely
  INSERT INTO public.billing (site_id, account_balance)
  VALUES (p_site_id, p_amount)
  ON CONFLICT (site_id)
  DO UPDATE SET 
    account_balance = COALESCE(public.billing.account_balance, 0) + EXCLUDED.account_balance,
    updated_at = NOW()
  RETURNING account_balance INTO v_current_balance;

  RETURN v_current_balance;
END;
$$;
