-- Migration: Catalog, Inventory, Orders, Shipments & Promotions

-- 1. Create enum-like check constraints manually or use text directly

-- 2. catalog_items
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['product'::text, 'service'::text])),
  name text NOT NULL,
  description text,
  sku text,
  cost numeric,
  lowest_sale_price numeric,
  target_sale_price numeric,
  track_inventory boolean DEFAULT false,
  availability_mode text DEFAULT 'manual'::text CHECK (availability_mode = ANY (ARRAY['manual'::text, 'inventory'::text, 'always'::text])),
  availability_status text DEFAULT 'available'::text CHECK (availability_status = ANY (ARRAY['available'::text, 'unavailable'::text, 'sold_out'::text])),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'archived'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalog_items_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_items_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_site_sku ON public.catalog_items (site_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_items_site_kind_status ON public.catalog_items (site_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_catalog_items_site_availability ON public.catalog_items (site_id, availability_status);
CREATE INDEX IF NOT EXISTS idx_catalog_items_site_name ON public.catalog_items (site_id, name);

-- 3. locations
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_site_name ON public.locations (site_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_site_default ON public.locations (site_id) WHERE is_default = true;

-- 4. inventory_levels
CREATE TABLE IF NOT EXISTS public.inventory_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  location_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_levels_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_levels_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT inventory_levels_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT inventory_levels_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE,
  CONSTRAINT uq_inventory_levels_catalog_location UNIQUE (catalog_item_id, location_id)
);

-- 5. price_lists
CREATE TABLE IF NOT EXISTS public.price_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  currency text DEFAULT 'USD'::text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT price_lists_pkey PRIMARY KEY (id),
  CONSTRAINT price_lists_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_lists_site_default ON public.price_lists (site_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_price_lists_site_active ON public.price_lists (site_id, is_active);

-- 6. price_list_items
CREATE TABLE IF NOT EXISTS public.price_list_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  price_list_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  unit_price numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT price_list_items_pkey PRIMARY KEY (id),
  CONSTRAINT price_list_items_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT price_list_items_price_list_id_fkey FOREIGN KEY (price_list_id) REFERENCES public.price_lists(id) ON DELETE CASCADE,
  CONSTRAINT price_list_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT uq_price_list_items_list_catalog UNIQUE (price_list_id, catalog_item_id)
);

-- 7. sale_order_items
CREATE TABLE IF NOT EXISTS public.sale_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_order_id uuid NOT NULL,
  site_id uuid NOT NULL,
  catalog_item_id uuid,
  location_id uuid,
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sale_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT sale_order_items_sale_order_id_fkey FOREIGN KEY (sale_order_id) REFERENCES public.sale_orders(id) ON DELETE CASCADE,
  CONSTRAINT sale_order_items_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT sale_order_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  CONSTRAINT sale_order_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL
);

-- 8. shipments
CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  sale_order_id uuid NOT NULL,
  sale_id uuid,
  lead_id uuid,
  origin_location_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'preparing'::text, 'shipped'::text, 'in_transit'::text, 'delivered'::text, 'cancelled'::text, 'failed'::text])),
  carrier text,
  tracking_number text,
  shipping_address jsonb,
  stock_decremented boolean DEFAULT false,
  estimated_delivery_at timestamp with time zone,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  notes text,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shipments_pkey PRIMARY KEY (id),
  CONSTRAINT shipments_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT shipments_sale_order_id_fkey FOREIGN KEY (sale_order_id) REFERENCES public.sale_orders(id) ON DELETE CASCADE,
  CONSTRAINT shipments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE,
  CONSTRAINT shipments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL,
  CONSTRAINT shipments_origin_location_id_fkey FOREIGN KEY (origin_location_id) REFERENCES public.locations(id),
  CONSTRAINT shipments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_shipments_site_status ON public.shipments (site_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_site_created_at ON public.shipments (site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_sale_order_id ON public.shipments (sale_order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_lead_id ON public.shipments (lead_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON public.shipments (tracking_number) WHERE tracking_number IS NOT NULL;

-- 9. promotions
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  code text,
  discount_type text NOT NULL CHECK (discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])),
  discount_value numeric NOT NULL,
  applies_to text NOT NULL DEFAULT 'all'::text CHECK (applies_to = ANY (ARRAY['all'::text, 'selected_items'::text])),
  min_order_amount numeric,
  usage_limit integer,
  usage_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'expired'::text])),
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT promotions_pkey PRIMARY KEY (id),
  CONSTRAINT promotions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT promotions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
  CONSTRAINT promotions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_promotions_site_status ON public.promotions (site_id, status);
CREATE INDEX IF NOT EXISTS idx_promotions_campaign_id ON public.promotions (campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotions_site_code ON public.promotions (site_id, code) WHERE code IS NOT NULL;

-- 10. promotion_catalog_items
CREATE TABLE IF NOT EXISTS public.promotion_catalog_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  site_id uuid NOT NULL,
  CONSTRAINT promotion_catalog_items_pkey PRIMARY KEY (id),
  CONSTRAINT promotion_catalog_items_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT promotion_catalog_items_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE,
  CONSTRAINT promotion_catalog_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT uq_promotion_catalog_items UNIQUE (promotion_id, catalog_item_id)
);

