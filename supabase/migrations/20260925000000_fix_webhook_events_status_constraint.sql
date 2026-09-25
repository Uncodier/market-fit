BEGIN;

ALTER TABLE public.webhook_events
  DROP CONSTRAINT IF EXISTS webhook_events_status_check;

ALTER TABLE public.webhook_events
  ADD CONSTRAINT webhook_events_status_check CHECK (
    status IN ('processing', 'processed', 'failed', 'skipped')
  ) NOT VALID;

ALTER TABLE public.webhook_events
  VALIDATE CONSTRAINT webhook_events_status_check;

COMMIT;