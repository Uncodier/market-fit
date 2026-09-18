BEGIN;

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.webhook_events
  ALTER COLUMN processed_at DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_stripe_event_id_key
  ON public.webhook_events (stripe_event_id);

DROP FUNCTION IF EXISTS public.check_webhook_event_processed(uuid);
DROP FUNCTION IF EXISTS public.mark_webhook_event_processed(uuid);
DROP FUNCTION IF EXISTS public.mark_webhook_event_failed(uuid);
DROP FUNCTION IF EXISTS public.mark_webhook_event_failed(uuid, text);

CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_event_data jsonb,
  p_claim_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event public.webhook_events%ROWTYPE;
  v_inserted integer;
  v_attempt_count integer;
BEGIN
  IF nullif(trim(p_event_id), '') IS NULL
    OR nullif(trim(p_event_type), '') IS NULL
    OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Webhook claim parameters are required';
  END IF;

  INSERT INTO public.webhook_events (
    stripe_event_id,
    event_type,
    status,
    event_data,
    processed_at,
    error_message,
    claim_token,
    claimed_at,
    attempt_count
  )
  VALUES (
    p_event_id,
    p_event_type,
    'processing',
    coalesce(p_event_data, '{}'::jsonb)
      || jsonb_build_object('attempt_count', 1),
    NULL,
    NULL,
    p_claim_token,
    now(),
    1
  )
  ON CONFLICT (stripe_event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 1 THEN
    RETURN jsonb_build_object(
      'outcome', 'claimed',
      'claim_token', p_claim_token,
      'attempt_count', 1,
      'was_retry', false
    );
  END IF;

  SELECT *
  INTO v_event
  FROM public.webhook_events
  WHERE stripe_event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Webhook event disappeared during claim';
  END IF;
  IF v_event.status = 'processed' THEN
    RETURN jsonb_build_object(
      'outcome', 'processed',
      'attempt_count', greatest(v_event.attempt_count, 1),
      'was_retry', true
    );
  END IF;
  IF v_event.status = 'processing'
    AND v_event.claimed_at > now() - interval '10 minutes' THEN
    RETURN jsonb_build_object(
      'outcome', 'in_progress',
      'attempt_count', greatest(v_event.attempt_count, 1),
      'was_retry', true
    );
  END IF;

  v_attempt_count := greatest(v_event.attempt_count, 0) + 1;
  UPDATE public.webhook_events
  SET event_type = p_event_type,
      status = 'processing',
      event_data = coalesce(v_event.event_data, '{}'::jsonb)
        || coalesce(p_event_data, '{}'::jsonb)
        || jsonb_build_object('attempt_count', v_attempt_count),
      processed_at = NULL,
      error_message = NULL,
      claim_token = p_claim_token,
      claimed_at = now(),
      attempt_count = v_attempt_count,
      updated_at = now()
  WHERE id = v_event.id;

  RETURN jsonb_build_object(
    'outcome', 'claimed',
    'claim_token', p_claim_token,
    'attempt_count', v_attempt_count,
    'was_retry', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_stripe_webhook_event(
  p_event_id text,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.webhook_events
  SET status = 'processed',
      processed_at = now(),
      error_message = NULL,
      claim_token = NULL,
      updated_at = now()
  WHERE stripe_event_id = p_event_id
    AND status = 'processing'
    AND claim_token = p_claim_token;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_stripe_webhook_event(
  p_event_id text,
  p_claim_token uuid,
  p_error_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.webhook_events
  SET status = 'failed',
      error_message = left(coalesce(p_error_message, 'Unknown error'), 4000),
      claim_token = NULL,
      updated_at = now()
  WHERE stripe_event_id = p_event_id
    AND status = 'processing'
    AND claim_token = p_claim_token;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events(
  days_old integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.webhook_events
  WHERE created_at < now() - make_interval(days => greatest(days_old, 1))
    AND status = 'processed';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(
  text, text, jsonb, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_stripe_webhook_event(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_stripe_webhook_event(text, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_webhook_events(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(
  text, text, jsonb, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_stripe_webhook_event(text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_stripe_webhook_event(text, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_webhook_events(integer)
  TO service_role;

COMMIT;
