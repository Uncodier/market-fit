BEGIN;

-- Primary ownership is one reserved seat, even without a site_members row.
ALTER TABLE public.site_members ADD COLUMN IF NOT EXISTS license_suspended boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.lock_site_license(p_site_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- REPEATABLE READ could reuse a pre-lock membership snapshot. Fail closed.
  IF current_setting('transaction_isolation') = 'repeatable read' THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'License writes require READ COMMITTED or SERIALIZABLE';
  END IF;
  PERFORM 1 FROM public.sites WHERE id = p_site_id FOR UPDATE;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_site_license(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_site_member_license(p_site_id uuid, p_member_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  owner_id uuid; plan_name text; seat_limit integer; used integer; demand integer;
BEGIN
  SELECT user_id INTO owner_id FROM public.sites WHERE id = p_site_id AND archived_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.site_members WHERE id = p_member_id AND site_id = p_site_id
  ) THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Member does not belong to site'; END IF;
  SELECT plan::text INTO plan_name FROM public.billing WHERE site_id = p_site_id;
  plan_name := CASE WHEN plan_name IN ('engine','foundry','enterprise') THEN plan_name ELSE 'commission' END;
  seat_limit := CASE plan_name WHEN 'engine' THEN 5 WHEN 'foundry' THEN 10 WHEN 'enterprise' THEN NULL ELSE 1 END;
  SELECT 1 + count(*) FILTER (WHERE NOT license_suspended AND id IS DISTINCT FROM p_member_id),
    1 + count(*) INTO used, demand
  FROM public.site_members WHERE site_id = p_site_id AND user_id IS DISTINCT FROM owner_id AND status IN ('active','pending');
  RETURN jsonb_build_object('plan',plan_name,'current',used,'total',demand,'limit',seat_limit,
    'requiredPlan',CASE WHEN used + 1 <= 1 THEN 'commission' WHEN used + 1 <= 5 THEN 'engine'
      WHEN used + 1 <= 10 THEN 'foundry' ELSE 'enterprise' END,'siteId',p_site_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_site_member_license(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_member_license(uuid,uuid) TO service_role;

-- An invoker guard sees the real DB role, not the definer's owner or a spoofable GUC.
CREATE OR REPLACE FUNCTION public.protect_member_license()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND TG_OP = 'INSERT' THEN NEW.created_at := clock_timestamp(); END IF;
  IF TG_OP = 'UPDATE' AND NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Member addition time is immutable';
  END IF;
  IF current_user IN ('anon','authenticated') AND TG_OP = 'UPDATE' AND OLD.user_id IS NULL
    AND NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation identity must match authenticated user';
  END IF;
  IF current_user IN ('anon','authenticated') AND (
    (TG_OP = 'INSERT' AND NEW.license_suspended) OR
    (TG_OP = 'UPDATE' AND NEW.license_suspended IS DISTINCT FROM OLD.license_suspended)
  ) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'License suspension is server managed'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_member_license() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_member_license()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE payload jsonb; primary_owner uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.site_id IS DISTINCT FROM OLD.site_id
    OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NOT
      (OLD.user_id IS NULL AND OLD.status = 'pending' AND NEW.status = 'active' AND NEW.user_id IS NOT NULL))) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Member identity and site are immutable';
  END IF;
  PERFORM public.lock_site_license(CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT user_id INTO primary_owner FROM public.sites WHERE id = NEW.site_id;
  IF NEW.user_id = primary_owner THEN NEW.license_suspended := false; RETURN NEW; END IF;
  IF NEW.status IN ('active','pending') AND NOT NEW.license_suspended AND (
    TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM 'active' AND OLD.status IS DISTINCT FROM 'pending') OR OLD.license_suspended
  ) THEN
    payload := public.get_site_member_license(NEW.site_id,CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END);
    IF (payload->>'limit') IS NOT NULL AND (payload->>'current')::integer >= (payload->>'limit')::integer THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MEMBER_LIMIT', DETAIL = payload::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_member_license() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER license_00_protect_member BEFORE INSERT OR UPDATE ON public.site_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_member_license();
CREATE TRIGGER license_10_guard_member BEFORE INSERT OR UPDATE OR DELETE ON public.site_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_license();

CREATE OR REPLACE FUNCTION public.reconcile_site_member_license(p_site_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE payload jsonb; owner_id uuid; capacity integer;
BEGIN
  PERFORM public.lock_site_license(p_site_id);
  SELECT user_id INTO owner_id FROM public.sites WHERE id = p_site_id;
  payload := public.get_site_member_license(p_site_id);
  -- Archived sites have no accessible RPC result, but retain their rows unchanged.
  IF payload IS NULL THEN RETURN; END IF;
  capacity := coalesce((payload->>'limit')::integer - 1,2147483646);
  WITH ranked AS (
    SELECT id,row_number() OVER (ORDER BY created_at ASC NULLS LAST,id) AS position
    FROM public.site_members WHERE site_id = p_site_id AND user_id IS DISTINCT FROM owner_id AND status IN ('active','pending')
  ) UPDATE public.site_members sm SET license_suspended = true FROM ranked r
    WHERE sm.id = r.id AND r.position > capacity AND NOT sm.license_suspended;
  WITH ranked AS (
    SELECT id,row_number() OVER (ORDER BY created_at ASC NULLS LAST,id) AS position
    FROM public.site_members WHERE site_id = p_site_id AND user_id IS DISTINCT FROM owner_id AND status IN ('active','pending')
  ) UPDATE public.site_members sm SET license_suspended = false FROM ranked r
    WHERE sm.id = r.id AND r.position <= capacity AND sm.license_suspended;
  UPDATE public.site_members SET license_suspended = false WHERE site_id = p_site_id
    AND (user_id = owner_id OR status NOT IN ('active','pending')) AND license_suspended;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_site_member_license(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.member_license_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.reconcile_site_member_license(CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.member_license_changed() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER license_20_member_changed AFTER INSERT OR DELETE OR UPDATE OF status ON public.site_members
  FOR EACH ROW EXECUTE FUNCTION public.member_license_changed();

-- Stable provider identity when available; otherwise a state-independent fingerprint.
CREATE OR REPLACE FUNCTION public.license_resource_identity(item jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(nullif(item->>'id',''),nullif(item->>'zavu_sender_id',''),nullif(item->>'zavu_invitation_id',''),
    md5((item - '_license' - 'license_suspended' - 'isActive' - 'status' - 'updated_at')::text));
$$;
REVOKE ALL ON FUNCTION public.license_resource_identity(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_settings_license()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE old_items jsonb; new_items jsonb; result jsonb; item jsonb; previous jsonb; category text;
  identity text; old_count integer; new_count integer; item_position bigint; unchanged boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.site_id IS DISTINCT FROM OLD.site_id THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Settings site is immutable';
  END IF;
  IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  FOREACH category IN ARRAY ARRAY['social','agent'] LOOP
    old_items := CASE WHEN TG_OP = 'INSERT' THEN '[]'::jsonb WHEN category = 'social' THEN OLD.social_media
      ELSE OLD.channels->'connections' END;
    new_items := CASE WHEN category = 'social' THEN NEW.social_media ELSE NEW.channels->'connections' END;
    IF new_items IS NULL OR new_items = 'null'::jsonb THEN CONTINUE; END IF;
    IF jsonb_typeof(new_items) <> 'array' THEN RAISE EXCEPTION 'Resource connections must be arrays'; END IF;
    old_items := coalesce(nullif(old_items,'null'::jsonb),'[]');
    SELECT (SELECT coalesce(jsonb_agg(value - '_license' - 'license_suspended' ORDER BY ordinality),'[]')
      FROM jsonb_array_elements(new_items) WITH ORDINALITY) =
      (SELECT coalesce(jsonb_agg(value - '_license' - 'license_suspended' ORDER BY ordinality),'[]')
      FROM jsonb_array_elements(old_items) WITH ORDINALITY) INTO unchanged;
    result := '[]'::jsonb;
    FOR item,item_position IN SELECT value,ordinality FROM jsonb_array_elements(new_items) WITH ORDINALITY LOOP
      identity := coalesce(nullif(item->>'id',''),nullif(item->>'zavu_sender_id',''),nullif(item->>'zavu_invitation_id',''),
        md5((item - '_license' - 'license_suspended' - 'isActive' - 'status' - 'updated_at')::text));
      SELECT count(*) INTO old_count FROM jsonb_array_elements(old_items)
        WHERE coalesce(nullif(value->>'id',''),nullif(value->>'zavu_sender_id',''),nullif(value->>'zavu_invitation_id',''),
          md5((value - '_license' - 'license_suspended' - 'isActive' - 'status' - 'updated_at')::text)) = identity;
      SELECT count(*) INTO new_count FROM jsonb_array_elements(new_items)
        WHERE coalesce(nullif(value->>'id',''),nullif(value->>'zavu_sender_id',''),nullif(value->>'zavu_invitation_id',''),
          md5((value - '_license' - 'license_suspended' - 'isActive' - 'status' - 'updated_at')::text)) = identity;
      IF new_count > greatest(1,old_count) THEN RAISE EXCEPTION 'Duplicate resource identity'; END IF;
      IF old_count > 1 AND NOT coalesce(item->'_license' ? 'order',false) AND NOT unchanged THEN
        RAISE EXCEPTION 'Legacy duplicate resources require stored license metadata';
      END IF;
      SELECT value INTO previous FROM jsonb_array_elements(old_items) WITH ORDINALITY
        WHERE coalesce(nullif(value->>'id',''),nullif(value->>'zavu_sender_id',''),nullif(value->>'zavu_invitation_id',''),
          md5((value - '_license' - 'license_suspended' - 'isActive' - 'status' - 'updated_at')::text)) = identity
          AND (old_count <= 1 OR CASE WHEN item->'_license' ? 'order'
            THEN value->'_license'->'order' = item->'_license'->'order' ELSE ordinality = item_position END)
        ORDER BY ordinality LIMIT 1;
      IF (item ? '_license' AND item->'_license' IS DISTINCT FROM previous->'_license') OR
        (item ? 'license_suspended' AND item->'license_suspended' IS DISTINCT FROM coalesce(previous->'license_suspended','false')) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Resource license metadata is server managed';
      END IF;
      item := item - '_license' - 'license_suspended';
      IF previous ? '_license' THEN item := item || jsonb_build_object('_license',previous->'_license',
        'license_suspended',coalesce(previous->'license_suspended','false')); END IF;
      result := result || jsonb_build_array(item);
    END LOOP;
    IF category = 'social' THEN NEW.social_media := result;
    ELSE NEW.channels := jsonb_set(NEW.channels,'{connections}',result); END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_settings_license() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_settings_license()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  plan_name text; addons integer; social_limit integer; agent_limit integer; max_order bigint := 0;
  all_items jsonb := '[]'; social_result jsonb := '[]'; agent_result jsonb := '[]';
  old_items jsonb; new_items jsonb; item jsonb; previous jsonb; marker jsonb; identity text;
  category text; entry jsonb; active boolean; social_used integer := 0; agent_used integer := 0;
  keep boolean; seen text[] := '{}'; seen_orders bigint[] := '{}'; old_count integer; occurrence integer;
  item_position bigint; unchanged boolean;
BEGIN
  PERFORM public.lock_site_license(NEW.site_id);
  SELECT plan::text,greatest(coalesce(addons_count,0),0) INTO plan_name,addons FROM public.billing WHERE site_id = NEW.site_id;
  addons := coalesce(addons,0);
  social_limit := CASE plan_name WHEN 'engine' THEN 3 WHEN 'foundry' THEN 6 WHEN 'enterprise' THEN 10 ELSE 1 END;
  agent_limit := CASE plan_name WHEN 'engine' THEN 1 WHEN 'foundry' THEN 3 WHEN 'enterprise' THEN 10 ELSE 0 END;
  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(max((value->'_license'->>'order')::bigint),0) INTO max_order FROM jsonb_array_elements(
      coalesce(nullif(OLD.social_media,'null'::jsonb),'[]') || coalesce(nullif(OLD.channels->'connections','null'::jsonb),'[]'));
  END IF;
  FOREACH category IN ARRAY ARRAY['social','agent'] LOOP
    new_items := CASE WHEN category = 'social' THEN NEW.social_media ELSE NEW.channels->'connections' END;
    old_items := CASE WHEN TG_OP = 'INSERT' THEN '[]'::jsonb WHEN category = 'social' THEN OLD.social_media ELSE OLD.channels->'connections' END;
    IF new_items IS NULL OR new_items = 'null'::jsonb THEN CONTINUE; END IF;
    IF jsonb_typeof(new_items) <> 'array' THEN RAISE EXCEPTION 'Resource connections must be arrays'; END IF;
    old_items := coalesce(nullif(old_items,'null'::jsonb),'[]');
    SELECT (SELECT coalesce(jsonb_agg(value - '_license' - 'license_suspended' ORDER BY ordinality),'[]')
      FROM jsonb_array_elements(new_items) WITH ORDINALITY) =
      (SELECT coalesce(jsonb_agg(value - '_license' - 'license_suspended' ORDER BY ordinality),'[]')
      FROM jsonb_array_elements(old_items) WITH ORDINALITY) INTO unchanged;
    FOR item,item_position IN SELECT value,ordinality FROM jsonb_array_elements(new_items) WITH ORDINALITY LOOP
      IF jsonb_typeof(item) <> 'object' THEN RAISE EXCEPTION 'Resource connections must be objects'; END IF;
      identity := category || ':' || public.license_resource_identity(item);
      SELECT count(*) INTO old_count FROM jsonb_array_elements(old_items)
        WHERE public.license_resource_identity(value) = public.license_resource_identity(item);
      SELECT 1 + count(*) INTO occurrence FROM unnest(seen) AS existing(key) WHERE key = identity;
      -- Grandfather only stored duplicates; each occurrence still consumes capacity.
      IF occurrence > greatest(1,old_count) THEN RAISE EXCEPTION 'Duplicate resource identity'; END IF;
      seen := array_append(seen,identity);
      IF old_count > 1 AND NOT coalesce(item->'_license' ? 'order',false) AND NOT unchanged THEN
        RAISE EXCEPTION 'Legacy duplicate resources require stored license metadata';
      END IF;
      -- Match duplicate rows by their trusted stored order. Only unchanged arrays
      -- may omit metadata, including the first backfill before orders exist.
      SELECT value INTO previous FROM jsonb_array_elements(old_items) WITH ORDINALITY
        WHERE public.license_resource_identity(value) = public.license_resource_identity(item)
          AND (old_count <= 1 OR CASE WHEN item->'_license' ? 'order'
            THEN value->'_license'->'order' = item->'_license'->'order' ELSE ordinality = item_position END)
        ORDER BY ordinality LIMIT 1;
      IF old_count > 1 AND previous IS NULL THEN
        RAISE EXCEPTION 'Legacy duplicate resources require stored license metadata';
      END IF;
      -- Order is always inherited from stored state; even provider writes cannot reorder age.
      marker := coalesce(item->'_license',previous->'_license','{}');
      IF previous->'_license' ? 'order' THEN marker := marker || jsonb_build_object('order',previous->'_license'->'order');
      ELSE max_order := max_order + 1; marker := marker || jsonb_build_object('order',max_order); END IF;
      IF (marker->>'order')::bigint = ANY(seen_orders) THEN RAISE EXCEPTION 'Duplicate resource license order'; END IF;
      seen_orders := array_append(seen_orders,(marker->>'order')::bigint);
      IF category = 'social' THEN
        active := item->'isActive' IN ('true'::jsonb,'1'::jsonb) OR coalesce((marker->>'suspended')::boolean,false);
      ELSE
        -- A manual non-license disconnect cancels restoration; never reconnect it later.
        IF item->>'status' NOT IN ('connected','license_suspended') THEN marker := marker - 'suspended' - 'previousStatus'; END IF;
        active := item->>'status' = 'connected' OR coalesce((marker->>'suspended')::boolean,false);
      END IF;
      all_items := all_items || jsonb_build_array(jsonb_build_object('category',category,'item',item,'marker',marker,'active',coalesce(active,false)));
    END LOOP;
  END LOOP;
  -- Base quotas are independent; excesses compete for ONE pool by immutable addition order.
  FOR entry IN SELECT value FROM jsonb_array_elements(all_items) ORDER BY (value->'marker'->>'order')::bigint LOOP
    item := entry->'item'; marker := entry->'marker'; category := entry->>'category'; active := (entry->>'active')::boolean;
    keep := false;
    IF active THEN
      IF category = 'social' AND social_used < social_limit THEN social_used := social_used + 1; keep := true;
      ELSIF category = 'agent' AND agent_used < agent_limit THEN agent_used := agent_used + 1; keep := true;
      ELSIF addons > 0 THEN addons := addons - 1; keep := true; END IF;
    END IF;
    IF active AND NOT keep THEN
      IF NOT coalesce((marker->>'suspended')::boolean,false) THEN
        marker := marker || CASE WHEN category = 'social' THEN jsonb_build_object('previousIsActive',item->'isActive')
          ELSE jsonb_build_object('previousStatus',item->'status') END;
      END IF;
      marker := marker || '{"suspended":true}'::jsonb;
      item := item || CASE WHEN category = 'social' THEN '{"isActive":false}'::jsonb ELSE '{"status":"license_suspended"}'::jsonb END;
    ELSE
      IF keep AND coalesce((marker->>'suspended')::boolean,false) THEN
        item := item || CASE WHEN category = 'social' THEN jsonb_build_object('isActive',coalesce(marker->'previousIsActive','true'))
          ELSE jsonb_build_object('status',coalesce(marker->'previousStatus','"connected"')) END;
      END IF;
      marker := marker - 'suspended' - 'previousIsActive' - 'previousStatus';
    END IF;
    item := item || jsonb_build_object('_license',marker,'license_suspended',active AND NOT keep);
    IF category = 'social' THEN social_result := social_result || jsonb_build_array(item);
    ELSE agent_result := agent_result || jsonb_build_array(item); END IF;
  END LOOP;
  IF NEW.social_media IS NOT NULL AND NEW.social_media <> 'null'::jsonb THEN NEW.social_media := social_result; END IF;
  IF NEW.channels ? 'connections' THEN NEW.channels := jsonb_set(NEW.channels,'{connections}',agent_result); END IF;
  -- Legacy/browser writers may send team_members themselves. Always derive the
  -- automation mirror from licensed active membership, never from that payload.
  SELECT coalesce(jsonb_agg(jsonb_build_object('email',sm.email,'role',CASE sm.role
    WHEN 'admin' THEN 'admin' WHEN 'marketing' THEN 'create' ELSE 'view' END,
    'name',coalesce(sm.name,''),'position',coalesce(sm.position,'')) ORDER BY sm.created_at,sm.id),'[]')
    INTO NEW.team_members FROM public.site_members sm WHERE sm.site_id = NEW.site_id
    AND sm.status = 'active' AND sm.role <> 'owner' AND NOT sm.license_suspended;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_settings_license() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER license_00_protect_settings BEFORE INSERT OR UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.protect_settings_license();
CREATE TRIGGER license_99_enforce_settings BEFORE INSERT OR UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_settings_license();

CREATE OR REPLACE FUNCTION public.billing_license_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_site_id uuid;
BEGIN
  target_site_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END;
  PERFORM public.lock_site_license(target_site_id);
  IF TG_WHEN = 'AFTER' THEN
    IF TG_OP = 'UPDATE' AND NEW.plan IS NOT DISTINCT FROM OLD.plan
      AND NEW.addons_count IS NOT DISTINCT FROM OLD.addons_count THEN RETURN NULL; END IF;
    PERFORM public.reconcile_site_member_license(target_site_id);
    UPDATE public.settings SET social_media = social_media,channels = channels WHERE settings.site_id = target_site_id;
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND NEW.site_id IS DISTINCT FROM OLD.site_id THEN RAISE EXCEPTION 'Billing site is immutable'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_license_changed() FROM PUBLIC, anon, authenticated, service_role;
-- Observe all updates: earlier financial triggers can change the effective plan
-- even when the caller only writes subscription status.
CREATE TRIGGER license_10_billing_lock BEFORE INSERT OR DELETE OR UPDATE ON public.billing
  FOR EACH ROW EXECUTE FUNCTION public.billing_license_changed();
CREATE TRIGGER license_20_billing_changed AFTER INSERT OR DELETE OR UPDATE ON public.billing
  FOR EACH ROW EXECUTE FUNCTION public.billing_license_changed();

CREATE OR REPLACE FUNCTION public.site_owner_license_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR (OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL) THEN
    PERFORM public.reconcile_site_member_license(NEW.id);
    UPDATE public.settings SET social_media = social_media,channels = channels WHERE site_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.site_owner_license_changed() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER license_site_owner_changed AFTER UPDATE OF user_id,archived_at ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.site_owner_license_changed();

CREATE OR REPLACE FUNCTION public.current_user_site_role(p_site_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE member_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND archived_at IS NULL) THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND user_id = auth.uid()) THEN RETURN 'owner'; END IF;
  SELECT sm.role::text INTO member_role FROM public.site_members sm
    WHERE sm.site_id = p_site_id AND sm.user_id = auth.uid() AND sm.status = 'active' AND NOT sm.license_suspended LIMIT 1;
  IF member_role IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.site_ownership WHERE site_id = p_site_id AND user_id = auth.uid()) THEN RETURN 'owner'; END IF;
  RETURN member_role;
END;
$$;
REVOKE ALL ON FUNCTION public.current_user_site_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_site_role(uuid) TO anon, authenticated, service_role;
-- user_can and capability RPC already delegate to current_user_site_role.
CREATE OR REPLACE FUNCTION public.get_my_accessible_sites()
RETURNS SETOF public.sites LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT s.* FROM public.sites s WHERE s.archived_at IS NULL AND public.current_user_site_role(s.id) IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_my_accessible_sites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_accessible_sites() TO authenticated, service_role;

-- Existing permissive policies contain direct active-member checks. A restrictive
-- layer prevents those checks from bypassing the shared suspension-aware role.
CREATE POLICY license_sites_access ON public.sites AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_user_site_role(id) IS NOT NULL)
  WITH CHECK (user_id = auth.uid() OR public.current_user_site_role(id) IS NOT NULL);
CREATE POLICY license_members_access ON public.site_members AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_user_site_role(site_id) IS NOT NULL)
  WITH CHECK (public.current_user_site_role(site_id) IS NOT NULL);
CREATE POLICY license_settings_access ON public.settings AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_user_site_role(site_id) IS NOT NULL)
  WITH CHECK (public.current_user_site_role(site_id) IS NOT NULL);
DROP POLICY IF EXISTS "Service role can manage all partner licenses" ON public.partner_licenses;
CREATE POLICY "Service role can manage all partner licenses" ON public.partner_licenses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Keep the existing JSON mapping (marketing=create, collaborator=view) unchanged.
-- Both deployed sync triggers must exclude suspended members; a suspension-only
-- trigger also covers installations whose older trigger watches selected fields.
CREATE OR REPLACE FUNCTION public.sync_site_members_to_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE affected_site_id uuid; team_members_json jsonb;
BEGIN
  affected_site_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END;
  IF current_setting('app.deleting_site',true) = affected_site_id::text OR
    NOT EXISTS (SELECT 1 FROM public.sites WHERE id = affected_site_id) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('email',sm.email,'role',CASE sm.role
    WHEN 'admin' THEN 'admin' WHEN 'marketing' THEN 'create' ELSE 'view' END,
    'name',coalesce(sm.name,''),'position',coalesce(sm.position,'')) ORDER BY sm.created_at,sm.id),'[]')
    INTO team_members_json FROM public.site_members sm
    WHERE sm.site_id = affected_site_id AND sm.status = 'active' AND sm.role <> 'owner' AND NOT sm.license_suspended;
  UPDATE public.settings SET team_members = team_members_json,updated_at = now() WHERE site_id = affected_site_id;
  IF NOT FOUND THEN
    INSERT INTO public.settings(site_id,team_members,created_at,updated_at) VALUES (affected_site_id,team_members_json,now(),now())
      ON CONFLICT(site_id) DO UPDATE SET team_members = excluded.team_members,updated_at = now();
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.sync_site_members_to_team_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Preserve the existing recursion sentinel (not an authorization bypass).
  IF current_setting('site_members.is_updating',true) = 'true' THEN RETURN NULL; END IF;
  PERFORM set_config('site_members.is_updating','true',true);
  PERFORM public.sync_site_members_license_json(CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END);
  PERFORM set_config('site_members.is_updating','false',true);
  RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.sync_site_members_license_json(p_site_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.settings SET team_members = (
    SELECT coalesce(jsonb_agg(jsonb_build_object('email',sm.email,'role',CASE sm.role
      WHEN 'admin' THEN 'admin' WHEN 'marketing' THEN 'create' ELSE 'view' END,
      'name',coalesce(sm.name,''),'position',coalesce(sm.position,'')) ORDER BY sm.created_at,sm.id),'[]')
    FROM public.site_members sm WHERE sm.site_id = p_site_id AND sm.status = 'active'
      AND sm.role <> 'owner' AND NOT sm.license_suspended
  ) WHERE site_id = p_site_id;
$$;
REVOKE ALL ON FUNCTION public.sync_site_members_to_settings(),public.sync_site_members_to_team_members(),
  public.sync_site_members_license_json(uuid) FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER license_25_member_sync AFTER INSERT OR DELETE OR UPDATE ON public.site_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_site_members_to_settings();

-- Backfill without removing memberships/resources or changing financial guards/grants.
DO $$ DECLARE site_record record; BEGIN
  FOR site_record IN SELECT id FROM public.sites ORDER BY id LOOP
    PERFORM public.reconcile_site_member_license(site_record.id);
    PERFORM public.sync_site_members_license_json(site_record.id);
    UPDATE public.settings SET social_media = social_media,channels = channels WHERE site_id = site_record.id;
  END LOOP;
END; $$;
NOTIFY pgrst, 'reload schema';
COMMIT;