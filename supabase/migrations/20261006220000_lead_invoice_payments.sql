BEGIN;

CREATE TABLE public.lead_invoice_payment_requests (
  request_id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  actor_id uuid NOT NULL,
  payload jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_invoice_payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_invoice_payment_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.lead_invoice_payment_requests TO authenticated;
CREATE POLICY lead_invoice_payment_actor_read ON public.lead_invoice_payment_requests
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid() AND public.user_can(site_id, 'update'));

-- Explicit assignment checks preserve sales/lead RLS scope inside these narrowly
-- authorized definer functions. They never expose buyer-only invoice access.
CREATE OR REPLACE FUNCTION public.lead_open_invoice_snapshot(p_site_id uuid, p_lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  restricted boolean;
  invoices jsonb;
BEGIN
  IF actor IS NULL OR NOT coalesce(public.user_can(p_site_id, 'update'), false) THEN
    RAISE EXCEPTION 'Invoice payment access denied' USING ERRCODE = '42501';
  END IF;
  restricted := NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = p_site_id AND s.user_id = actor)
    AND NOT EXISTS (SELECT 1 FROM public.site_ownership o WHERE o.site_id = p_site_id AND o.user_id = actor)
    AND EXISTS (SELECT 1 FROM public.site_members m WHERE m.site_id = p_site_id
      AND m.user_id = actor AND m.status = 'active' AND m.restrict_to_assigned_only);
  IF NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = p_lead_id AND l.site_id = p_site_id
    AND (NOT restricted OR l.user_id = actor OR l.assignee_id = actor)) THEN
    RAISE EXCEPTION 'Lead payment access denied' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'title', s.title, 'invoiceNumber', s.invoice_number,
    'amountDue', s.amount_due, 'currency', s.currency, 'saleDate', s.sale_date,
    'createdAt', s.created_at, 'updatedAt', s.updated_at, 'status', s.status
  ) ORDER BY s.sale_date DESC, s.created_at DESC, s.id DESC), '[]'::jsonb)
  INTO invoices FROM public.sales s
  WHERE s.site_id = p_site_id AND s.lead_id = p_lead_id
    AND s.status IN ('pending', 'completed') AND s.amount_due > 0
    AND (NOT restricted OR s.user_id = actor);
  RETURN jsonb_build_object('invoices', invoices, 'version', md5(invoices::text));
