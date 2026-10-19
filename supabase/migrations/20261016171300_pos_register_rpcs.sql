BEGIN;

CREATE FUNCTION public.pos_register_open(p_site_id uuid, p_location_id uuid, p_currency text,
  p_opening_amount numeric, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid; session public.pos_register_sessions%ROWTYPE; site_currency text;
BEGIN
  actor := public.pos_register_authorize(p_site_id);
  IF p_request_id IS NULL OR p_opening_amount IS NULL OR p_opening_amount < 0
    OR p_opening_amount > 999999999 OR p_opening_amount <> round(p_opening_amount,2)
    OR p_opening_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'A request ID and finite nonnegative opening amount are required' USING ERRCODE = '22023';
  END IF;
  -- Shared location locks prevent tenant reassignment; the location-scoped
  -- advisory lock serializes opens without deadlocking session receipt writers.
  PERFORM 1 FROM public.locations WHERE id = p_location_id AND site_id = p_site_id AND is_active IS TRUE FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An active same-site location is required' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pos_register_open:' || p_site_id::text || ':' || p_location_id::text,0));
  SELECT * INTO session FROM public.pos_register_sessions WHERE id = p_request_id FOR UPDATE;
  IF FOUND THEN
    IF ROW(session.site_id,session.location_id,session.currency,session.opening_amount,session.opened_by)
      IS DISTINCT FROM ROW(p_site_id,p_location_id,p_currency,p_opening_amount,actor) THEN
      RAISE EXCEPTION 'Register open request ID conflict' USING ERRCODE = '23505';
    END IF;
    RETURN to_jsonb(session);
  END IF;
  SELECT upper(coalesce(currency,'USD')) INTO site_currency FROM public.settings WHERE site_id = p_site_id;
  site_currency := coalesce(site_currency,'USD');
  IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' OR p_currency <> site_currency THEN
    RAISE EXCEPTION 'Register currency must match the site currency' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.pos_register_sessions(id,site_id,location_id,currency,opened_by,opening_amount)
    VALUES (p_request_id,p_site_id,p_location_id,site_currency,actor,p_opening_amount) RETURNING * INTO session;
  RETURN to_jsonb(session);
END;
$$;

CREATE FUNCTION public.pos_register_move(p_session_id uuid, p_kind text, p_amount numeric, p_reason text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE session public.pos_register_sessions%ROWTYPE; movement public.pos_register_movements%ROWTYPE; actor uuid;
BEGIN
  SELECT * INTO session FROM public.pos_register_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register session not found' USING ERRCODE = '22023'; END IF;
  actor := public.pos_register_authorize(session.site_id,session.opened_by);
  IF p_request_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('cash_in','cash_out','cash_refund')
    OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 999999999 OR p_amount <> round(p_amount,2)
    OR p_amount::text IN ('NaN','Infinity','-Infinity')
    OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'A valid kind, positive finite amount, reason and request ID are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO movement FROM public.pos_register_movements WHERE site_id = session.site_id AND request_id = p_request_id;
  IF FOUND THEN
    IF ROW(movement.session_id,movement.kind,movement.amount,movement.reason,movement.actor_id)
      IS DISTINCT FROM ROW(p_session_id,p_kind,p_amount,btrim(p_reason),actor) THEN
      RAISE EXCEPTION 'Register movement request ID conflict' USING ERRCODE = '23505';
    END IF;
    RETURN to_jsonb(movement);
  END IF;
  IF session.status <> 'open' THEN RAISE EXCEPTION 'Register session is closed' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.pos_register_movements(session_id,site_id,kind,amount,reason,actor_id,request_id)
    VALUES (session.id,session.site_id,p_kind,p_amount,btrim(p_reason),actor,p_request_id) RETURNING * INTO movement;
  RETURN to_jsonb(movement);
END;
$$;

CREATE FUNCTION public.pos_register_summary(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE session public.pos_register_sessions%ROWTYPE; cash_received numeric; total_received numeric;
  cash_in numeric; cash_out numeric; cash_refunds numeric; receipt_count bigint;
  payment_totals jsonb; movements jsonb; receipts jsonb;
BEGIN
  -- All receipt/movement writers acquire FOR UPDATE on this row. A shared lock
  -- gives one coherent summary, independent of the sale's date or current totals.
  SELECT * INTO session FROM public.pos_register_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register session not found' USING ERRCODE = '22023'; END IF;
  PERFORM public.pos_register_authorize(session.site_id);
  IF session.status = 'closed' THEN RETURN session.snapshot; END IF;
  SELECT coalesce(sum(amount) FILTER (WHERE method = 'cash'),0), coalesce(sum(amount),0), count(*),
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY received_at,id),'[]'::jsonb)
    INTO cash_received,total_received,receipt_count,receipts FROM public.pos_register_receipts r WHERE session_id = session.id;
  SELECT coalesce(jsonb_object_agg(method,total),'{}'::jsonb) INTO payment_totals FROM (
    SELECT method,sum(amount) total FROM public.pos_register_receipts WHERE session_id = session.id GROUP BY method
  ) totals;
  SELECT coalesce(sum(amount) FILTER (WHERE kind = 'cash_in'),0),
    coalesce(sum(amount) FILTER (WHERE kind = 'cash_out'),0),
    coalesce(sum(amount) FILTER (WHERE kind = 'cash_refund'),0),
    coalesce(jsonb_agg(to_jsonb(m) ORDER BY created_at,id),'[]'::jsonb)
    INTO cash_in,cash_out,cash_refunds,movements FROM public.pos_register_movements m WHERE session_id = session.id;
  RETURN jsonb_build_object('opening_amount',session.opening_amount,'cash_received',cash_received,
    'cash_in',cash_in,'cash_out',cash_out,'cash_refunds',cash_refunds,
    'expected_amount',session.opening_amount + cash_received + cash_in - cash_out - cash_refunds,
    'total_received',total_received,'payment_totals',payment_totals,'receipt_count',receipt_count,
    'movements',movements,'receipts',receipts);
