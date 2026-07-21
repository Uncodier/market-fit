-- Migration: Catalog Categories, Subscriptions, and Reservations
-- 1. Create catalog_categories
CREATE TABLE IF NOT EXISTS public.catalog_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalog_categories_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_categories_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_site ON public.catalog_categories (site_id);

-- 2. Modify catalog_items to include new fields
ALTER TABLE public.catalog_items 
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_pos_available boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_reservation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_url text;

-- 3. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text, 'expired'::text])),
  start_date timestamp with time zone NOT NULL DEFAULT now(),
  next_billing_date timestamp with time zone,
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT subscriptions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE,
  CONSTRAINT subscriptions_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_site_status ON public.subscriptions (site_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_lead_id ON public.subscriptions (lead_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_catalog_item_id ON public.subscriptions (catalog_item_id);

-- 4. Create reservations table
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'confirmed'::text CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text])),
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reservations_pkey PRIMARY KEY (id),
  CONSTRAINT reservations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT reservations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE,
  CONSTRAINT reservations_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_reservations_site_status ON public.reservations (site_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_lead_id ON public.reservations (lead_id);
CREATE INDEX IF NOT EXISTS idx_reservations_catalog_item_id ON public.reservations (catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_time ON public.reservations (start_time);

-- 5. Enable RLS
ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
DO $$
DECLARE
  table_name TEXT;
  tables_array TEXT[] := ARRAY[
    'catalog_categories', 'subscriptions', 'reservations'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables_array
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%I_unified" ON public.%I', table_name, table_name);
    
    EXECUTE format('
      CREATE POLICY "%I_unified" ON public.%I
      FOR ALL 
      USING (
        current_setting(''role'', true) = ''service_role'' OR
        (auth.jwt() ->> ''role'') = ''service_role'' OR
        (
          EXISTS (
            SELECT 1 FROM public.sites s 
            WHERE s.id = %I.site_id AND (
              s.user_id = auth.uid() OR
              EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
              )
            )
          )
        )
      );
    ', table_name, table_name, table_name);
  END LOOP;
END $$;
