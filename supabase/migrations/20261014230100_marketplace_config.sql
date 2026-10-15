BEGIN;
-- Validate trusted server actor against the same suspension/archive-aware native
-- helpers used by user-scoped routes. Restore JWT context before returning.
CREATE FUNCTION public.marketplace_assert_actor(p_site_id uuid,p_actor_user_id uuid,p_manager boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE claims text := current_setting('request.jwt.claims',true);
  subject text := current_setting('request.jwt.claim.sub',true); allowed boolean; actor_role text;
BEGIN
  IF NOT public.marketplace_is_backend() OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Marketplace backend actor required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_user_id,'role','service_role')::text,true);
  PERFORM set_config('request.jwt.claim.sub',p_actor_user_id::text,true);
  actor_role := public.current_user_site_role(p_site_id);
  allowed := public.user_can(p_site_id,'update') AND (NOT p_manager OR actor_role IN ('owner','admin'));
  PERFORM set_config('request.jwt.claims',coalesce(claims,''),true);
  PERFORM set_config('request.jwt.claim.sub',coalesce(subject,''),true);
  IF allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Marketplace actor has insufficient site permission' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_assert_actor(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_assert_actor(uuid,uuid,boolean) TO service_role;

CREATE FUNCTION public.save_marketplace_integration(p_config jsonb,p_secret_id uuid,
  p_encrypted_credentials text,p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE integration public.marketplace_integrations; existing public.marketplace_integrations;
  integration_id uuid := (p_config->>'id')::uuid; site uuid := (p_config->>'site_id')::uuid;
  location uuid := (p_config->>'origin_location_id')::uuid;
BEGIN
  PERFORM public.marketplace_assert_actor(site,p_actor_user_id,true);
  IF integration_id IS NULL OR p_secret_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.locations WHERE id = location AND site_id = site AND is_active
  ) THEN RAISE EXCEPTION 'Invalid marketplace configuration'; END IF;
  SELECT * INTO existing FROM public.marketplace_integrations WHERE id = integration_id FOR UPDATE;
  IF FOUND AND (existing.site_id IS DISTINCT FROM site OR existing.secret_id IS DISTINCT FROM p_secret_id
    OR existing.provider IS DISTINCT FROM p_config->>'provider'
    OR existing.environment IS DISTINCT FROM p_config->>'environment'
    OR existing.external_store_id IS DISTINCT FROM p_config->>'external_store_id') THEN
    RAISE EXCEPTION 'Marketplace integration identity is immutable';
  END IF;
  IF existing.id IS NULL AND p_encrypted_credentials IS NULL THEN
    RAISE EXCEPTION 'Encrypted marketplace credentials required';
  END IF;
  IF p_encrypted_credentials IS NOT NULL THEN
    IF length(p_encrypted_credentials) NOT BETWEEN 16 AND 32768 THEN
      RAISE EXCEPTION 'Invalid encrypted marketplace credentials';
    END IF;
    IF EXISTS (SELECT 1 FROM public.site_secrets WHERE id = p_secret_id AND (
      site_id IS DISTINCT FROM site OR use_case IS DISTINCT FROM 'marketplace:'||integration_id::text
      OR provider IS DISTINCT FROM p_config->>'provider' OR instance_id IS NOT NULL
    )) THEN RAISE EXCEPTION 'Reserved secret identity mismatch'; END IF;
    INSERT INTO public.site_secrets(id,site_id,instance_id,name,provider,use_case,encrypted_value)
    VALUES(p_secret_id,site,NULL,'Marketplace credentials',p_config->>'provider',
      'marketplace:'||integration_id::text,p_encrypted_credentials)
    ON CONFLICT(id) DO UPDATE SET encrypted_value = excluded.encrypted_value, updated_at = now();
  END IF;
  INSERT INTO public.marketplace_integrations(id,site_id,provider,environment,country,external_store_id,
    origin_location_id,secret_id,enabled,manual_ready,created_by_user_id)
  VALUES(integration_id,site,p_config->>'provider',p_config->>'environment',p_config->>'country',
    p_config->>'external_store_id',location,p_secret_id,coalesce((p_config->>'enabled')::boolean,false),
    coalesce((p_config->>'manual_ready')::boolean,false),p_actor_user_id)
  ON CONFLICT(id) DO UPDATE SET country = excluded.country,origin_location_id = excluded.origin_location_id,
    enabled = excluded.enabled,manual_ready = excluded.manual_ready,updated_at = now()
  RETURNING * INTO integration;
  RETURN to_jsonb(integration);
END;
$$;
REVOKE ALL ON FUNCTION public.save_marketplace_integration(jsonb,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_marketplace_integration(jsonb,uuid,text,uuid) TO service_role;

-- Defend direct server writes too: integration and credential tenant identities
-- are immutable. Browser writes have no grants, regardless of existing policies.
CREATE FUNCTION public.validate_marketplace_integration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.marketplace_is_backend() THEN
    RAISE EXCEPTION 'Marketplace configuration is backend-owned' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id,NEW.site_id,NEW.provider,NEW.environment,NEW.external_store_id,
    NEW.secret_id,NEW.created_by_user_id) IS DISTINCT FROM (OLD.id,OLD.site_id,OLD.provider,OLD.environment,
    OLD.external_store_id,OLD.secret_id,OLD.created_by_user_id) THEN
    RAISE EXCEPTION 'Marketplace integration identity is immutable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id = NEW.origin_location_id AND site_id = NEW.site_id AND is_active)
    OR NOT EXISTS (SELECT 1 FROM public.site_secrets WHERE id = NEW.secret_id AND site_id = NEW.site_id
      AND provider = NEW.provider AND use_case = 'marketplace:'||NEW.id::text AND instance_id IS NULL) THEN
    RAISE EXCEPTION 'Marketplace location or native secret tenant mismatch';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_marketplace_integration() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER marketplace_integration_identity BEFORE INSERT OR UPDATE ON public.marketplace_integrations
  FOR EACH ROW EXECUTE FUNCTION public.validate_marketplace_integration();

CREATE FUNCTION public.preserve_marketplace_secret_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.marketplace_integrations WHERE secret_id = OLD.id) THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Reserved marketplace secret is linked'; END IF;
    IF (NEW.id,NEW.site_id,NEW.provider,NEW.use_case,NEW.instance_id) IS DISTINCT FROM
      (OLD.id,OLD.site_id,OLD.provider,OLD.use_case,OLD.instance_id) THEN
      RAISE EXCEPTION 'Reserved marketplace secret identity is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.preserve_marketplace_secret_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER marketplace_secret_identity BEFORE UPDATE OR DELETE ON public.site_secrets
  FOR EACH ROW EXECUTE FUNCTION public.preserve_marketplace_secret_identity();
COMMIT;