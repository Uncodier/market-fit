BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.pos_checkout_attempts
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by uuid,
  ADD COLUMN cancelled_reason text,
  ADD CONSTRAINT pos_checkout_cancellation_audit CHECK (
    (cancelled_at IS NULL AND cancelled_by IS NULL AND cancelled_reason IS NULL)
    OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancelled_reason IS NOT NULL
      AND state = 'rejected' AND cancelled_by = actor_id
      AND length(cancelled_reason) BETWEEN 1 AND 500 AND cancelled_reason ~ '[^[:space:]]')
  );

CREATE FUNCTION public.pos_checkout_cancel(
  p_site_id uuid, p_mutation_id text, p_actor_id uuid, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE attempt public.pos_checkout_attempts%ROWTYPE;
  previous_claims text; previous_role text; previous_sub text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server checkout cancellation required' USING ERRCODE = '42501';
  END IF;
  IF p_site_id IS NULL OR p_actor_id IS NULL OR p_mutation_id IS NULL
    OR length(p_mutation_id) NOT BETWEEN 1 AND 128 OR p_reason IS NULL
    OR length(p_reason) NOT BETWEEN 1 AND 500 OR p_reason !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Invalid checkout cancellation request' USING ERRCODE = '22023';
  END IF;

  -- Serialize with admission, including an admission transaction not yet visible.
  -- Never create a missing attempt: legacy writes may exist without this evidence.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_mutation_id,0));
  SELECT * INTO attempt FROM public.pos_checkout_attempts
    WHERE site_id=p_site_id AND client_mutation_id=p_mutation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('state','not_found'); END IF;
  IF attempt.actor_id IS DISTINCT FROM p_actor_id THEN
    RETURN jsonb_build_object('state','identity_conflict');
  END IF;

  -- Recheck the trusted actor's current role, license and location permissions.
  -- Restore the service JWT before returning; exceptions roll back local settings.
  previous_claims := current_setting('request.jwt.claims',true);
  previous_role := current_setting('request.jwt.claim.role',true);
  previous_sub := current_setting('request.jwt.claim.sub',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_id,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub',p_actor_id::text,true);
  PERFORM public.pos_register_authorize(p_site_id,p_actor_id);
  IF public.current_user_has_site_location_restrictions(p_site_id) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Unrestricted checkout access required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('request.jwt.claims',coalesce(previous_claims,''),true);
  PERFORM set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
  PERFORM set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);

  -- This row lock is also held by transition/commit. If writes won, do nothing.
  IF attempt.state NOT IN ('processing','rejected') THEN
    RETURN jsonb_build_object('state',attempt.state);
  END IF;
  IF (attempt.order_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.sale_orders WHERE id=attempt.order_id AND site_id=p_site_id))
    OR (attempt.requested_order_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.sale_orders WHERE id=attempt.requested_order_id AND site_id=p_site_id))
    OR (attempt.sale_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.sales WHERE id=attempt.sale_id AND site_id=p_site_id)) THEN
    RETURN jsonb_build_object('state','identity_conflict');
  END IF;
  IF attempt.cancelled_at IS NULL THEN
    UPDATE public.pos_checkout_attempts SET state='rejected',owner_token=gen_random_uuid(),
      cancelled_at=clock_timestamp(),cancelled_by=p_actor_id,cancelled_reason=p_reason,
      updated_at=clock_timestamp()
      WHERE site_id=p_site_id AND client_mutation_id=p_mutation_id;
  END IF;
  -- First reason, timestamps, result evidence and rotated token survive every retry.
  RETURN jsonb_build_object('state','rejected','orderId',attempt.order_id,'saleId',attempt.sale_id);
END;
$$;

REVOKE ALL ON FUNCTION public.pos_checkout_cancel(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_checkout_cancel(uuid,text,uuid,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;