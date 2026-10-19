BEGIN;
SET LOCAL lock_timeout = '5s';

-- Access is ranked at statement time, not by the last cron/reconcile flag.
-- Pending invites reserve their chronological seat; manual disable remains final.
CREATE FUNCTION public.site_member_has_effective_license(p_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT coalesce((
    SELECT NOT m.manually_disabled AND (m.user_id = s.user_id OR (
      SELECT count(*) FROM public.site_members earlier
      WHERE earlier.site_id=m.site_id AND earlier.user_id IS DISTINCT FROM s.user_id
        AND earlier.status IN ('active','pending') AND NOT earlier.manually_disabled
        AND (coalesce(earlier.created_at,'infinity'::timestamptz),earlier.id)
          <= (coalesce(m.created_at,'infinity'::timestamptz),m.id)
    ) < CASE public.effective_site_plan(m.site_id)
      WHEN 'engine' THEN 5 WHEN 'foundry' THEN 10 WHEN 'enterprise' THEN 2147483647 ELSE 1 END)
    FROM public.site_members m JOIN public.sites s ON s.id=m.site_id
    WHERE m.id=p_member_id AND s.archived_at IS NULL AND m.status IN ('active','pending')
  ),false);
$$;
REVOKE ALL ON FUNCTION public.site_member_has_effective_license(uuid) FROM PUBLIC, anon, authenticated, service_role;

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
  plan_name := public.effective_site_plan(p_site_id);
  plan_name := CASE WHEN plan_name IN ('engine','foundry','enterprise') THEN plan_name ELSE 'commission' END;
  seat_limit := CASE plan_name WHEN 'engine' THEN 5 WHEN 'foundry' THEN 10 WHEN 'enterprise' THEN NULL ELSE 1 END;
  SELECT 1 + count(*) FILTER (WHERE public.site_member_has_effective_license(id) AND id IS DISTINCT FROM p_member_id),
    1 + count(*) INTO used, demand
  FROM public.site_members WHERE site_id = p_site_id AND user_id IS DISTINCT FROM owner_id
    AND status IN ('active','pending') AND NOT manually_disabled;
  RETURN jsonb_build_object('plan',plan_name,'current',used,'total',demand,'limit',seat_limit,
    'requiredPlan',CASE WHEN used + 1 <= 1 THEN 'commission' WHEN used + 1 <= 5 THEN 'engine'
      WHEN used + 1 <= 10 THEN 'foundry' ELSE 'enterprise' END,'siteId',p_site_id);
END;
$$;

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
  SELECT public.effective_site_plan(NEW.site_id),CASE WHEN stripe_subscription_id IS NULL OR (
    paid_subscription_invoice_id IS NOT NULL AND paid_subscription_period_start <= clock_timestamp()
    AND paid_subscription_period_end > clock_timestamp()
    AND lower(coalesce(subscription_status,'')) NOT IN ('canceled','cancelled','incomplete_expired'))
    THEN greatest(coalesce(addons_count,0),0) ELSE 0 END INTO plan_name,addons FROM public.billing WHERE site_id = NEW.site_id;
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
    AND sm.status = 'active' AND sm.role <> 'owner' AND public.site_member_has_effective_license(sm.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_license_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_site_id uuid;
BEGIN
  target_site_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END;
  PERFORM public.lock_site_license(target_site_id);
  IF TG_WHEN = 'AFTER' THEN
    IF TG_OP = 'UPDATE' AND NEW.plan IS NOT DISTINCT FROM OLD.plan
      AND NEW.addons_count IS NOT DISTINCT FROM OLD.addons_count
      AND NEW.trial_started_at IS NOT DISTINCT FROM OLD.trial_started_at
      AND NEW.trial_ends_at IS NOT DISTINCT FROM OLD.trial_ends_at
      AND NEW.trial_converted_at IS NOT DISTINCT FROM OLD.trial_converted_at THEN RETURN NULL; END IF;
    PERFORM public.reconcile_site_member_license(target_site_id);
    UPDATE public.settings SET social_media = social_media,channels = channels WHERE settings.site_id = target_site_id;
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND NEW.site_id IS DISTINCT FROM OLD.site_id THEN RAISE EXCEPTION 'Billing site is immutable'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_site_role(p_site_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE member_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND archived_at IS NULL) THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND user_id = auth.uid()) THEN RETURN 'owner'; END IF;
  SELECT sm.role::text INTO member_role FROM public.site_members sm
    WHERE sm.site_id = p_site_id AND sm.user_id = auth.uid() AND sm.status = 'active' AND public.site_member_has_effective_license(sm.id) LIMIT 1;
  IF member_role IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.site_ownership WHERE site_id = p_site_id AND user_id = auth.uid()) THEN RETURN 'owner'; END IF;
  RETURN member_role;
