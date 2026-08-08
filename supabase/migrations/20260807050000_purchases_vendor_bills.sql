-- Vendor Bills (purchases) for site-owned AP

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  vendor_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'completed'::text, 'cancelled'::text])),
  amount numeric NOT NULL DEFAULT 0,
  amount_due numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  accounting_state text NOT NULL DEFAULT 'pending'
    CHECK (accounting_state = ANY (ARRAY['pending'::text, 'posted'::text, 'unpublished'::text])),
  stock_received boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchases_site_id ON public.purchases(site_id);
CREATE INDEX IF NOT EXISTS idx_purchases_vendor_company_id ON public.purchases(vendor_company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_site_accounting_state ON public.purchases(site_id, accounting_state);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_site_id ON public.purchase_items(site_id);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
  tables_array TEXT[] := ARRAY['purchases', 'purchase_items'];
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

-- Allow purchase as journal source
ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;
ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_source_type_check
  CHECK (source_type = ANY (ARRAY['sale'::text, 'expense'::text, 'purchase'::text, 'opening'::text, 'manual'::text]));
