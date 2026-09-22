BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS do_not_call boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_call_consent_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS voice_call_consent_at timestamptz;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_voice_call_consent_status_valid,
  ADD CONSTRAINT leads_voice_call_consent_status_valid
    CHECK (voice_call_consent_status IN ('unknown', 'granted', 'revoked')),
  DROP CONSTRAINT IF EXISTS leads_voice_call_consent_timestamp_valid,
  ADD CONSTRAINT leads_voice_call_consent_timestamp_valid
    CHECK (
      voice_call_consent_status <> 'granted'
      OR voice_call_consent_at IS NOT NULL
    );

CREATE OR REPLACE FUNCTION public.enforce_voice_call_concurrency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  active_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.zavu_sender_id, 0)
  );

  SELECT count(*)
  INTO active_count
  FROM public.voice_call_deliveries
  WHERE zavu_sender_id = NEW.zavu_sender_id
    AND status IN (
      'placing',
      'queued',
      'initiated',
      'ringing',
      'answered',
      'in_progress'
    );

  IF active_count >= 5 THEN
    RAISE EXCEPTION 'VOICE_CALL_CONCURRENCY_LIMIT'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_voice_call_concurrency_before_insert
  ON public.voice_call_deliveries;
CREATE TRIGGER enforce_voice_call_concurrency_before_insert
BEFORE INSERT ON public.voice_call_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_voice_call_concurrency();

COMMENT ON COLUMN public.leads.do_not_call IS
  'When true, all outbound Voice calls to this lead are prohibited.';
COMMENT ON COLUMN public.leads.voice_call_consent_status IS
  'Explicit outbound Voice consent state. Calls require granted consent.';
COMMENT ON COLUMN public.leads.voice_call_consent_at IS
  'Timestamp at which outbound Voice consent was granted.';
COMMENT ON FUNCTION public.enforce_voice_call_concurrency() IS
  'Atomically limits each Zavu sender to five active outbound Voice calls.';

COMMIT;
