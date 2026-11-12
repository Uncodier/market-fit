BEGIN;
CREATE TABLE public.openrouter_plan_routing (
  plan_id uuid PRIMARY KEY REFERENCES public.instance_plans(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  routing jsonb NOT NULL CHECK (jsonb_typeof(routing)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.openrouter_plan_routing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openrouter_plan_routing FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.openrouter_plan_routing TO service_role;
-- Only rows existing at migration time receive a legacy platform attribution.
INSERT INTO public.openrouter_plan_routing(plan_id,site_id,routing)
  SELECT id,site_id,jsonb_build_object('payer','platform','siteId',site_id::text)
  FROM public.instance_plans WHERE site_id IS NOT NULL;
CREATE FUNCTION public.openrouter_plan_routing_pin(p_plan_id uuid,p_site_id uuid,p_routing jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE prior jsonb;
BEGIN
  IF p_routing IS NULL OR jsonb_typeof(p_routing)<>'object' OR p_routing->>'siteId' IS DISTINCT FROM p_site_id::text
    OR p_routing->>'payer' IS NULL OR p_routing->>'payer' NOT IN ('platform','customer')
    THEN RAISE EXCEPTION 'Invalid routing reference' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.instance_plans WHERE id=p_plan_id AND site_id=p_site_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan site mismatch' USING ERRCODE='42501'; END IF;
  IF p_routing->>'payer'='platform' THEN
    IF p_routing-ARRAY['payer','siteId']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid platform reference' USING ERRCODE='22023'; END IF;
  ELSE
    IF p_routing-ARRAY['payer','siteId','connectionId','policyVersion','credentialVersion']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid customer reference' USING ERRCODE='22023'; END IF;
    PERFORM 1 FROM public.openrouter_customer_connections c JOIN public.openrouter_customer_policies p ON p.connection_id=c.id
      WHERE c.id=(p_routing->>'connectionId')::uuid AND c.site_id=p_site_id AND c.selected AND c.status='connected'
      AND c.credential_version=(p_routing->>'credentialVersion')::integer
      AND p.policy_version=(p_routing->>'policyVersion')::integer AND p.credential_version=c.credential_version FOR SHARE OF c;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer routing unavailable' USING ERRCODE='42501'; END IF;
  END IF;
  INSERT INTO public.openrouter_plan_routing(plan_id,site_id,routing) VALUES(p_plan_id,p_site_id,p_routing) ON CONFLICT DO NOTHING;
  SELECT routing INTO prior FROM public.openrouter_plan_routing WHERE plan_id=p_plan_id;
  IF prior IS DISTINCT FROM p_routing THEN RAISE EXCEPTION 'Plan routing is immutable' USING ERRCODE='40001'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.openrouter_plan_routing_pin(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.openrouter_plan_routing_pin(uuid,uuid,jsonb) TO service_role;
COMMIT;