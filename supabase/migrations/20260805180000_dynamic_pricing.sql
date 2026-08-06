-- Dynamic pricing: catalog flag + durable catalog_item ↔ requirement ↔ instance link

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS is_dynamic_price boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_catalog_items_site_dynamic_price
  ON public.catalog_items (site_id, is_dynamic_price)
  WHERE is_dynamic_price = true;

CREATE TABLE IF NOT EXISTS public.catalog_item_requirements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  instance_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalog_item_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_item_requirements_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT catalog_item_requirements_catalog_item_id_fkey
    FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT catalog_item_requirements_requirement_id_fkey
    FOREIGN KEY (requirement_id) REFERENCES public.requirements(id) ON DELETE RESTRICT,
  CONSTRAINT catalog_item_requirements_instance_id_fkey
    FOREIGN KEY (instance_id) REFERENCES public.remote_instances(id) ON DELETE RESTRICT,
  CONSTRAINT catalog_item_requirements_catalog_item_id_key UNIQUE (catalog_item_id),
  CONSTRAINT catalog_item_requirements_requirement_id_key UNIQUE (requirement_id),
  CONSTRAINT catalog_item_requirements_instance_id_key UNIQUE (instance_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_item_requirements_site
  ON public.catalog_item_requirements (site_id);
CREATE INDEX IF NOT EXISTS idx_catalog_item_requirements_requirement
  ON public.catalog_item_requirements (requirement_id);
CREATE INDEX IF NOT EXISTS idx_catalog_item_requirements_instance
  ON public.catalog_item_requirements (instance_id);

ALTER TABLE public.catalog_item_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_item_requirements_unified" ON public.catalog_item_requirements;
CREATE POLICY "catalog_item_requirements_unified" ON public.catalog_item_requirements
FOR ALL
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = catalog_item_requirements.site_id AND (
      s.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
      )
    )
  )
);

-- Buyers / public shop can read the link for dynamic-priced listed items (instance/requirement ids only)
DROP POLICY IF EXISTS "catalog_item_requirements_select_listed" ON public.catalog_item_requirements;
CREATE POLICY "catalog_item_requirements_select_listed" ON public.catalog_item_requirements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.catalog_items ci
    WHERE ci.id = catalog_item_requirements.catalog_item_id
      AND ci.is_dynamic_price = true
      AND ci.status = 'active'
  )
);
