BEGIN;

-- Legacy/unassigned sales payments remain valid and are not backfilled into a
-- register. Only explicitly tagged, authenticated POS receipts enter this ledger.
CREATE TABLE public.pos_register_sessions (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  opened_by uuid NOT NULL,
  closed_by uuid,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  opening_amount numeric NOT NULL CHECK (opening_amount BETWEEN 0 AND 999999999
    AND opening_amount = round(opening_amount,2) AND opening_amount::text NOT IN ('NaN','Infinity','-Infinity')),
  counted_amount numeric CHECK (counted_amount BETWEEN 0 AND 999999999
    AND counted_amount = round(counted_amount,2) AND counted_amount::text NOT IN ('NaN','Infinity','-Infinity')),
  expected_amount numeric CHECK (expected_amount::text NOT IN ('NaN','Infinity','-Infinity')),
  difference numeric CHECK (difference::text NOT IN ('NaN','Infinity','-Infinity')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  close_request_id uuid,
  snapshot jsonb,
  UNIQUE (id,site_id),
  CHECK ((status = 'open' AND closed_by IS NULL AND closed_at IS NULL AND counted_amount IS NULL
    AND expected_amount IS NULL AND difference IS NULL AND close_request_id IS NULL AND snapshot IS NULL)
    OR (status = 'closed' AND closed_by IS NOT NULL AND closed_at IS NOT NULL AND counted_amount IS NOT NULL
    AND expected_amount IS NOT NULL AND difference IS NOT NULL AND close_request_id IS NOT NULL
    AND snapshot IS NOT NULL AND jsonb_typeof(snapshot) = 'object'))
);
CREATE UNIQUE INDEX pos_register_one_open_location ON public.pos_register_sessions(site_id,location_id) WHERE status = 'open';
CREATE INDEX pos_register_sessions_history ON public.pos_register_sessions(site_id,opened_at DESC);
CREATE INDEX pos_register_sessions_closed_history ON public.pos_register_sessions(site_id,location_id,closed_at DESC,id DESC)
  WHERE status = 'closed';

CREATE TABLE public.pos_register_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  site_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cash_in','cash_out','cash_refund')),
  amount numeric NOT NULL CHECK (amount > 0 AND amount <= 999999999 AND amount = round(amount,2)
    AND amount::text NOT IN ('NaN','Infinity','-Infinity')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  request_id uuid NOT NULL,
  FOREIGN KEY (session_id,site_id) REFERENCES public.pos_register_sessions(id,site_id),
  UNIQUE (site_id,request_id)
);
CREATE INDEX pos_register_movements_session ON public.pos_register_movements(session_id,created_at,id);

CREATE TABLE public.pos_register_receipts (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  site_id uuid NOT NULL,
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  method text NOT NULL CHECK (length(btrim(method)) > 0 AND method = lower(btrim(method))),
  amount numeric NOT NULL CHECK (amount > 0 AND amount::text NOT IN ('NaN','Infinity','-Infinity')),
  tendered numeric NOT NULL CHECK (tendered >= 0 AND tendered::text NOT IN ('NaN','Infinity','-Infinity')),
  change numeric NOT NULL CHECK (change >= 0 AND change::text NOT IN ('NaN','Infinity','-Infinity')),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_id uuid NOT NULL,
  FOREIGN KEY (session_id,site_id) REFERENCES public.pos_register_sessions(id,site_id),
  CHECK (method <> 'cash' OR tendered - change = amount)
);
CREATE INDEX pos_register_receipts_session ON public.pos_register_receipts(session_id,received_at,id);
CREATE INDEX pos_register_receipts_sale ON public.pos_register_receipts(sale_id);

ALTER TABLE public.pos_register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_register_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_register_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_register_sessions, public.pos_register_movements, public.pos_register_receipts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pos_register_sessions, public.pos_register_movements, public.pos_register_receipts TO authenticated;
CREATE POLICY pos_register_sessions_read ON public.pos_register_sessions FOR SELECT TO authenticated
  USING (public.current_user_site_role(site_id) IN ('owner','admin','collaborator'));
CREATE POLICY pos_register_movements_read ON public.pos_register_movements FOR SELECT TO authenticated
  USING (public.current_user_site_role(site_id) IN ('owner','admin','collaborator'));
CREATE POLICY pos_register_receipts_read ON public.pos_register_receipts FOR SELECT TO authenticated
  USING (public.current_user_site_role(site_id) IN ('owner','admin','collaborator'));

CREATE FUNCTION public.pos_register_authorize(p_site_id uuid, p_opened_by uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); member_role text := public.current_user_site_role(p_site_id);
BEGIN
  IF actor IS NULL OR auth.role() IS DISTINCT FROM 'authenticated'
    OR member_role IS NULL OR member_role NOT IN ('owner','admin','collaborator')
    OR NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'Register access denied' USING ERRCODE = '42501';
  END IF;
  IF p_opened_by IS NOT NULL AND actor <> p_opened_by AND member_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Only the register opener or a manager may mutate this session' USING ERRCODE = '42501';
  END IF;
  RETURN actor;
END;
$$;
REVOKE ALL ON FUNCTION public.pos_register_authorize(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.pos_register_immutable_ledger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Register ledger rows are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER pos_register_movements_immutable BEFORE UPDATE OR DELETE ON public.pos_register_movements
  FOR EACH ROW EXECUTE FUNCTION public.pos_register_immutable_ledger();
CREATE TRIGGER pos_register_receipts_immutable BEFORE UPDATE OR DELETE ON public.pos_register_receipts
  FOR EACH ROW EXECUTE FUNCTION public.pos_register_immutable_ledger();
REVOKE ALL ON FUNCTION public.pos_register_immutable_ledger() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.pos_register_preserve_session()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Register sessions cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'closed' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Closed register snapshots are immutable' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.id,NEW.site_id,NEW.location_id,NEW.currency,NEW.opened_by,NEW.opened_at,NEW.opening_amount)
    IS DISTINCT FROM ROW(OLD.id,OLD.site_id,OLD.location_id,OLD.currency,OLD.opened_by,OLD.opened_at,OLD.opening_amount) THEN
    RAISE EXCEPTION 'Register opening fields are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pos_register_sessions_preserve BEFORE UPDATE OR DELETE ON public.pos_register_sessions
  FOR EACH ROW EXECUTE FUNCTION public.pos_register_preserve_session();
REVOKE ALL ON FUNCTION public.pos_register_preserve_session() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;