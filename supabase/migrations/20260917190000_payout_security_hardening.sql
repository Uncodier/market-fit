-- Close direct Data API access to payout mutations and make balance changes atomic.

CREATE TABLE IF NOT EXISTS public.platform_user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'finance_admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_user_roles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.current_user_platform_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pur.role
  FROM public.platform_user_roles pur
  WHERE pur.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_platform_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_platform_role() TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view payout_requests for their sites"
  ON public.payout_requests;
DROP POLICY IF EXISTS "Users can insert payout_requests for their sites"
  ON public.payout_requests;
DROP POLICY IF EXISTS "Users can update their pending payout_requests"
  ON public.payout_requests;

CREATE POLICY "Site managers can view payout requests"
ON public.payout_requests
FOR SELECT
TO authenticated
USING (public.current_user_site_role(site_id) IN ('owner', 'admin'));

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.payout_requests
  FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.payout_requests
  FROM authenticated;
GRANT SELECT ON TABLE public.payout_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payout_requests TO service_role;

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.deduct_balance(
  p_site_id uuid,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  UPDATE public.billing
  SET account_balance = account_balance - p_amount,
      updated_at = now()
  WHERE site_id = p_site_id
    AND coalesce(account_balance, 0) >= p_amount
  RETURNING account_balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing record not found or insufficient balance';
  END IF;

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_balance(
  p_site_id uuid,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  INSERT INTO public.billing (site_id, account_balance)
  VALUES (p_site_id, p_amount)
  ON CONFLICT (site_id)
  DO UPDATE SET
    account_balance = coalesce(public.billing.account_balance, 0) + EXCLUDED.account_balance,
    updated_at = now()
  RETURNING account_balance INTO v_balance;

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_balance(uuid, numeric)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_balance(uuid, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_balance(uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.create_payout_request(
  p_site_id uuid,
  p_requested_credits numeric,
  p_bank_details jsonb,
  p_requested_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.payout_requests;
BEGIN
  IF p_requested_credits IS NULL OR p_requested_credits <= 0 THEN
    RAISE EXCEPTION 'Requested credits must be greater than zero';
  END IF;
  IF p_bank_details IS NULL OR jsonb_typeof(p_bank_details) <> 'object' THEN
    RAISE EXCEPTION 'Bank details must be an object';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1
      FROM public.sites s
      WHERE s.id = p_site_id
        AND s.user_id = p_requested_by
    )
    OR EXISTS (
      SELECT 1
      FROM public.site_ownership so
      WHERE so.site_id = p_site_id
        AND so.user_id = p_requested_by
    )
    OR EXISTS (
      SELECT 1
      FROM public.site_members sm
      WHERE sm.site_id = p_site_id
        AND sm.user_id = p_requested_by
        AND sm.status = 'active'
        AND sm.role IN ('owner', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Requester is not authorized';
  END IF;

  PERFORM public.deduct_balance(p_site_id, p_requested_credits);

  INSERT INTO public.payout_requests (
    site_id,
    requested_credits,
    status,
    bank_details,
    requested_by
  )
  VALUES (
    p_site_id,
    p_requested_credits,
    'pending',
    p_bank_details,
    p_requested_by
  )
  RETURNING * INTO v_request;

  RETURN to_jsonb(v_request);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_payout_request(
  p_payout_id uuid,
  p_status text,
  p_resolved_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.payout_requests;
BEGIN
  IF p_status NOT IN ('completed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid payout status';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.platform_user_roles pur
    WHERE pur.user_id = p_resolved_by
      AND pur.role IN ('super_admin', 'finance_admin')
  ) THEN
    RAISE EXCEPTION 'Resolver is not authorized';
  END IF;

  SELECT *
  INTO v_request
  FROM public.payout_requests
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout not found';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Payout is not pending';
  END IF;

  IF p_status = 'rejected' THEN
    PERFORM public.add_balance(
      v_request.site_id,
      v_request.requested_credits
    );
  END IF;

  UPDATE public.payout_requests
  SET status = p_status,
      resolved_at = now(),
      resolved_by = p_resolved_by
  WHERE id = p_payout_id
    AND status = 'pending'
  RETURNING * INTO v_request;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout is not pending';
  END IF;

  RETURN to_jsonb(v_request);
END;
$$;

REVOKE ALL ON FUNCTION public.create_payout_request(uuid, numeric, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_payout_request(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payout_request(uuid, numeric, jsonb, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_payout_request(uuid, text, uuid)
  TO service_role;
