-- Provider-owned orders remain native orders; credentials remain native secrets.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.marketplace_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  provider text NOT NULL CHECK (provider IN ('uber_eats', 'rappi')),
  environment text NOT NULL CHECK (environment IN ('production', 'sandbox')),
  country text NOT NULL CHECK (country IN ('AR','BR','CA','CL','CO','CR','EC','MX','PE','US','UY')),
  external_store_id text NOT NULL CHECK (length(external_store_id) BETWEEN 1 AND 200),
  origin_location_id uuid NOT NULL REFERENCES public.locations(id),
  secret_id uuid NOT NULL UNIQUE REFERENCES public.site_secrets(id),
  enabled boolean NOT NULL DEFAULT false,
  manual_ready boolean NOT NULL DEFAULT false,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, environment, external_store_id),
  CHECK (provider <> 'rappi' OR country NOT IN ('CA','US'))
);
ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN marketplace_integration_id uuid REFERENCES public.marketplace_integrations(id),
  ADD COLUMN external_order_id text;
ALTER TABLE public.sale_orders ADD CONSTRAINT sale_orders_marketplace_identity CHECK (
  (marketplace_integration_id IS NULL) = (external_order_id IS NULL)
  AND (external_order_id IS NULL OR length(external_order_id) BETWEEN 1 AND 200)
);
CREATE UNIQUE INDEX sale_orders_marketplace_external_key
  ON public.sale_orders(marketplace_integration_id, external_order_id)
  WHERE marketplace_integration_id IS NOT NULL;
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN marketplace_integration_id uuid REFERENCES public.marketplace_integrations(id),
  ADD COLUMN external_delivery_id text;
CREATE UNIQUE INDEX shipments_marketplace_order_key ON public.shipments(sale_order_id)
  WHERE marketplace_integration_id IS NOT NULL;
CREATE UNIQUE INDEX shipments_marketplace_external_key
  ON public.shipments(marketplace_integration_id, external_delivery_id)
  WHERE external_delivery_id IS NOT NULL;

-- Event receipts contain normalized data only, never full request bodies/headers.
-- The receipt and native import commit together. Failure rolls back both; ingress
-- returns retryable failure. Row locks serialize distinct events for one store.
CREATE TABLE public.marketplace_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.marketplace_integrations(id),
  event_key text NOT NULL CHECK (length(event_key) BETWEEN 1 AND 300),
  event_at timestamptz,
  normalized_payload jsonb NOT NULL CHECK (octet_length(normalized_payload::text) <= 262144),
  status text NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  order_id uuid REFERENCES public.sale_orders(id),
  shipment_id uuid REFERENCES public.shipments(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(integration_id, event_key)
);
CREATE TABLE public.marketplace_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sale_orders(id),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('accept','reject','ready','cancel')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
-- Unknown and abandoned pending actions never auto-reissue provider requests.
CREATE UNIQUE INDEX marketplace_actions_unresolved_order ON public.marketplace_actions(order_id)
  WHERE status IN ('pending','unknown');

ALTER TABLE public.marketplace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_integrations, public.marketplace_events, public.marketplace_actions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.marketplace_integrations TO authenticated;
GRANT ALL ON public.marketplace_integrations, public.marketplace_events, public.marketplace_actions TO service_role;
CREATE POLICY marketplace_config_member_read ON public.marketplace_integrations
  FOR SELECT TO authenticated USING (public.current_user_site_role(site_id) IS NOT NULL);

-- Role comes from PostgreSQL SET ROLE, not user-controlled metadata, current_user
-- inside a definer, or a session_user bypass in an authenticated API transaction.
CREATE FUNCTION public.marketplace_is_backend() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT current_setting('role', true) = 'service_role'
    OR (current_setting('role', true) = 'none' AND session_user = 'postgres')
$$;
REVOKE ALL ON FUNCTION public.marketplace_is_backend() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_is_backend() TO authenticated, service_role;

ALTER TABLE public.site_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_secret_reserved ON public.site_secrets AS RESTRICTIVE
  FOR ALL TO authenticated, anon
  USING (coalesce(use_case, '') NOT LIKE 'marketplace:%'
    AND coalesce(provider, '') NOT IN ('uber_eats','rappi'))
  WITH CHECK (coalesce(use_case, '') NOT LIKE 'marketplace:%'
    AND coalesce(provider, '') NOT IN ('uber_eats','rappi'));

