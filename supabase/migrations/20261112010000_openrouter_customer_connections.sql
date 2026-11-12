BEGIN;

-- Account catalog and ciphertext are private even to site managers. HTTP DTOs are
-- the only browser read surface. Never place credentials in settings/channels.
CREATE TABLE public.openrouter_customer_connections (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('connected', 'disconnected')),
  selected boolean NOT NULL DEFAULT false,
  revision integer NOT NULL CHECK (revision > 0),
  policy_version integer NOT NULL CHECK (policy_version > 0),
  credential_version integer NOT NULL CHECK (credential_version > 0),
  encrypted_credential text,
  capabilities jsonb NOT NULL CHECK (jsonb_typeof(capabilities) = 'object'),
  catalog jsonb NOT NULL CHECK (jsonb_typeof(catalog) = 'array'),
  catalog_updated_at timestamptz,
  verified_at timestamptz,
  consent_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  refresh_token uuid,
  refresh_until timestamptz,
  CHECK (NOT selected OR (status = 'connected' AND consent_at IS NOT NULL)),
  CHECK ((status = 'connected' AND encrypted_credential IS NOT NULL) OR
         (status = 'disconnected' AND encrypted_credential IS NULL AND NOT selected))
);
CREATE TABLE public.openrouter_customer_policies (
  connection_id uuid NOT NULL REFERENCES public.openrouter_customer_connections(id) ON DELETE CASCADE,
  policy_version integer NOT NULL,
  credential_version integer NOT NULL,
  capabilities jsonb NOT NULL CHECK (jsonb_typeof(capabilities) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, policy_version)
);
CREATE TABLE public.openrouter_customer_receipts (
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.openrouter_customer_connections(id),
  event_id uuid NOT NULL,
  payer text NOT NULL DEFAULT 'customer' CHECK (payer = 'customer'),
  platform_charge numeric NOT NULL DEFAULT 0 CHECK (platform_charge = 0),
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, connection_id, event_id)
);
ALTER TABLE public.openrouter_customer_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openrouter_customer_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openrouter_customer_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openrouter_customer_connections, public.openrouter_customer_policies,
  public.openrouter_customer_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.openrouter_customer_connections, public.openrouter_customer_policies,
  public.openrouter_customer_receipts TO service_role;

CREATE FUNCTION public.openrouter_customer_assert_manager(p_site_id uuid, p_actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_actor_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND archived_at IS NULL)
    OR NOT (
    EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND user_id = p_actor_id)
    OR EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = p_site_id AND sm.user_id = p_actor_id
      AND sm.status = 'active' AND public.site_member_has_effective_license(sm.id) IS TRUE AND (sm.role IN ('owner', 'admin')
        OR EXISTS (SELECT 1 FROM public.site_ownership WHERE site_id = p_site_id AND user_id = p_actor_id)))
  ) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
END;
$$;