-- 11. Enable RLS
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_catalog_items ENABLE ROW LEVEL SECURITY;

-- 12. Create Unified RLS Policies
DO $$
DECLARE
  table_name TEXT;
  tables_array TEXT[] := ARRAY[
    'catalog_items', 'locations', 'inventory_levels', 'price_lists', 
    'price_list_items', 'sale_order_items', 'shipments', 'promotions', 
    'promotion_catalog_items'
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

-- 13. Columns on existing tables
ALTER TABLE public.sale_orders ADD COLUMN IF NOT EXISTS promotion_id uuid REFERENCES public.promotions(id) ON DELETE SET NULL;
ALTER TABLE public.sale_orders ADD COLUMN IF NOT EXISTS price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS default_price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS commerce jsonb DEFAULT '{"stock_shortage_policy": "allow", "default_availability_mode": "manual", "decrement_stock_on": "ship"}'::jsonb;

-- 14. Backfill settings.products & services to catalog_items, plus locations and price lists
DO $$
DECLARE
  site_record RECORD;
  item_record jsonb;
  prod_id uuid;
  loc_id uuid;
  plist_id uuid;
  prod_cost numeric;
  prod_lowest numeric;
  prod_target numeric;
BEGIN
  FOR site_record IN 
    SELECT site_id, products, services FROM public.settings
  LOOP
    -- Only proceed if there are products or services
    IF (site_record.products IS NOT NULL AND jsonb_array_length(site_record.products) > 0) OR
       (site_record.services IS NOT NULL AND jsonb_array_length(site_record.services) > 0) THEN
       
      -- Create a default location
      SELECT id INTO loc_id FROM public.locations WHERE site_id = site_record.site_id AND is_default = true LIMIT 1;
      IF loc_id IS NULL THEN
        INSERT INTO public.locations (site_id, name, is_default, is_active)
        VALUES (site_record.site_id, 'Main', true, true)
        RETURNING id INTO loc_id;
      END IF;

      -- Create a default price list
      SELECT id INTO plist_id FROM public.price_lists WHERE site_id = site_record.site_id AND is_default = true LIMIT 1;
      IF plist_id IS NULL THEN
        INSERT INTO public.price_lists (site_id, name, is_default, is_active)
        VALUES (site_record.site_id, 'Standard', true, true)
        RETURNING id INTO plist_id;
      END IF;

      -- Process Products
      IF site_record.products IS NOT NULL AND jsonb_typeof(site_record.products) = 'array' THEN
        FOR item_record IN SELECT * FROM jsonb_array_elements(site_record.products)
        LOOP
          -- Parse safely
          prod_cost := (item_record->>'cost')::numeric;
          prod_lowest := (item_record->>'lowest_sale_price')::numeric;
          prod_target := (item_record->>'target_sale_price')::numeric;

          INSERT INTO public.catalog_items (
            site_id, kind, name, description, cost, lowest_sale_price, target_sale_price,
            track_inventory, availability_mode, availability_status, status
          ) VALUES (
            site_record.site_id,
            'product',
            COALESCE(item_record->>'name', 'Unnamed Product'),
            item_record->>'description',
            prod_cost,
            prod_lowest,
            prod_target,
            false,
            'manual',
            'available',
            'active'
          ) RETURNING id INTO prod_id;

          -- Add to default price list if target_sale_price exists
          IF prod_target IS NOT NULL THEN
            INSERT INTO public.price_list_items (site_id, price_list_id, catalog_item_id, unit_price)
            VALUES (site_record.site_id, plist_id, prod_id, prod_target);
          END IF;
        END LOOP;
      END IF;

      -- Process Services
      IF site_record.services IS NOT NULL AND jsonb_typeof(site_record.services) = 'array' THEN
        FOR item_record IN SELECT * FROM jsonb_array_elements(site_record.services)
        LOOP
          prod_cost := (item_record->>'cost')::numeric;
          prod_lowest := (item_record->>'lowest_sale_price')::numeric;
          prod_target := (item_record->>'target_sale_price')::numeric;

          INSERT INTO public.catalog_items (
            site_id, kind, name, description, cost, lowest_sale_price, target_sale_price,
            track_inventory, availability_mode, availability_status, status
          ) VALUES (
            site_record.site_id,
            'service',
            COALESCE(item_record->>'name', 'Unnamed Service'),
            item_record->>'description',
            prod_cost,
            prod_lowest,
            prod_target,
            false,
            'manual',
            'available',
            'active'
          ) RETURNING id INTO prod_id;

          -- Add to default price list if target_sale_price exists
          IF prod_target IS NOT NULL THEN
            INSERT INTO public.price_list_items (site_id, price_list_id, catalog_item_id, unit_price)
            VALUES (site_record.site_id, plist_id, prod_id, prod_target);
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END $$;
