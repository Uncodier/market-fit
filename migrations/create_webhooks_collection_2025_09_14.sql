-- ============================================================================
-- Create Webhooks collection (endpoints, subscriptions, deliveries)
-- Date: 2025-09-14
-- Goal:
-- - Register webhook endpoints per site
-- - Optional handshake to verify endpoints
-- - Subscribe endpoints to specific DB event types
-- - Track deliveries/attempts of emitted events to third-party APIs
-- - Apply RLS consistent with site ownership/membership practices
-- ============================================================================

-- Use UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: webhooks_endpoints
-- One row per target endpoint (per site)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhooks_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  target_url text NOT NULL,
  secret text, -- optional signing secret used when sending events
  is_active boolean NOT NULL DEFAULT true,

  -- Handshake/verification (optional)
  handshake_status text DEFAULT 'pending', -- pending | verified | failed | none
  handshake_token text, -- optional token sent to endpoint to verify ownership
  handshake_verified_at timestamptz,
  last_handshake_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.webhooks_endpoints IS 'Webhook endpoints per site (third-party URLs with optional verification).';
COMMENT ON COLUMN public.webhooks_endpoints.handshake_status IS 'pending | verified | failed | none';

-- Basic constraints and indexes
ALTER TABLE public.webhooks_endpoints ADD CONSTRAINT webhooks_endpoints_name_per_site_unique UNIQUE (site_id, name);
CREATE INDEX IF NOT EXISTS idx_webhooks_endpoints_site ON public.webhooks_endpoints(site_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_endpoints_site_active ON public.webhooks_endpoints(site_id, is_active);

-- ============================================================================
-- TABLE: webhooks_subscriptions
-- An endpoint can subscribe to event types emitted by the DB/app
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhooks_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  endpoint_id uuid NOT NULL REFERENCES public.webhooks_endpoints(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- e.g. lead.created, lead.updated, sale.created, workflow.response_received, etc.
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Optional filters as JSON (e.g., segment_id, campaign_id)
  filters jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.webhooks_subscriptions IS 'Subscriptions linking endpoints to event types (with optional filters).';
ALTER TABLE public.webhooks_subscriptions ADD CONSTRAINT webhooks_subscriptions_unique UNIQUE (endpoint_id, event_type);
CREATE INDEX IF NOT EXISTS idx_webhooks_subscriptions_site ON public.webhooks_subscriptions(site_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_subscriptions_endpoint ON public.webhooks_subscriptions(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_subscriptions_event ON public.webhooks_subscriptions(event_type);

-- ============================================================================
-- TABLE: webhooks_deliveries
-- Records each attempt to send an event payload to a subscribed endpoint
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhooks_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  endpoint_id uuid NOT NULL REFERENCES public.webhooks_endpoints(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.webhooks_subscriptions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,

  status text NOT NULL DEFAULT 'pending', -- pending | delivered | failed | retrying
  attempt_count int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  response_status int,
  response_body text,
  last_error text,
  delivered_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.webhooks_deliveries IS 'Delivery attempts and outcomes for webhook events.';
CREATE INDEX IF NOT EXISTS idx_webhooks_deliveries_site ON public.webhooks_deliveries(site_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_deliveries_endpoint ON public.webhooks_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_deliveries_status ON public.webhooks_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_deliveries_event ON public.webhooks_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_webhooks_deliveries_created_at ON public.webhooks_deliveries(created_at);

-- ============================================================================
-- RLS: Enable and create unified policies per table following site membership
-- Notes:
-- - Avoid recursion: check membership via site_members and site_ownership
-- - Use (select auth.uid()) to avoid initplan overhead (per prior fixes)
-- - Service role bypass handled by bypassing RLS at query-time; policies below
--   strictly enforce member/owner access for end-user roles
-- ============================================================================

ALTER TABLE public.webhooks_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks_deliveries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN (
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename IN ('webhooks_endpoints', 'webhooks_subscriptions', 'webhooks_deliveries')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Helper predicate reused in policies (inline using EXISTS)
-- Rule: user is site owner via site_ownership OR active member via site_members

-- webhooks_endpoints unified policy
CREATE POLICY "webhooks_endpoints_unified" ON public.webhooks_endpoints
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.site_ownership so
      WHERE so.site_id = webhooks_endpoints.site_id
        AND so.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.site_members sm
      WHERE sm.site_id = webhooks_endpoints.site_id
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.site_ownership so
      WHERE so.site_id = webhooks_endpoints.site_id
        AND so.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.site_members sm
      WHERE sm.site_id = webhooks_endpoints.site_id
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
    )
  );

-- webhooks_subscriptions unified policy
CREATE POLICY "webhooks_subscriptions_unified" ON public.webhooks_subscriptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.site_ownership so
      WHERE so.site_id = webhooks_subscriptions.site_id
        AND so.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.site_members sm
      WHERE sm.site_id = webhooks_subscriptions.site_id
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.site_ownership so
      WHERE so.site_id = webhooks_subscriptions.site_id
        AND so.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.site_members sm
      WHERE sm.site_id = webhooks_subscriptions.site_id
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
    )
  );

-- webhooks_deliveries unified policy (readable to members, writable by members)
CREATE POLICY "webhooks_deliveries_unified" ON public.webhooks_deliveries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.site_ownership so
      WHERE so.site_id = webhooks_deliveries.site_id
        AND so.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.site_members sm
      WHERE sm.site_id = webhooks_deliveries.site_id
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.site_ownership so
      WHERE so.site_id = webhooks_deliveries.site_id
        AND so.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.site_members sm
      WHERE sm.site_id = webhooks_deliveries.site_id
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
    )
  );

-- ============================================================================
-- OPTIONAL: updated_at automation (only if function exists in environment)
-- If not present, this section is a no-op and can be safely ignored.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_current_timestamp_updated_at'
  ) THEN
    CREATE TRIGGER set_timestamp_webhooks_endpoints
      BEFORE UPDATE ON public.webhooks_endpoints
      FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

    CREATE TRIGGER set_timestamp_webhooks_subscriptions
      BEFORE UPDATE ON public.webhooks_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

    CREATE TRIGGER set_timestamp_webhooks_deliveries
      BEFORE UPDATE ON public.webhooks_deliveries
      FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
  END IF;
END $$;

-- ============================================================================
-- DONE
-- ============================================================================