-- Serializes creation as well as updates. Every publication increments a single
-- revision and appends immutable policy history in the same transaction.
CREATE FUNCTION public.openrouter_customer_publish(
  p_site_id uuid, p_actor_id uuid, p_expected_revision integer, p_candidate jsonb,
  p_refresh_token uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_row public.openrouter_customer_connections; next_row public.openrouter_customer_connections;
BEGIN
  PERFORM public.openrouter_customer_assert_manager(p_site_id, p_actor_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('openrouter:' || p_site_id::text, 0));
  SELECT * INTO current_row FROM public.openrouter_customer_connections WHERE site_id = p_site_id FOR UPDATE;
  IF p_expected_revision IS NULL OR p_expected_revision <> coalesce(current_row.revision, 0)
    THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE = '40001'; END IF;
  IF p_refresh_token IS NOT NULL AND (current_row.refresh_token IS DISTINCT FROM p_refresh_token
    OR current_row.refresh_until <= now()) THEN RAISE EXCEPTION 'Refresh conflict' USING ERRCODE = '40001'; END IF;
  IF current_row.id IS NOT NULL AND current_row.id <> (p_candidate->>'id')::uuid
    THEN RAISE EXCEPTION 'Connection identity conflict' USING ERRCODE = '40001'; END IF;
  IF (p_candidate->>'selected')::boolean THEN
    -- Deliberately not an environment switch: global runtime propagation is not complete.
    RAISE EXCEPTION 'Customer runtime not ready' USING ERRCODE = '55000';
  END IF;
  IF (p_candidate->>'credential_version')::integer < coalesce(current_row.credential_version, 1)
    OR (p_candidate->>'credential_version')::integer > coalesce(current_row.credential_version + 1, 1)
    THEN RAISE EXCEPTION 'Credential revision conflict' USING ERRCODE = '40001'; END IF;
  INSERT INTO public.openrouter_customer_connections (
    id, site_id, status, selected, revision, policy_version, credential_version,
    encrypted_credential, capabilities, catalog, catalog_updated_at, verified_at, consent_at, created_by
  ) VALUES (
    (p_candidate->>'id')::uuid, p_site_id, p_candidate->>'status', false,
    p_expected_revision + 1, coalesce(current_row.policy_version, 0) + 1,
    (p_candidate->>'credential_version')::integer, p_candidate->>'encrypted_credential',
    p_candidate->'capabilities', p_candidate->'catalog', (p_candidate->>'catalog_updated_at')::timestamptz,
    (p_candidate->>'verified_at')::timestamptz, (p_candidate->>'consent_at')::timestamptz, p_actor_id
  ) ON CONFLICT (site_id) DO UPDATE SET
    status = EXCLUDED.status, selected = EXCLUDED.selected, revision = EXCLUDED.revision,
    policy_version = EXCLUDED.policy_version, credential_version = EXCLUDED.credential_version,
    encrypted_credential = EXCLUDED.encrypted_credential, capabilities = EXCLUDED.capabilities,
    catalog = EXCLUDED.catalog, catalog_updated_at = EXCLUDED.catalog_updated_at,
    verified_at = EXCLUDED.verified_at, consent_at = EXCLUDED.consent_at,
    updated_at = now(), refresh_token = NULL, refresh_until = NULL
  RETURNING * INTO next_row;
  INSERT INTO public.openrouter_customer_policies(connection_id, policy_version, credential_version, capabilities)
    VALUES(next_row.id, next_row.policy_version, next_row.credential_version, next_row.capabilities);
  RETURN to_jsonb(next_row);
END;
$$;

CREATE FUNCTION public.openrouter_customer_refresh_claim(p_site_id uuid, p_actor_id uuid, p_expected_revision integer, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.openrouter_customer_assert_manager(p_site_id, p_actor_id);
  UPDATE public.openrouter_customer_connections SET refresh_token = p_token, refresh_until = now() + interval '60 seconds'
    WHERE site_id = p_site_id AND revision = p_expected_revision AND status = 'connected'
    AND (refresh_token IS NULL OR refresh_until < now());
  RETURN FOUND;
END;
$$;
CREATE FUNCTION public.openrouter_customer_refresh_release(p_site_id uuid, p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.openrouter_customer_connections SET refresh_token = NULL, refresh_until = NULL
    WHERE site_id = p_site_id AND refresh_token = p_token;
$$;

CREATE FUNCTION public.openrouter_customer_receipt(p_receipt jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE prior jsonb; cost_key text;
BEGIN
  IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' OR octet_length(p_receipt::text) > 16384
    OR p_receipt - ARRAY['site_id','connection_id','policy_version','credential_version','event_id',
      'generation_id','model','capability','usage_evidence','state'] <> '{}'::jsonb
    OR p_receipt->>'state' NOT IN ('completed','uncertain') OR p_receipt->>'state' IS NULL
    OR p_receipt->>'capability' IS NULL OR p_receipt->>'capability' NOT IN
      ('text','tools','structured','vision','summary','embedding','image','speech','transcription','video')
    OR length(p_receipt->>'generation_id') > 256 OR length(p_receipt->>'model') > 256
    OR jsonb_typeof(p_receipt->'usage_evidence') IS DISTINCT FROM 'object'
    THEN RAISE EXCEPTION 'Invalid receipt' USING ERRCODE = '22023'; END IF;
  FOREACH cost_key IN ARRAY ARRAY['gateway_account_cost','upstream_inference_cost'] LOOP
    IF p_receipt->'usage_evidence'->cost_key IS NOT NULL AND p_receipt->'usage_evidence'->cost_key <> 'null'::jsonb
      AND (jsonb_typeof(p_receipt->'usage_evidence'->cost_key) <> 'number'
        OR (p_receipt->'usage_evidence'->>cost_key)::numeric < 0)
      THEN RAISE EXCEPTION 'Invalid cost evidence' USING ERRCODE = '22023'; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.openrouter_customer_connections c
    JOIN public.openrouter_customer_policies p ON p.connection_id = c.id
    WHERE c.id = (p_receipt->>'connection_id')::uuid AND c.site_id = (p_receipt->>'site_id')::uuid
      AND p.policy_version = (p_receipt->>'policy_version')::integer
      AND p.credential_version = (p_receipt->>'credential_version')::integer)
    THEN RAISE EXCEPTION 'Receipt ownership mismatch' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.openrouter_customer_receipts(site_id,connection_id,event_id,receipt)
    VALUES ((p_receipt->>'site_id')::uuid,(p_receipt->>'connection_id')::uuid,(p_receipt->>'event_id')::uuid,p_receipt)
    ON CONFLICT DO NOTHING;
  SELECT receipt INTO prior FROM public.openrouter_customer_receipts
    WHERE site_id = (p_receipt->>'site_id')::uuid AND connection_id = (p_receipt->>'connection_id')::uuid
      AND event_id = (p_receipt->>'event_id')::uuid;
  IF prior IS DISTINCT FROM p_receipt THEN RAISE EXCEPTION 'Receipt conflict' USING ERRCODE = '40001'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.openrouter_customer_assert_manager(uuid,uuid),
  public.openrouter_customer_publish(uuid,uuid,integer,jsonb,uuid),
  public.openrouter_customer_refresh_claim(uuid,uuid,integer,uuid),
  public.openrouter_customer_refresh_release(uuid,uuid), public.openrouter_customer_receipt(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.openrouter_customer_publish(uuid,uuid,integer,jsonb,uuid),
  public.openrouter_customer_refresh_claim(uuid,uuid,integer,uuid),
  public.openrouter_customer_refresh_release(uuid,uuid), public.openrouter_customer_receipt(jsonb) TO service_role;

COMMIT;