BEGIN;

CREATE TABLE IF NOT EXISTS public.voice_call_deliveries (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  audience_id uuid REFERENCES public.audiences(id) ON DELETE SET NULL,
  zavu_sender_id text NOT NULL,
  zavu_call_id text,
  recipient_phone text NOT NULL,
  status text NOT NULL DEFAULT 'placing',
  placement_attempt_token uuid NOT NULL,
  error_message text,
  duration_seconds integer,
  end_reason text,
  turn_count integer,
  cost numeric(14, 6),
  currency text,
  transcript jsonb,
  provider_created_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT voice_call_deliveries_message_unique UNIQUE (message_id),
  CONSTRAINT voice_call_deliveries_phone_e164
    CHECK (recipient_phone ~ '^\+[1-9][0-9]{6,14}$'),
  CONSTRAINT voice_call_deliveries_status_valid
    CHECK (
      status IN (
        'placing',
        'placement_unknown',
        'queued',
        'initiated',
        'ringing',
        'answered',
        'in_progress',
        'completed',
        'failed',
        'busy',
        'no_answer',
        'canceled',
        'cancelled'
      )
    ),
  CONSTRAINT voice_call_deliveries_duration_nonnegative
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT voice_call_deliveries_turn_count_nonnegative
    CHECK (turn_count IS NULL OR turn_count >= 0),
  CONSTRAINT voice_call_deliveries_cost_nonnegative
    CHECK (cost IS NULL OR cost >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS voice_call_deliveries_zavu_call_unique
  ON public.voice_call_deliveries (zavu_call_id)
  WHERE zavu_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS voice_call_deliveries_site_status_idx
  ON public.voice_call_deliveries (site_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS voice_call_deliveries_audience_idx
  ON public.voice_call_deliveries (audience_id, created_at DESC)
  WHERE audience_id IS NOT NULL;

ALTER TABLE public.voice_call_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.voice_call_deliveries FROM PUBLIC;
REVOKE ALL ON TABLE public.voice_call_deliveries FROM anon;
REVOKE ALL ON TABLE public.voice_call_deliveries FROM authenticated;
GRANT ALL ON TABLE public.voice_call_deliveries TO service_role;

COMMENT ON TABLE public.voice_call_deliveries IS
  'Durable, service-only tracking for outbound Zavu conversational voice calls.';
COMMENT ON COLUMN public.voice_call_deliveries.placement_attempt_token IS
  'Fences one non-idempotent POST /v1/calls attempt; ambiguous outcomes require reconciliation instead of an automatic retry.';

COMMIT;
