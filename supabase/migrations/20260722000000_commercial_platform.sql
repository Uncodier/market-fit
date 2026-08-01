-- Migration: Commercial Platform Completion

-- 1. Extend catalog_items.kind
ALTER TABLE public.catalog_items DROP CONSTRAINT IF EXISTS catalog_items_kind_check;
ALTER TABLE public.catalog_items ADD CONSTRAINT catalog_items_kind_check CHECK (kind = ANY (ARRAY['product'::text, 'service'::text, 'digital_asset'::text]));

-- 2. Add digital_subtype and is_marketplace_listed to catalog_items
ALTER TABLE public.catalog_items 
  ADD COLUMN IF NOT EXISTS digital_subtype text CHECK (digital_subtype = ANY (ARRAY['ticket'::text, 'course'::text, 'file'::text, 'pass'::text, 'license'::text])),
  ADD COLUMN IF NOT EXISTS is_marketplace_listed boolean DEFAULT true;

-- 3. Buyer ownership on commerce docs
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

-- Alter sales.source constraint to support new sources
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_source_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_source_check CHECK (source = ANY (ARRAY['retail'::text, 'online'::text, 'marketplace'::text, 'quote'::text, 'shop'::text, 'pos'::text, 'sales'::text]));

-- 4. Quotations
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  deal_id uuid,
  lead_id uuid NOT NULL,
  buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])),
  valid_until timestamp with time zone,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quotations_pkey PRIMARY KEY (id),
  CONSTRAINT quotations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT quotations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  metadata jsonb,
  CONSTRAINT quotation_items_pkey PRIMARY KEY (id),
  CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE,
  CONSTRAINT quotation_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE RESTRICT
);

-- Deal linkage to accepted quotation
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS accepted_quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;

-- 5. Digital access (Entitlements and Subscription Plan Items)
CREATE TABLE IF NOT EXISTS public.subscription_plan_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  plan_catalog_item_id uuid NOT NULL,
  digital_catalog_item_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plan_items_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_plan_items_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT subscription_plan_items_plan_fkey FOREIGN KEY (plan_catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT subscription_plan_items_digital_fkey FOREIGN KEY (digital_catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['purchase'::text, 'subscription'::text])),
  source_id uuid NOT NULL, -- sale_order_item_id or subscription_id
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'revoked'::text, 'expired'::text, 'used'::text])),
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT entitlements_pkey PRIMARY KEY (id),
  CONSTRAINT entitlements_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT entitlements_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE RESTRICT
);

-- 6. Account and Leads
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_kind text DEFAULT 'standard'::text CHECK (account_kind = ANY (ARRAY['standard'::text, 'client'::text]));

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 7. Enable RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
-- Quotations: Seller site_members + buyer_user_id
CREATE POLICY "quotations_unified" ON public.quotations FOR ALL USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  buyer_user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.sites s 
    WHERE s.id = quotations.site_id AND (
      s.user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = auth.uid())
    )
  )
);

-- Quotation Items: inherit from quotations (simplified here to just check the quotation)
CREATE POLICY "quotation_items_unified" ON public.quotation_items FOR ALL USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.id = quotation_items.quotation_id AND (
      q.buyer_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.sites s WHERE s.id = q.site_id AND (
          s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = auth.uid())
        )
      )
    )
  )
);

-- Subscription Plan Items: Seller site_members can manage, public/buyers can read
CREATE POLICY "subscription_plan_items_unified" ON public.subscription_plan_items FOR ALL USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  EXISTS (
    SELECT 1 FROM public.sites s 
    WHERE s.id = subscription_plan_items.site_id AND (
      s.user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = auth.uid())
    )
  )
);
CREATE POLICY "subscription_plan_items_read" ON public.subscription_plan_items FOR SELECT USING (true);

-- Entitlements: Seller site_members (manage) + buyer_user_id (read/use) + owner_site_id members (read)
CREATE POLICY "entitlements_unified" ON public.entitlements FOR ALL USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  buyer_user_id = auth.uid() OR
  (owner_site_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = owner_site_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = auth.uid())))) OR
  EXISTS (
    SELECT 1 FROM public.sites s 
    WHERE s.id = entitlements.site_id AND (
      s.user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = auth.uid())
    )
  )
);

-- Marketplace catalog item read
CREATE POLICY "catalog_items_marketplace_read" ON public.catalog_items FOR SELECT USING (
  is_marketplace_listed = true AND status = 'active'
);

-- Sales / Sale Orders / Subscriptions / Reservations: update policies to include buyer_user_id and owner_site_id
-- We assume the existing policies cover seller access. We need to add buyer access.
DO $$
DECLARE
  table_name TEXT;
  tables_array TEXT[] := ARRAY['sales', 'sale_orders', 'subscriptions', 'reservations'];
BEGIN
  FOREACH table_name IN ARRAY tables_array
  LOOP
    EXECUTE format('
      CREATE POLICY "%I_buyer_read" ON public.%I FOR SELECT USING (
        buyer_user_id = auth.uid() OR
        (owner_site_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = %I.owner_site_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = auth.uid()))))
      );
    ', table_name, table_name, table_name);
  END LOOP;
END $$;