END;
$$;
REVOKE ALL ON FUNCTION public.lead_open_invoice_snapshot(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_open_invoice_snapshot(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_lead_invoice_payment(
  p_site_id uuid, p_lead_id uuid, p_request_id uuid, p_version text,
  p_currency text, p_mode text, p_amount numeric, p_method text, p_notes text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  snapshot jsonb;
  payload jsonb;
  prior public.lead_invoice_payment_requests%ROWTYPE;
  invoice public.sales%ROWTYPE;
  total numeric;
  remaining numeric;
  received numeric;
  applied numeric;
  next_status text;
  allocations jsonb := '[]'::jsonb;
  result jsonb;
  receipt_time timestamptz := clock_timestamp();
BEGIN
  -- Authentication and lead visibility are checked even on idempotent replay.
  snapshot := public.lead_open_invoice_snapshot(p_site_id, p_lead_id);
  IF p_request_id IS NULL OR p_version IS NULL OR p_version !~ '^[a-f0-9]{32}$'
    OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
    OR p_mode IS NULL OR p_mode NOT IN ('full', 'partial')
    OR p_method IS NULL OR p_method NOT IN ('credit_card','debit_card','bank_transfer','cash',
      'check','paypal','stripe','venmo','zelle','crypto','wire_transfer')
    OR length(coalesce(p_notes, '')) > 2000
    OR (p_mode = 'partial' AND (p_amount IS NULL OR p_amount::text IN ('NaN','Infinity','-Infinity')
      OR p_amount <= 0 OR p_amount > 999999999999 OR p_amount <> trunc(p_amount, 2))) THEN
    RAISE EXCEPTION 'Invalid invoice payment' USING ERRCODE = '22023';
  END IF;
  payload := jsonb_build_object('siteId', p_site_id, 'leadId', p_lead_id,
    'version', p_version, 'currency', p_currency, 'mode', p_mode,
    'amount', CASE WHEN p_mode = 'partial' THEN p_amount ELSE NULL END,
    'method', p_method, 'notes', btrim(coalesce(p_notes, '')));

  -- Serialize payments for one lead, including retries and new invoice inserts
  -- referencing that lead. Other invoice writers serialize on their sale rows.
  PERFORM 1 FROM public.leads WHERE id = p_lead_id AND site_id = p_site_id FOR UPDATE;
  SELECT * INTO prior FROM public.lead_invoice_payment_requests WHERE request_id = p_request_id;
  IF FOUND THEN
    IF prior.actor_id <> actor OR prior.site_id <> p_site_id OR prior.lead_id <> p_lead_id
      OR prior.payload IS DISTINCT FROM payload THEN
      RAISE EXCEPTION 'Payment request already used with different details' USING ERRCODE = '22023';
    END IF;
    RETURN prior.result;
  END IF;

  snapshot := public.lead_open_invoice_snapshot(p_site_id, p_lead_id);
  PERFORM 1 FROM public.sales s WHERE s.id IN (
    SELECT (item->>'id')::uuid FROM jsonb_array_elements(snapshot->'invoices') item
  ) ORDER BY s.id FOR UPDATE;
  snapshot := public.lead_open_invoice_snapshot(p_site_id, p_lead_id);
  IF snapshot->>'version' IS DISTINCT FROM p_version THEN
    RAISE EXCEPTION 'Invoice balances changed' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot->'invoices') item
    WHERE item->>'currency' IS NULL OR item->>'currency' !~ '^[A-Z]{3}$') THEN
    RAISE EXCEPTION 'Invoice currency requires review' USING ERRCODE = '23514';
  END IF;
  SELECT coalesce(sum((item->>'amountDue')::numeric), 0) INTO total
    FROM jsonb_array_elements(snapshot->'invoices') item WHERE item->>'currency' = p_currency;
  received := CASE WHEN p_mode = 'full' THEN total ELSE p_amount END;
  IF received <= 0 OR received > total OR received <> trunc(received, 2) THEN
    RAISE EXCEPTION 'Payment exceeds available invoice balances' USING ERRCODE = '23514';
  END IF;
  remaining := received;
  FOR invoice IN SELECT s.* FROM public.sales s WHERE s.id IN (
    SELECT (item->>'id')::uuid FROM jsonb_array_elements(snapshot->'invoices') item
    WHERE item->>'currency' = p_currency
  ) ORDER BY s.sale_date DESC, s.created_at DESC, s.id DESC LOOP
    EXIT WHEN remaining = 0;
    IF invoice.amount_due <> trunc(invoice.amount_due, 2)
      OR jsonb_typeof(coalesce(invoice.payments, '[]'::jsonb)) <> 'array' THEN
      RAISE EXCEPTION 'Invoice payment history requires review' USING ERRCODE = '23514';
    END IF;
    applied := least(invoice.amount_due, remaining);
    next_status := CASE WHEN invoice.amount_due = applied AND invoice.status = 'pending'
      THEN 'completed' ELSE invoice.status END;
    UPDATE public.sales SET amount_due = invoice.amount_due - applied, status = next_status,
      payment_method = p_method,
      payments = coalesce(invoice.payments, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'id', p_request_id::text || ':' || invoice.id::text, 'request_id', p_request_id,
        'amount', applied, 'currency', p_currency, 'date', receipt_time,
        'method', p_method, 'notes', btrim(coalesce(p_notes, '')), 'recorded_by', actor
      )),
      accounting_state = CASE WHEN invoice.accounting_state = 'unpublished' THEN 'unpublished' ELSE 'pending' END,
      updated_at = clock_timestamp()
    WHERE id = invoice.id AND site_id = p_site_id AND lead_id = p_lead_id;
    allocations := allocations || jsonb_build_array(jsonb_build_object('invoiceId', invoice.id,
      'amount', applied, 'amountDue', invoice.amount_due - applied,
      'previousStatus', invoice.status, 'status', next_status));
    remaining := remaining - applied;
  END LOOP;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'Invoice allocation incomplete' USING ERRCODE = '40001';
  END IF;
  result := jsonb_build_object('requestId', p_request_id, 'amount', received,
    'currency', p_currency, 'allocations', allocations);
  INSERT INTO public.lead_invoice_payment_requests(request_id, site_id, lead_id, actor_id, payload, result)
    VALUES (p_request_id, p_site_id, p_lead_id, actor, payload, result);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.record_lead_invoice_payment(uuid, uuid, uuid, text, text, text, numeric, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_lead_invoice_payment(uuid, uuid, uuid, text, text, text, numeric, text, text)
  TO authenticated;

COMMIT;