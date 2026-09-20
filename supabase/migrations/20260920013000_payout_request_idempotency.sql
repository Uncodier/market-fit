BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS pos_client_mutations_site_client_mutation_idx
  ON public.pos_client_mutations (site_id, client_mutation_id);

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_site_idempotency_key_idx
  ON public.payout_requests (site_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DROP FUNCTION IF EXISTS public.create_payout_request(uuid, numeric, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.create_payout_request(
  p_site_id uuid,
  p_requested_credits numeric,
  p_bank_details jsonb,
  p_requested_by uuid,
  p_idempotency_key text
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
  IF p_idempotency_key IS NULL
    OR length(p_idempotency_key) < 16
    OR length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'Invalid idempotency key';
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

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_site_id::text || ':' || p_idempotency_key, 0)
  );

  SELECT *
  INTO v_request
  FROM public.payout_requests
  WHERE site_id = p_site_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN to_jsonb(v_request);
  END IF;

  PERFORM public.deduct_balance(p_site_id, p_requested_credits);

  INSERT INTO public.payout_requests (
    site_id,
    requested_credits,
    status,
    bank_details,
    requested_by,
    idempotency_key
  )
  VALUES (
    p_site_id,
    p_requested_credits,
    'pending',
    p_bank_details,
    p_requested_by,
    p_idempotency_key
  )
  RETURNING * INTO v_request;

  RETURN to_jsonb(v_request);
END;
$$;

REVOKE ALL ON FUNCTION public.create_payout_request(
  uuid,
  numeric,
  jsonb,
  uuid,
  text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_payout_request(
  uuid,
  numeric,
  jsonb,
  uuid,
  text
) TO service_role;

COMMIT;
