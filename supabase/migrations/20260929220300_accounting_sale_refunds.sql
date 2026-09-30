BEGIN;

CREATE TABLE public.accounting_sale_refunds (
  id text PRIMARY KEY CHECK (id ~ '^re_[A-Za-z0-9_]+$' AND length(id) <= 255),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0 AND amount <= 1000000000000 AND amount = trunc(amount, 2)),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  refunded_at timestamptz NOT NULL CHECK (isfinite(refunded_at)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accounting_sale_refunds_sale_lookup ON public.accounting_sale_refunds(site_id, sale_id);
ALTER TABLE public.accounting_sale_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accounting_sale_refunds FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.accounting_sale_refunds TO authenticated, service_role;
CREATE POLICY accounting_sale_refunds_select ON public.accounting_sale_refunds FOR SELECT TO authenticated
  USING (public.user_can(site_id, 'select'));

CREATE OR REPLACE FUNCTION public.accounting_record_sale_refund(
  p_sale_id uuid, p_refund_id text, p_amount numeric, p_currency text, p_refunded_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  sale_row public.sales%ROWTYPE; previous public.accounting_sale_refunds%ROWTYPE;
  payment jsonb; payment_total numeric := 0; payment_amount numeric; received_amount numeric;
  refunded_amount numeric;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Refund receipts require a trusted service caller' USING ERRCODE = '42501';
  END IF;
  IF p_sale_id IS NULL OR p_refund_id IS NULL OR p_refund_id !~ '^re_[A-Za-z0-9_]+$'
    OR length(p_refund_id) > 255 OR p_amount IS NULL OR NOT (p_amount > 0 AND p_amount <= 1000000000000)
    OR p_amount <> trunc(p_amount, 2) OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
    OR p_refunded_at IS NULL OR NOT isfinite(p_refunded_at) THEN
    RAISE EXCEPTION 'Invalid refund receipt' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund sale not found' USING ERRCODE = 'P0002'; END IF;
  IF upper(sale_row.currency) IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION 'Refund currency does not match the sale' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('accounting:refund:' || p_refund_id, 0));
  SELECT * INTO previous FROM public.accounting_sale_refunds WHERE id = p_refund_id;
  IF FOUND THEN
    IF previous.sale_id = p_sale_id AND previous.site_id = sale_row.site_id AND previous.amount = p_amount
      AND previous.currency = p_currency AND previous.refunded_at = p_refunded_at THEN RETURN; END IF;
    RAISE EXCEPTION 'Refund identity conflicts with an existing receipt' USING ERRCODE = '23505';
  END IF;
  -- sales.payments is a JSONB receipt array, not public.payments (platform payouts).
  IF sale_row.payments IS NOT NULL AND jsonb_typeof(sale_row.payments) <> 'null' THEN
    IF jsonb_typeof(sale_row.payments) <> 'array' THEN
      RAISE EXCEPTION 'Sale payment receipts require review' USING ERRCODE = '23514';
    END IF;
    FOR payment IN SELECT value FROM jsonb_array_elements(sale_row.payments) LOOP
      IF coalesce(payment->>'amount', '') !~ '^[0-9]+([.][0-9]+)?$' THEN
        RAISE EXCEPTION 'Sale payment amount requires review' USING ERRCODE = '23514';
      END IF;
      payment_amount := (payment->>'amount')::numeric;
      IF payment_amount > 1000000000000 OR payment_amount <> trunc(payment_amount, 2) THEN
        RAISE EXCEPTION 'Invalid recorded payment amount' USING ERRCODE = '23514';
      END IF;
      payment_total := payment_total + payment_amount;
    END LOOP;
  END IF;
  IF sale_row.amount IS NULL OR sale_row.amount NOT BETWEEN 0 AND 1000000000000
    OR (sale_row.amount_due IS NOT NULL AND sale_row.amount_due NOT BETWEEN 0 AND 1000000000000) THEN
    RAISE EXCEPTION 'Sale amounts require review' USING ERRCODE = '23514';
  END IF;
  received_amount := greatest(payment_total, greatest(0, sale_row.amount - coalesce(sale_row.amount_due, sale_row.amount)));
  SELECT coalesce(sum(amount), 0) INTO refunded_amount FROM public.accounting_sale_refunds WHERE sale_id = p_sale_id;
  IF refunded_amount + p_amount > received_amount THEN
    RAISE EXCEPTION 'Cumulative refunds exceed recorded receipts' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.accounting_sale_refunds(id, sale_id, site_id, amount, currency, refunded_at)
    VALUES (p_refund_id, p_sale_id, sale_row.site_id, p_amount, p_currency, p_refunded_at);
  UPDATE public.sales SET accounting_state = CASE WHEN accounting_state = 'unpublished'
    THEN 'unpublished' ELSE 'pending' END, updated_at = clock_timestamp() WHERE id = p_sale_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_record_sale_refund(uuid, text, numeric, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_record_sale_refund(uuid, text, numeric, text, timestamptz)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;