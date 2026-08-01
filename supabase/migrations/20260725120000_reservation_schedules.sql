-- Migration: Reservation Schedules
-- Creates reservation_schedules table and extends reservations table

CREATE TABLE IF NOT EXISTS public.reservation_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  capacity integer NOT NULL DEFAULT 1,
  timezone text NOT NULL,
  days jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reservation_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_schedules_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT reservation_schedules_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT reservation_schedules_catalog_item_id_key UNIQUE (catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_schedules_site_id ON public.reservation_schedules(site_id);
CREATE INDEX IF NOT EXISTS idx_reservation_schedules_catalog_item_id ON public.reservation_schedules(catalog_item_id);

-- Enable RLS
ALTER TABLE public.reservation_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy for reservation_schedules
DROP POLICY IF EXISTS "reservation_schedules_unified" ON public.reservation_schedules;
CREATE POLICY "reservation_schedules_unified" ON public.reservation_schedules
FOR ALL 
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = reservation_schedules.site_id AND (
        s.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
        )
      )
    )
  )
);

-- Extend reservations table
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sale_order_item_id uuid REFERENCES public.sale_order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_catalog_time ON public.reservations(catalog_item_id, start_time, end_time);
