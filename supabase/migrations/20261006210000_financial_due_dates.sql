BEGIN;

-- Optional calendar dates. No backfill: historical documents remain unscheduled.
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS due_date date;

-- Keep the application contract finite and expressible as YYYY-MM-DD.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sales'::regclass AND conname = 'sales_due_date_calendar_check') THEN
    ALTER TABLE public.sales ADD CONSTRAINT sales_due_date_calendar_check
      CHECK (due_date IS NULL OR (isfinite(due_date) AND due_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.subscriptions'::regclass AND conname = 'subscriptions_due_date_calendar_check') THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_due_date_calendar_check
      CHECK (due_date IS NULL OR (isfinite(due_date) AND due_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.purchases'::regclass AND conname = 'purchases_due_date_calendar_check') THEN
    ALTER TABLE public.purchases ADD CONSTRAINT purchases_due_date_calendar_check
      CHECK (due_date IS NULL OR (isfinite(due_date) AND due_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'));
  END IF;
END $$;

COMMENT ON COLUMN public.sales.due_date IS 'Optional payment due calendar date; NULL means no due date configured.';
COMMENT ON COLUMN public.purchases.due_date IS 'Optional vendor bill payment due calendar date; NULL means no due date configured.';
COMMENT ON COLUMN public.subscriptions.due_date IS 'Due date for next_billing_date cycle; generated invoices preserve the calendar-day offset and cycle advancement shifts both dates together.';

-- Existing table RLS and grants remain unchanged. Efficient tenant-scoped reminders.
CREATE INDEX IF NOT EXISTS sales_site_unpaid_due_date_idx ON public.sales(site_id, due_date, id)
  WHERE due_date IS NOT NULL AND amount_due > 0 AND status = 'pending';

-- Editing a vendor bill must not commit an empty item set if insertion fails.
-- Payment changes are deliberately excluded: retain the locked paid amount.
CREATE OR REPLACE FUNCTION public.accounting_update_purchase_items(
  p_site_id uuid, p_purchase_id uuid, p_expected_updated_at timestamptz,
  p_items jsonb, p_update jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  previous public.purchases%ROWTYPE; replacement public.purchases%ROWTYPE;
  item jsonb; payment jsonb; quantity numeric; unit_cost numeric; subtotal numeric;
  total numeric := 0; paid numeric := 0; payment_amount numeric; catalog_id uuid; matched uuid;
  recorded_paid numeric := 0; implicit_paid numeric;
BEGIN
  IF p_site_id IS NULL OR p_purchase_id IS NULL OR (auth.role() IS DISTINCT FROM 'service_role'
    AND (auth.uid() IS NULL OR NOT public.user_can(p_site_id, 'update'))) THEN
    RAISE EXCEPTION 'Purchase update is not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_expected_updated_at IS NULL OR NOT isfinite(p_expected_updated_at)
    OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_typeof(p_update) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid purchase update' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 5000 OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_update) k
    WHERE k NOT IN ('title','vendor_company_id','status','currency','purchase_date','due_date','location_id','notes')
  ) THEN
    RAISE EXCEPTION 'Invalid item count or purchase update fields' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO previous FROM public.purchases WHERE id = p_purchase_id AND site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found in this site' USING ERRCODE = 'P0002'; END IF;
  IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Purchase changed; reload before saving' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO replacement FROM jsonb_populate_record(previous, p_update);
  IF replacement.title IS NULL OR length(btrim(replacement.title)) NOT BETWEEN 1 AND 200
    OR replacement.status IS NULL OR replacement.status NOT IN ('draft','pending','completed','cancelled')
    OR replacement.currency IS NULL OR replacement.currency !~ '^[A-Z]{3}$'
    OR replacement.purchase_date IS NULL OR NOT isfinite(replacement.purchase_date)
    OR (replacement.due_date IS NOT NULL AND (NOT isfinite(replacement.due_date)
      OR replacement.due_date < DATE '0001-01-01' OR replacement.due_date > DATE '9999-12-31'))
    OR coalesce(length(replacement.notes), 0) > 10000 THEN
    RAISE EXCEPTION 'Invalid purchase header' USING ERRCODE = '22023';
  END IF;
  IF replacement.location_id IS NOT NULL THEN
    SELECT id INTO matched FROM public.locations WHERE id = replacement.location_id AND site_id = p_site_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Purchase location not found in this site' USING ERRCODE = '23514'; END IF;
  END IF;
  IF replacement.vendor_company_id IS NOT NULL THEN
    -- Vendors use the shared global company registry, not a nonexistent site_id.
    SELECT id INTO matched FROM public.companies WHERE id = replacement.vendor_company_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Purchase vendor not found' USING ERRCODE = '23514'; END IF;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
      OR jsonb_typeof(item->'unit_cost') IS DISTINCT FROM 'number'
      OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string'
      OR length(btrim(item->>'name')) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'Invalid purchase item' USING ERRCODE = '22023';
    END IF;
    quantity := (item->>'quantity')::numeric;
    unit_cost := (item->>'unit_cost')::numeric;
    IF NOT (quantity > 0 AND quantity <= 1000000000) OR quantity <> trunc(quantity, 6)
      OR unit_cost NOT BETWEEN 0 AND 1000000000000 OR unit_cost <> trunc(unit_cost, 2) THEN
      RAISE EXCEPTION 'Invalid purchase item quantity or unit cost' USING ERRCODE = '22023';
    END IF;
    subtotal := round(quantity * unit_cost, 2);
    IF item ? 'subtotal' AND (jsonb_typeof(item->'subtotal') IS DISTINCT FROM 'number'
      OR (item->>'subtotal')::numeric IS DISTINCT FROM subtotal) THEN
      RAISE EXCEPTION 'Purchase item subtotal does not match quantity and cost' USING ERRCODE = '22023';
    END IF;
    total := total + subtotal;
    IF total > 1000000000000 THEN RAISE EXCEPTION 'Purchase total exceeds the supported amount' USING ERRCODE = '22023'; END IF;
    catalog_id := (item->>'catalog_item_id')::uuid;
    IF catalog_id IS NOT NULL THEN
      SELECT id INTO matched FROM public.catalog_items WHERE id = catalog_id AND site_id = p_site_id FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Purchase catalog item not found in this site' USING ERRCODE = '23514'; END IF;
    END IF;
  END LOOP;
  IF previous.amount IS NULL OR previous.amount NOT BETWEEN 0 AND 1000000000000
    OR previous.amount_due IS NULL OR previous.amount_due NOT BETWEEN 0 AND previous.amount
    OR previous.amount <> trunc(previous.amount, 2) OR previous.amount_due <> trunc(previous.amount_due, 2) THEN
    RAISE EXCEPTION 'Existing purchase balances require review' USING ERRCODE = '23514';
  END IF;
  IF previous.payments IS NOT NULL AND jsonb_typeof(previous.payments) <> 'null' THEN
    IF jsonb_typeof(previous.payments) <> 'array' THEN
      RAISE EXCEPTION 'Purchase payment receipts require review' USING ERRCODE = '23514';
    END IF;
    FOR payment IN SELECT value FROM jsonb_array_elements(previous.payments) LOOP
      IF coalesce(payment->>'amount', '') !~ '^[0-9]+([.][0-9]+)?$' THEN
        RAISE EXCEPTION 'Purchase payment amount requires review' USING ERRCODE = '23514';
      END IF;
      payment_amount := (payment->>'amount')::numeric;
      IF payment_amount > 1000000000000 OR payment_amount <> trunc(payment_amount, 2) THEN
        RAISE EXCEPTION 'Invalid purchase payment amount' USING ERRCODE = '23514';
      END IF;
      recorded_paid := recorded_paid + payment_amount;
    END LOOP;
  END IF;
  implicit_paid := previous.amount - previous.amount_due;
  IF implicit_paid > total AND recorded_paid < implicit_paid THEN
    RAISE EXCEPTION 'Legacy purchase payment receipts require review before reducing the total'
      USING ERRCODE = '23514';
  END IF;
  paid := greatest(recorded_paid, implicit_paid);
  DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id AND site_id = p_site_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.purchase_items(purchase_id, site_id, catalog_item_id, name, quantity, unit_cost, subtotal)
      VALUES (p_purchase_id, p_site_id, (item->>'catalog_item_id')::uuid, item->>'name',
        (item->>'quantity')::numeric, (item->>'unit_cost')::numeric,
        round((item->>'quantity')::numeric * (item->>'unit_cost')::numeric, 2));
  END LOOP;
  UPDATE public.purchases SET title = replacement.title, vendor_company_id = replacement.vendor_company_id,
    status = replacement.status, currency = replacement.currency, purchase_date = replacement.purchase_date,
    due_date = replacement.due_date,
    location_id = replacement.location_id, notes = replacement.notes, amount = total, amount_due = greatest(0, total - paid),
    accounting_state = CASE WHEN previous.accounting_state = 'unpublished' THEN 'unpublished' ELSE 'pending' END,
    updated_at = clock_timestamp() WHERE id = p_purchase_id AND site_id = p_site_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_update_purchase_items(uuid, uuid, timestamptz, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_update_purchase_items(uuid, uuid, timestamptz, jsonb, jsonb)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;