CREATE FUNCTION public.guard_marketplace_native_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE row_data jsonb; protected boolean := false;
BEGIN
  IF public.marketplace_is_backend() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  -- The printer owns only its local bounded acknowledgement. No provider state,
  -- quantities, prices, modifiers or other metadata may change in this exception.
  IF TG_TABLE_NAME = 'sale_order_items' AND TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW)-'metadata') = (to_jsonb(OLD)-'metadata')
      AND (coalesce(to_jsonb(NEW)->'metadata','{}'::jsonb)-'printed_quantity')
        = (coalesce(to_jsonb(OLD)->'metadata','{}'::jsonb)-'printed_quantity')
      AND jsonb_typeof(to_jsonb(NEW)#>'{metadata,printed_quantity}') = 'number'
      AND (to_jsonb(NEW)#>>'{metadata,printed_quantity}')::numeric BETWEEN 0 AND (to_jsonb(NEW)->>'quantity')::numeric
      AND public.user_can((to_jsonb(NEW)->>'site_id')::uuid,'update')
      AND EXISTS (SELECT 1 FROM public.sale_orders WHERE id = (to_jsonb(NEW)->>'sale_order_id')::uuid
        AND marketplace_integration_id IS NOT NULL AND metadata#>>'{marketplace,state}' IN ('accepted','ready','completed')
        AND metadata#>>'{marketplace,sync_status}' = 'confirmed'
        AND coalesce(metadata#>>'{marketplace,operation,status}','confirmed') NOT IN ('pending','unknown')) THEN
      RETURN NEW;
    END IF;
  END IF;
  -- Check both images: unlinking/reparenting must not bypass provider ownership.
  FOR row_data IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE '{}'::jsonb END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE '{}'::jsonb END
  )) LOOP
    protected := protected OR row_data->>'marketplace_integration_id' IS NOT NULL
      OR row_data#>'{metadata,marketplace}' IS NOT NULL
      OR row_data#>'{payment_details,marketplace}' IS NOT NULL;
    IF TG_TABLE_NAME = 'site_secrets' THEN
      protected := protected OR coalesce(row_data->>'use_case','') LIKE 'marketplace:%'
        OR coalesce(row_data->>'provider','') IN ('uber_eats','rappi');
    END IF;
    IF row_data->>'sale_order_id' IS NOT NULL THEN
      protected := protected OR EXISTS (SELECT 1 FROM public.sale_orders
        WHERE id = (row_data->>'sale_order_id')::uuid AND marketplace_integration_id IS NOT NULL);
    END IF;
    IF row_data->>'sale_order_item_id' IS NOT NULL THEN
      protected := protected OR EXISTS (SELECT 1 FROM public.sale_order_items i
        JOIN public.sale_orders o ON o.id = i.sale_order_id
        WHERE i.id = (row_data->>'sale_order_item_id')::uuid AND o.marketplace_integration_id IS NOT NULL);
    END IF;
    IF TG_TABLE_NAME = 'sales' AND row_data->>'id' IS NOT NULL THEN
      protected := protected OR EXISTS (SELECT 1 FROM public.sale_orders
        WHERE sale_id = (row_data->>'id')::uuid AND marketplace_integration_id IS NOT NULL);
    END IF;
    IF row_data->>'shipment_id' IS NOT NULL THEN
      protected := protected OR EXISTS (SELECT 1 FROM public.shipments
        WHERE id = (row_data->>'shipment_id')::uuid AND marketplace_integration_id IS NOT NULL);
    END IF;
  END LOOP;
  IF protected THEN RAISE EXCEPTION 'Marketplace records are provider-owned' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_marketplace_native_write() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['site_secrets','sale_orders','sale_order_items',
    'sale_order_item_units','sales','shipments','shipment_location_pings'] LOOP
    EXECUTE format('CREATE TRIGGER marketplace_native_ownership BEFORE INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_native_write()', table_name);
  END LOOP;
END $$;
COMMIT;