END;
$$;

CREATE FUNCTION public.pos_register_close(p_session_id uuid, p_counted_amount numeric, p_notes text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE session public.pos_register_sessions%ROWTYPE; actor uuid; summary jsonb;
BEGIN
  SELECT * INTO session FROM public.pos_register_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register session not found' USING ERRCODE = '22023'; END IF;
  actor := public.pos_register_authorize(session.site_id,session.opened_by);
  IF p_request_id IS NULL OR p_counted_amount IS NULL OR p_counted_amount < 0
    OR p_counted_amount > 999999999 OR p_counted_amount <> round(p_counted_amount,2)
    OR p_counted_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'A request ID and finite nonnegative counted amount are required' USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NULL OR length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'Register close notes must be text with at most 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF session.status = 'closed' THEN
    IF ROW(session.close_request_id,session.counted_amount,session.notes,session.closed_by)
      IS DISTINCT FROM ROW(p_request_id,p_counted_amount,p_notes,actor) THEN
      RAISE EXCEPTION 'Register close request ID conflict' USING ERRCODE = '23505';
    END IF;
    RETURN to_jsonb(session);
  END IF;
  summary := public.pos_register_summary(session.id);
  UPDATE public.pos_register_sessions SET status = 'closed', closed_by = actor, closed_at = clock_timestamp(),
    counted_amount = p_counted_amount, expected_amount = (summary->>'expected_amount')::numeric,
    difference = p_counted_amount - (summary->>'expected_amount')::numeric,
    notes = p_notes, close_request_id = p_request_id, snapshot = summary WHERE id = session.id RETURNING * INTO session;
  RETURN to_jsonb(session);
END;
$$;

REVOKE ALL ON FUNCTION public.pos_register_open(uuid,uuid,text,numeric,uuid),
  public.pos_register_move(uuid,text,numeric,text,uuid), public.pos_register_summary(uuid),
  public.pos_register_close(uuid,numeric,text,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_register_open(uuid,uuid,text,numeric,uuid),
  public.pos_register_move(uuid,text,numeric,text,uuid), public.pos_register_summary(uuid),
  public.pos_register_close(uuid,numeric,text,uuid) TO authenticated;

COMMIT;