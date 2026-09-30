BEGIN;
SET LOCAL lock_timeout = '5s';

-- Delivery metadata and failure details are backend-only. There are no direct
-- application readers; a NULL site must never mean public authenticated access.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_events_users_policy ON public.webhook_events;
DROP POLICY IF EXISTS webhook_events_service_role_policy ON public.webhook_events;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid = 'public.webhook_events'::regclass) THEN
    RAISE EXCEPTION 'Unexpected webhook_events policies; review schema drift before applying this migration';
  END IF;
END;
$$;
REVOKE ALL ON TABLE public.webhook_events FROM PUBLIC, anon, authenticated;
-- Column grants are independent of table grants; clear them as well.
DO $$
DECLARE columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columns
  FROM pg_catalog.pg_attribute
  WHERE attrelid = 'public.webhook_events'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE ALL (%s) ON TABLE public.webhook_events FROM PUBLIC, anon, authenticated', columns);
END;
$$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.webhook_events TO service_role;
CREATE POLICY webhook_events_service_role_policy ON public.webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Keep the existing delivery protocol and its minimum execution privileges.
REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(text, text, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_stripe_webhook_event(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_stripe_webhook_event(text, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_webhook_events(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(text, text, jsonb, uuid),
  public.complete_stripe_webhook_event(text, uuid),
  public.fail_stripe_webhook_event(text, uuid, text),
  public.cleanup_old_webhook_events(integer) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;