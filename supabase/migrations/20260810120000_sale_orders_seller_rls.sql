-- Fix: Pedidos (/orders) and POS pending orders returned empty for site members.
-- sale_orders only had buyer_read (buyer_user_id / owner_site_id) and never a
-- seller unified policy on site_id. POS also creates/reads sales + leads with the
-- user-scoped client (source: "pos"), so ensure those have seller unified policies
-- (previously only in ops scripts, not migrations).

ALTER TABLE public.sale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
  tables_array TEXT[] := ARRAY['sale_orders', 'sales', 'leads'];
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
      );
    ', table_name, table_name, table_name);
  END LOOP;
END $$;

COMMENT ON POLICY "sale_orders_unified" ON public.sale_orders IS
  'Seller site owner and site_members can manage sale_orders; service_role bypass.';
COMMENT ON POLICY "sales_unified" ON public.sales IS
  'Seller site owner and site_members can manage sales; service_role bypass.';
COMMENT ON POLICY "leads_unified" ON public.leads IS
  'Seller site owner and site_members can manage leads; service_role bypass.';
