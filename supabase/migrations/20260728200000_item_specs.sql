CREATE TABLE IF NOT EXISTS public.item_spec_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  is_system boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_spec_categories_pkey PRIMARY KEY (id),
  CONSTRAINT item_spec_categories_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT item_spec_categories_site_slug_unique UNIQUE (site_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_item_spec_categories_site ON public.item_spec_categories(site_id);

CREATE TABLE IF NOT EXISTS public.item_specs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL,
  image_url text,
  video_url text,
  address text,
  city text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_specs_pkey PRIMARY KEY (id),
  CONSTRAINT item_specs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT item_specs_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.item_spec_categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_item_specs_site ON public.item_specs(site_id);
CREATE INDEX IF NOT EXISTS idx_item_specs_category ON public.item_specs(category_id);

CREATE TABLE IF NOT EXISTS public.catalog_item_specs (
  catalog_item_id uuid NOT NULL,
  item_spec_id uuid NOT NULL,
  sort_order integer DEFAULT 0,
  CONSTRAINT catalog_item_specs_pkey PRIMARY KEY (catalog_item_id, item_spec_id),
  CONSTRAINT catalog_item_specs_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT catalog_item_specs_spec_id_fkey FOREIGN KEY (item_spec_id) REFERENCES public.item_specs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_catalog_item_specs_item ON public.catalog_item_specs(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_item_specs_spec ON public.catalog_item_specs(item_spec_id);

ALTER TABLE public.item_spec_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_specs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
DECLARE
  table_name TEXT;
  tables_array TEXT[] := ARRAY[
    'item_spec_categories', 'item_specs'
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

DROP POLICY IF EXISTS "catalog_item_specs_unified" ON public.catalog_item_specs;
CREATE POLICY "catalog_item_specs_unified" ON public.catalog_item_specs
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role' OR
    (auth.jwt() ->> 'role') = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.catalog_items ci
      JOIN public.sites s ON s.id = ci.site_id
      WHERE ci.id = catalog_item_specs.catalog_item_id AND (
        s.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.site_members sm 
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
        )
      )
    )
  );
