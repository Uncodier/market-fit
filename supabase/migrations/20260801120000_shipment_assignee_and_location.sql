-- Migration: Add assignee and location tracking to shipments

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_lat numeric,
  ADD COLUMN IF NOT EXISTS last_lng numeric,
  ADD COLUMN IF NOT EXISTS last_located_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_shipments_assigned_to ON public.shipments (site_id, assigned_to);

-- Table: shipment_location_pings
CREATE TABLE IF NOT EXISTS public.shipment_location_pings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  shipment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  accuracy numeric,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shipment_location_pings_pkey PRIMARY KEY (id),
  CONSTRAINT shipment_location_pings_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT shipment_location_pings_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE,
  CONSTRAINT shipment_location_pings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_shipment_location_pings_shipment_time
  ON public.shipment_location_pings (shipment_id, recorded_at DESC);

ALTER TABLE public.shipment_location_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipment_location_pings_unified" ON public.shipment_location_pings;
DROP POLICY IF EXISTS "site_members_select_pings" ON public.shipment_location_pings;
DROP POLICY IF EXISTS "site_members_insert_pings" ON public.shipment_location_pings;

CREATE POLICY "shipment_location_pings_unified" ON public.shipment_location_pings
FOR ALL
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = shipment_location_pings.site_id AND (
        s.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.site_members sm
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
        )
      )
    )
  )
);
