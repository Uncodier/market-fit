-- Migration: Pass and Entitlements for Deferred Booking

-- 1. Extend catalog_items for pass config
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS pass_uses integer,
  ADD COLUMN IF NOT EXISTS pass_validity_days integer;

-- 2. Extend entitlements for usage tracking
ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS uses_total integer,
  ADD COLUMN IF NOT EXISTS uses_remaining integer;

-- 3. Extend reservations to link to entitlements
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS entitlement_id uuid REFERENCES public.entitlements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_entitlement_id ON public.reservations(entitlement_id);

-- 4. Create pass_redeemable_items join table
CREATE TABLE IF NOT EXISTS public.pass_redeemable_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  pass_catalog_item_id uuid NOT NULL,
  reservable_catalog_item_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pass_redeemable_items_pkey PRIMARY KEY (id),
  CONSTRAINT pass_redeemable_items_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT pass_redeemable_items_pass_catalog_item_id_fkey FOREIGN KEY (pass_catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT pass_redeemable_items_reservable_catalog_item_id_fkey FOREIGN KEY (reservable_catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT pass_redeemable_items_unique_pair UNIQUE (pass_catalog_item_id, reservable_catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_pass_redeemable_items_site_id ON public.pass_redeemable_items(site_id);
CREATE INDEX IF NOT EXISTS idx_pass_redeemable_items_pass_id ON public.pass_redeemable_items(pass_catalog_item_id);

-- 5. Enable RLS and Policies for pass_redeemable_items
ALTER TABLE public.pass_redeemable_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pass_redeemable_items_unified" ON public.pass_redeemable_items;
CREATE POLICY "pass_redeemable_items_unified" ON public.pass_redeemable_items
FOR ALL 
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    EXISTS (
      SELECT 1 FROM public.sites s 
      WHERE s.id = pass_redeemable_items.site_id AND (
        s.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
        )
      )
    )
  )
);
