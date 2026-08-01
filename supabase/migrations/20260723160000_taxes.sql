-- Migration: Site taxes and catalog item tax associations

CREATE TABLE IF NOT EXISTS public.taxes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0 CHECK (rate >= 0 AND rate <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT taxes_pkey PRIMARY KEY (id),
  CONSTRAINT taxes_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT taxes_site_name_unique UNIQUE (site_id, name)
);

CREATE INDEX IF NOT EXISTS idx_taxes_site_active ON public.taxes (site_id, is_active);

CREATE TABLE IF NOT EXISTS public.catalog_item_taxes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  tax_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalog_item_taxes_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_item_taxes_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT catalog_item_taxes_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT catalog_item_taxes_tax_id_fkey FOREIGN KEY (tax_id) REFERENCES public.taxes(id) ON DELETE CASCADE,
  CONSTRAINT catalog_item_taxes_unique UNIQUE (catalog_item_id, tax_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_item_taxes_item ON public.catalog_item_taxes (catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_item_taxes_tax ON public.catalog_item_taxes (tax_id);
CREATE INDEX IF NOT EXISTS idx_catalog_item_taxes_site ON public.catalog_item_taxes (site_id);

-- Quotations tax total
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS tax_total numeric NOT NULL DEFAULT 0;

ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_taxes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
  tables_array TEXT[] := ARRAY['taxes', 'catalog_item_taxes'];
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

-- Allow reading taxes via RLS to site members
CREATE POLICY "taxes_read_unified" ON public.taxes FOR SELECT USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = taxes.site_id AND (
      s.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "catalog_item_taxes_read_unified" ON public.catalog_item_taxes FOR SELECT USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = catalog_item_taxes.site_id AND (
      s.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
      )
    )
  )
);
