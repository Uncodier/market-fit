BEGIN;

-- Host-owned immutable queue attribution, never commands.metadata supplied by callers.
CREATE TABLE public.openrouter_command_routing (
  command_id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  routing jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (routing->>'siteId' = site_id::text),
  CHECK (routing->>'payer' IN ('platform', 'customer'))
);
ALTER TABLE public.openrouter_command_routing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openrouter_command_routing FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.openrouter_command_routing TO service_role;

-- A migration-time snapshot, not a runtime guess using client-controlled timestamps.
INSERT INTO public.openrouter_command_routing(command_id, site_id, routing)
SELECT id, site_id, jsonb_build_object('payer','platform','siteId',site_id::text)
FROM public.commands WHERE site_id IS NOT NULL;

-- Validate the existing command snapshot set-wise, avoiding a row-lock lookup
-- against the large commands table for every historical attribution row.
-- New writes are checked immediately; validation must finish before COMMIT.
ALTER TABLE public.openrouter_command_routing
  ADD CONSTRAINT openrouter_command_routing_command_id_fkey
  FOREIGN KEY (command_id) REFERENCES public.commands(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.openrouter_command_routing
  VALIDATE CONSTRAINT openrouter_command_routing_command_id_fkey;

CREATE FUNCTION public.openrouter_command_routing_pin(p_command_id uuid, p_site_id uuid, p_routing jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE existing jsonb;
BEGIN
  IF p_routing IS NULL OR jsonb_typeof(p_routing) <> 'object'
    OR p_routing->>'siteId' IS DISTINCT FROM p_site_id::text
    OR p_routing->>'payer' IS NULL OR p_routing->>'payer' NOT IN ('platform','customer')
    THEN RAISE EXCEPTION 'Invalid routing reference' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.commands WHERE id = p_command_id AND site_id = p_site_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Command site mismatch' USING ERRCODE = '42501'; END IF;
  IF p_routing->>'payer' = 'platform' THEN
    IF p_routing - ARRAY['payer','siteId'] <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Invalid platform reference' USING ERRCODE = '22023'; END IF;
  ELSE
    IF p_routing - ARRAY['payer','siteId','connectionId','policyVersion','credentialVersion'] <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Invalid customer reference' USING ERRCODE = '22023'; END IF;
    PERFORM 1 FROM public.openrouter_customer_connections c
      JOIN public.openrouter_customer_policies p ON p.connection_id = c.id
      WHERE c.id = (p_routing->>'connectionId')::uuid AND c.site_id = p_site_id
      AND c.selected AND c.status = 'connected'
      AND c.credential_version = (p_routing->>'credentialVersion')::integer
      AND p.policy_version = (p_routing->>'policyVersion')::integer
      AND p.credential_version = c.credential_version FOR SHARE OF c;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer routing unavailable' USING ERRCODE = '42501'; END IF;
  END IF;
  INSERT INTO public.openrouter_command_routing(command_id,site_id,routing)
    VALUES(p_command_id,p_site_id,p_routing) ON CONFLICT DO NOTHING;
  SELECT routing INTO existing FROM public.openrouter_command_routing WHERE command_id = p_command_id;
  IF existing IS DISTINCT FROM p_routing THEN
    RAISE EXCEPTION 'Command routing is immutable' USING ERRCODE = '40001'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.openrouter_command_routing_pin(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.openrouter_command_routing_pin(uuid,uuid,jsonb) TO service_role;

COMMIT;