END;
$$;

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
    WHERE sm.site_id = affected_site_id AND sm.status = 'active' AND sm.role <> 'owner' AND public.site_member_has_effective_license(sm.id);
  UPDATE public.settings SET team_members = team_members_json,updated_at = now() WHERE site_id = affected_site_id;
  IF NOT FOUND THEN
    INSERT INTO public.settings(site_id,team_members,created_at,updated_at) VALUES (affected_site_id,team_members_json,now(),now())
      ON CONFLICT(site_id) DO UPDATE SET team_members = excluded.team_members,updated_at = now();
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_site_members_license_json(p_site_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.settings SET team_members = (
    SELECT coalesce(jsonb_agg(jsonb_build_object('email',sm.email,'role',CASE sm.role
      WHEN 'admin' THEN 'admin' WHEN 'marketing' THEN 'create' ELSE 'view' END,
      'name',coalesce(sm.name,''),'position',coalesce(sm.position,'')) ORDER BY sm.created_at,sm.id),'[]')
    FROM public.site_members sm WHERE sm.site_id = p_site_id AND sm.status = 'active'
      AND sm.role <> 'owner' AND public.site_member_has_effective_license(sm.id)
  ) WHERE site_id = p_site_id;
$$;

CREATE OR REPLACE FUNCTION public.apply_site_partner_license(p_license_key uuid,p_site_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  partner_record public.partner_licenses%ROWTYPE;
  billing_record public.billing%ROWTYPE;
  target_plan text;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sites s WHERE s.id = p_site_id AND s.archived_at IS NULL AND (
      s.user_id = p_actor_id OR EXISTS (SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = p_actor_id AND sm.status = 'active'
          AND public.site_member_has_effective_license(sm.id) AND (sm.role IN ('owner','admin') OR EXISTS (
            SELECT 1 FROM public.site_ownership so WHERE so.site_id = s.id AND so.user_id = p_actor_id)))
    )
  ) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Partner license site access denied'; END IF;
  PERFORM public.lock_site_license(p_site_id);
  -- Recheck after taking the site lock: a concurrent license expiry/ownership transfer
  -- must not authorize a stale manager decision.
  IF NOT EXISTS (
    SELECT 1 FROM public.sites s WHERE s.id = p_site_id AND s.archived_at IS NULL AND (
      s.user_id = p_actor_id OR EXISTS (SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = p_actor_id AND sm.status = 'active'
          AND public.site_member_has_effective_license(sm.id) AND (sm.role IN ('owner','admin') OR EXISTS (
            SELECT 1 FROM public.site_ownership so WHERE so.site_id = s.id AND so.user_id = p_actor_id)))
    )
  ) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Partner license site access denied'; END IF;
  SELECT * INTO partner_record FROM public.partner_licenses WHERE license_key = p_license_key FOR UPDATE;
  IF NOT FOUND OR partner_record.user_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Partner license ownership denied';
  END IF;
  IF partner_record.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Partner license is not active';
  END IF;
  IF partner_record.site_id IS NOT NULL AND partner_record.site_id <> p_site_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARTNER_LICENSE_LINKED';
  END IF;
  SELECT * INTO billing_record FROM public.billing WHERE site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARTNER_BILLING_MISSING'; END IF;
  IF billing_record.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARTNER_STRIPE_CONFLICT';
  END IF;
  target_plan := CASE WHEN lower(coalesce(partner_record.plan_name,'')) LIKE '%foundry%'
    OR lower(coalesce(partner_record.plan_name,'')) LIKE '%tier 2%'
    OR lower(coalesce(partner_record.plan_name,'')) LIKE '%tier2%' THEN 'foundry' ELSE 'engine' END;
  UPDATE public.partner_licenses SET site_id = p_site_id WHERE id = partner_record.id AND user_id = p_actor_id;
  -- Existing financial triggers own credit bucket transitions. Never touch balances.
  UPDATE public.billing SET plan = target_plan,subscription_status = 'active',auto_renew = false,updated_at = now()
    WHERE id = billing_record.id;
  RETURN jsonb_build_object('success',true,'plan',target_plan);
END;
$$;

-- API bearer-user authorization cannot use cached ownership/member flags.
-- The caller supplies only its authenticated actor, never a browser-owned ID.
CREATE FUNCTION public.site_user_has_effective_access(p_site_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sites s WHERE s.id=p_site_id AND s.archived_at IS NULL
      AND (s.user_id=p_user_id OR EXISTS (
        SELECT 1 FROM public.site_members m WHERE m.site_id=s.id AND m.user_id=p_user_id
          AND m.status='active' AND public.site_member_has_effective_license(m.id)
      ))
  );
$$;
REVOKE ALL ON FUNCTION public.site_user_has_effective_access(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_user_has_effective_access(uuid,uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
