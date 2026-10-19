BEGIN;

CREATE FUNCTION public.pos_register_capture_sale_payments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE old_payments jsonb := '[]'::jsonb; new_payments jsonb; payment jsonb;
  payment_id uuid; session_id uuid; recorded_by uuid; actor uuid;
  session public.pos_register_sessions%ROWTYPE; amount numeric; tendered numeric; change_amount numeric;
  method text; tagged boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' AND jsonb_typeof(OLD.payments) = 'array' THEN old_payments := OLD.payments; END IF;
  tagged := EXISTS (SELECT 1 FROM jsonb_array_elements(old_payments) p WHERE p ? 'register_session_id')
    OR EXISTS (SELECT 1 FROM public.pos_register_receipts WHERE sale_id = CASE WHEN TG_OP = 'INSERT' THEN NEW.id ELSE OLD.id END);
  IF TG_OP = 'DELETE' THEN
    IF tagged THEN RAISE EXCEPTION 'Sales with register receipts cannot be deleted' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND tagged AND ROW(NEW.id,NEW.site_id,NEW.currency,NEW.location_id)
    IS DISTINCT FROM ROW(OLD.id,OLD.site_id,OLD.currency,OLD.location_id) THEN
    RAISE EXCEPTION 'Register sale identity, site, currency and location are immutable' USING ERRCODE = '23514';
  END IF;
  new_payments := coalesce(NEW.payments,'[]'::jsonb);
  IF jsonb_typeof(new_payments) <> 'array' THEN
    IF tagged THEN RAISE EXCEPTION 'Tagged register payments cannot be removed' USING ERRCODE = '23514'; END IF;
    RETURN NEW; -- Preserve unrelated legacy/non-POS payment formats.
  END IF;
  FOR payment IN SELECT value FROM jsonb_array_elements(old_payments) WHERE value ? 'register_session_id' LOOP
    IF (SELECT count(*) FROM jsonb_array_elements(new_payments) p WHERE p = payment) <> 1 THEN
      RAISE EXCEPTION 'Tagged register payments are immutable' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  -- Validate UUIDs before ordered session locking; never silently drop malformed
  -- tags. Untagged historical and legacy-client payments stay unassigned.
  FOR payment IN SELECT value FROM jsonb_array_elements(new_payments) WHERE value ? 'register_session_id' LOOP
    BEGIN
      session_id := (payment->>'register_session_id')::uuid;
      payment_id := (payment->>'payment_id')::uuid;
      recorded_by := (payment->>'recorded_by')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Register payment tags require valid UUIDs' USING ERRCODE = '22023';
    END;
    IF session_id IS NULL OR payment_id IS NULL OR recorded_by IS NULL THEN
      RAISE EXCEPTION 'Register payment tags require session, payment and actor UUIDs' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(new_payments) p WHERE p ? 'register_session_id'
    GROUP BY (p->>'payment_id')::uuid HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate register payment ID' USING ERRCODE = '23505';
  END IF;
  -- Lock every newly referenced session in UUID order. Close and movements take
  -- this same row lock, so receipt insertion and the sale save commit atomically.
  FOR session_id IN SELECT DISTINCT (p->>'register_session_id')::uuid
    FROM jsonb_array_elements(new_payments) p WHERE p ? 'register_session_id'
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(old_payments) o WHERE o = p)
    ORDER BY 1 LOOP
    SELECT * INTO session FROM public.pos_register_sessions WHERE id = session_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Register session not found' USING ERRCODE = '22023'; END IF;
    actor := public.pos_register_authorize(session.site_id,session.opened_by);
    IF session.status <> 'open' THEN RAISE EXCEPTION 'Register session is closed' USING ERRCODE = '23514'; END IF;
    IF NEW.site_id IS DISTINCT FROM session.site_id OR NEW.location_id IS DISTINCT FROM session.location_id
      OR NEW.currency IS DISTINCT FROM session.currency THEN
      RAISE EXCEPTION 'Register payment site, location and currency must match the sale' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.locations WHERE id = session.location_id AND site_id = session.site_id AND is_active IS TRUE FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'An active same-site register location is required' USING ERRCODE = '22023'; END IF;
    FOR payment IN SELECT value FROM jsonb_array_elements(new_payments) p
      WHERE p ? 'register_session_id' AND (p->>'register_session_id')::uuid = session.id
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(old_payments) o WHERE o = p) LOOP
      payment_id := (payment->>'payment_id')::uuid;
      recorded_by := (payment->>'recorded_by')::uuid;
      IF recorded_by <> actor THEN RAISE EXCEPTION 'Register payment actor must match authenticated user' USING ERRCODE = '42501'; END IF;
      IF payment->>'status' IS DISTINCT FROM 'completed' THEN
        RAISE EXCEPTION 'Tagged register payments must be completed' USING ERRCODE = '22023';
      END IF;
      method := payment->>'method';
      IF method IS NULL OR method NOT IN ('cash','credit_card','debit_card','transfer','on_account','other') THEN
        RAISE EXCEPTION 'Invalid register payment method' USING ERRCODE = '22023';
      END IF;
      IF payment ? 'currency' AND payment->>'currency' IS DISTINCT FROM session.currency THEN
        RAISE EXCEPTION 'Register payment currency mismatch' USING ERRCODE = '22023';
      END IF;
      BEGIN
        amount := (payment->>'amount')::numeric;
        tendered := (payment->>'tendered')::numeric;
        change_amount := (payment->>'change')::numeric;
      EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Register payment amounts must be finite numbers' USING ERRCODE = '22023';
      END;
      IF amount IS NULL OR amount <= 0 OR amount::text IN ('NaN','Infinity','-Infinity')
        OR tendered IS NULL OR tendered < 0 OR tendered::text IN ('NaN','Infinity','-Infinity')
        OR change_amount IS NULL OR change_amount < 0 OR change_amount::text IN ('NaN','Infinity','-Infinity')
        OR (method = 'cash' AND tendered - change_amount <> amount) THEN
        RAISE EXCEPTION 'Register payment amounts must be finite, nonnegative and balanced for cash' USING ERRCODE = '22023';
      END IF;
      -- Global payment-ID uniqueness rejects cross-sale/session reuse rather than
      -- silently accepting a mismatched receipt. Unchanged sale replays skip here.
      INSERT INTO public.pos_register_receipts(id,session_id,site_id,sale_id,method,amount,tendered,change,actor_id)
        VALUES (payment_id,session.id,session.site_id,NEW.id,method,amount,tendered,change_amount,actor);
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.pos_register_capture_sale_payments() FROM PUBLIC, anon, authenticated, service_role;
-- AFTER is required for the receipt FK on a newly inserted sale. Exceptions still
-- roll back the entire sale statement and all receipt rows in the same transaction.
CREATE TRIGGER pos_register_capture_sale_payments AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.pos_register_capture_sale_payments();

COMMIT;