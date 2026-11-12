BEGIN;

-- An intent survives process loss before a generation identifier is returned.
-- No lease expiry or reconciliation path grants permission to replay it.
CREATE TABLE public.openrouter_customer_dispatches (
  event_id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  connection_id uuid NOT NULL REFERENCES public.openrouter_customer_connections(id),
  operation_key text NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 512),
  policy_version integer NOT NULL CHECK (policy_version > 0),
  credential_version integer NOT NULL CHECK (credential_version > 0),
  capability text NOT NULL CHECK (capability IN
    ('text','tools','structured','vision','summary','embedding','image','speech','transcription','video')),
  requested_model text NOT NULL CHECK (length(requested_model) BETWEEN 1 AND 256),
  state text NOT NULL DEFAULT 'dispatching' CHECK (state IN ('dispatching','completed','uncertain','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, operation_key)
);
CREATE INDEX openrouter_customer_dispatches_reconcile
  ON public.openrouter_customer_dispatches(created_at) WHERE state IN ('dispatching','uncertain');
ALTER TABLE public.openrouter_customer_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openrouter_customer_dispatches FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.openrouter_customer_dispatches TO service_role;

CREATE FUNCTION public.openrouter_customer_dispatch(p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE found_event uuid; found_state text;
BEGIN
  IF jsonb_typeof(p_intent) IS DISTINCT FROM 'object' OR octet_length(p_intent::text) > 4096
    OR p_intent - ARRAY['event_id','site_id','connection_id','operation_key','policy_version',
      'credential_version','capability','requested_model'] <> '{}'::jsonb
    THEN RAISE EXCEPTION 'Invalid dispatch intent' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.openrouter_customer_connections c
    JOIN public.openrouter_customer_policies p ON p.connection_id = c.id
    WHERE c.id = (p_intent->>'connection_id')::uuid AND c.site_id = (p_intent->>'site_id')::uuid
      AND c.selected AND c.status = 'connected'
      AND c.credential_version = (p_intent->>'credential_version')::integer
      AND p.policy_version = (p_intent->>'policy_version')::integer
      AND p.credential_version = c.credential_version FOR SHARE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispatch ownership mismatch' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.openrouter_customer_dispatches(event_id,site_id,connection_id,operation_key,
    policy_version,credential_version,capability,requested_model)
  VALUES ((p_intent->>'event_id')::uuid,(p_intent->>'site_id')::uuid,(p_intent->>'connection_id')::uuid,
    p_intent->>'operation_key',(p_intent->>'policy_version')::integer,
    (p_intent->>'credential_version')::integer,p_intent->>'capability',p_intent->>'requested_model')
  ON CONFLICT DO NOTHING RETURNING event_id INTO found_event;
  IF found_event IS NOT NULL THEN
    RETURN jsonb_build_object('claimed',true,'event_id',found_event,'state','dispatching');
  END IF;
  SELECT event_id,state INTO found_event,found_state FROM public.openrouter_customer_dispatches
    WHERE site_id = (p_intent->>'site_id')::uuid AND operation_key = p_intent->>'operation_key';
  RETURN jsonb_build_object('claimed',false,'event_id',found_event,'state',found_state);
END;
$$;

CREATE FUNCTION public.openrouter_customer_dispatch_reject(p_site_id uuid,p_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.openrouter_customer_dispatches SET state = 'rejected', updated_at = now()
    WHERE site_id = p_site_id AND event_id = p_event_id AND state IN ('dispatching','rejected');
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispatch outcome conflict' USING ERRCODE = '40001'; END IF;
END;
$$;

-- Existing receipt validation remains authoritative. Insert and intent settlement
-- share one transaction, including when the process loses the RPC response.
CREATE FUNCTION public.openrouter_customer_receipt_settle_intent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.openrouter_customer_dispatches SET state = NEW.receipt->>'state', updated_at = now()
    WHERE event_id = NEW.event_id AND site_id = NEW.site_id AND connection_id = NEW.connection_id
      AND policy_version = (NEW.receipt->>'policy_version')::integer
      AND credential_version = (NEW.receipt->>'credential_version')::integer
      AND capability = NEW.receipt->>'capability' AND state IN ('dispatching','uncertain');
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt requires dispatch intent' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER openrouter_customer_receipt_settle_intent AFTER INSERT ON public.openrouter_customer_receipts
  FOR EACH ROW EXECUTE FUNCTION public.openrouter_customer_receipt_settle_intent();

CREATE TABLE public.openrouter_customer_dispatch_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.openrouter_customer_dispatches(event_id),
  actor_id uuid NOT NULL,
  resolution text NOT NULL CHECK (resolution IN ('completed','uncertain','rejected')),
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.openrouter_customer_dispatch_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openrouter_customer_dispatch_reconciliations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.openrouter_customer_dispatch_reconciliations TO service_role;

CREATE FUNCTION public.openrouter_customer_dispatch_pending(p_limit integer DEFAULT 100)
RETURNS SETOF public.openrouter_customer_dispatches LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT * FROM public.openrouter_customer_dispatches WHERE state IN ('dispatching','uncertain')
    ORDER BY created_at LIMIT greatest(1,least(p_limit,500));
$$;

CREATE FUNCTION public.openrouter_customer_dispatch_reconcile(
  p_event_id uuid,p_actor_id uuid,p_resolution text,p_evidence jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_actor_id IS NULL OR p_resolution NOT IN ('completed','uncertain','rejected')
    OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' OR octet_length(p_evidence::text) > 4096
    OR p_evidence - ARRAY['generation_id','gateway_account_cost','reason'] <> '{}'::jsonb
    OR length(coalesce(p_evidence->>'reason','')) NOT BETWEEN 1 AND 1000
    OR length(coalesce(p_evidence->>'generation_id','')) > 256
    OR (p_resolution = 'completed' AND (p_evidence->>'generation_id' IS NULL
      OR jsonb_typeof(p_evidence->'gateway_account_cost') IS DISTINCT FROM 'number'
      OR (p_evidence->>'gateway_account_cost')::numeric < 0))
    THEN RAISE EXCEPTION 'Invalid reconciliation evidence' USING ERRCODE = '22023'; END IF;
  UPDATE public.openrouter_customer_dispatches SET state = p_resolution, updated_at = now()
    WHERE event_id = p_event_id AND state IN ('dispatching','uncertain');
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispatch outcome conflict' USING ERRCODE = '40001'; END IF;
  INSERT INTO public.openrouter_customer_dispatch_reconciliations(event_id,actor_id,resolution,evidence)
    VALUES (p_event_id,p_actor_id,p_resolution,p_evidence);
END;
$$;

REVOKE ALL ON FUNCTION public.openrouter_customer_dispatch(jsonb),
  public.openrouter_customer_dispatch_reject(uuid,uuid), public.openrouter_customer_receipt_settle_intent(),
  public.openrouter_customer_dispatch_pending(integer),
  public.openrouter_customer_dispatch_reconcile(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.openrouter_customer_dispatch(jsonb),
  public.openrouter_customer_dispatch_reject(uuid,uuid), public.openrouter_customer_dispatch_pending(integer),
  public.openrouter_customer_dispatch_reconcile(uuid,uuid,text,jsonb) TO service_role;

COMMIT;