BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog;

-- New forward correction for the two genuinely absent/outdated contracts found
-- in the Makinari catalog audit. Never replay the historical migration chain.
-- Serialize inspected bodies and trigger dependencies with application writers.
LOCK TABLE public.settings, public.billing, public.sites, public.site_members,
  public.site_ownership IN SHARE ROW EXCLUSIVE MODE;
-- Capture the complete trusted function identities/ACLs, then verify replacement
-- preserves them. A body comparison alone is not a permission-boundary proof.
CREATE TEMP TABLE channel_coverage_original_contract ON COMMIT DROP AS
  SELECT oid,proname,proowner,proacl,prosecdef,provolatile,proisstrict,proconfig
  FROM pg_proc WHERE oid IN ('public.enforce_settings_license()'::regprocedure,
    'public.get_site_licensed_resources(uuid)'::regprocedure,
    'public.billing_license_changed()'::regprocedure);
DO $preflight$
DECLARE expected_function record; observed record;
BEGIN
  IF current_user <> 'postgres' OR to_regclass('public.agent_channel_activation_context') IS NOT NULL
    OR to_regprocedure('public.set_site_agent_channel_enabled(uuid,text,boolean,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Channel activation correction requires the verified initial state';
  END IF;
  FOR expected_function IN SELECT * FROM (VALUES
    ('public.enforce_settings_license()', '092236c56cac29a104553a5dff3f90c8'),
    ('public.get_site_licensed_resources(uuid)', 'deca30b77cdaf40095b9217c4a776be1'),
    ('public.billing_license_changed()', 'f4a566dc8c65edbbe847aad7b43ace54')
  ) AS definitions(signature, body_md5) LOOP
    SELECT p.* INTO observed FROM pg_proc p WHERE p.oid=to_regprocedure(expected_function.signature);
    IF NOT FOUND OR md5(observed.prosrc) <> expected_function.body_md5
      OR observed.proowner <> 'postgres'::regrole OR NOT observed.prosecdef
      OR observed.proisstrict
      OR observed.provolatile <> (CASE WHEN observed.proname='get_site_licensed_resources' THEN 's' ELSE 'v' END)
      OR observed.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp'] THEN
      RAISE EXCEPTION 'License function changed since audit: %', expected_function.signature;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.settings'::regclass
      AND tgfoid='public.enforce_settings_license()'::regprocedure AND tgenabled='O' AND NOT tgisinternal)
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.billing'::regclass
      AND tgfoid='public.billing_license_changed()'::regprocedure AND tgenabled='O' AND NOT tgisinternal)
    OR to_regprocedure('public.lock_site_license(uuid)') IS NULL
    OR to_regprocedure('public.site_member_has_effective_license(uuid)') IS NULL
    OR to_regprocedure('public.reconcile_site_member_license(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing installed license dependencies or trigger bindings';
  END IF;
  IF EXISTS (SELECT 1 FROM (VALUES
    ('public.lock_site_license(uuid)','41eb721ab66a4c702aab935dff1f98cb','postgres',true,'v',ARRAY['search_path=public, pg_temp']::text[],'{postgres=X/postgres}'),
    ('public.site_member_has_effective_license(uuid)','bfb9988c716dd8146b99f02c99a6046e','postgres',true,'s',ARRAY['search_path=public, pg_temp','row_security=off']::text[],'{postgres=X/postgres}'),
    ('public.reconcile_site_member_license(uuid)','d8e28a2e2bb063f1bf0b322aa2330a6f','postgres',true,'v',ARRAY['search_path=public, pg_temp']::text[],'{postgres=X/postgres}'),
    ('public.protect_settings_license()','9c0e6b50bd313c37d3e3c8c62d6937d0','postgres',false,'v',ARRAY['search_path=public, pg_temp']::text[],'{postgres=X/postgres}'),
    ('public.effective_site_plan(uuid)','daaddbfb9e5367b3f9f4b228284f9488','postgres',true,'s',ARRAY['search_path=public, pg_temp','row_security=off']::text[],'{postgres=X/postgres,service_role=X/postgres}')) expected(signature,body_md5,owner,definer,volatility,config,acl)
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(expected.signature)
    WHERE p.oid IS NULL OR md5(p.prosrc)<>expected.body_md5 OR pg_get_userbyid(p.proowner)<>expected.owner
      OR p.prosecdef<>expected.definer OR p.provolatile::text<>expected.volatility
      OR p.proconfig IS DISTINCT FROM expected.config OR p.proacl::text IS DISTINCT FROM expected.acl) THEN
    RAISE EXCEPTION 'License dependency contract changed since audit';
  END IF;
  IF (SELECT proacl::text FROM pg_proc WHERE oid='public.enforce_settings_license()'::regprocedure)<>'{postgres=X/postgres}'
    OR (SELECT proacl::text FROM pg_proc WHERE oid='public.billing_license_changed()'::regprocedure)<>'{postgres=X/postgres}'
    OR (SELECT proacl::text FROM pg_proc WHERE oid='public.get_site_licensed_resources(uuid)'::regprocedure)<>'{postgres=X/postgres,service_role=X/postgres}' THEN
    RAISE EXCEPTION 'Unexpected baseline license function ACL';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND
    ((tgname='license_99_enforce_settings' AND tgrelid='public.settings'::regclass
      AND tgfoid='public.enforce_settings_license()'::regprocedure AND tgtype=23)
      OR (tgname='license_10_billing_lock' AND tgrelid='public.billing'::regclass
      AND tgfoid='public.billing_license_changed()'::regprocedure AND tgtype=31)
      OR (tgname='license_20_billing_changed' AND tgrelid='public.billing'::regclass
      AND tgfoid='public.billing_license_changed()'::regprocedure AND tgtype=29)))<>3 THEN
    RAISE EXCEPTION 'Unexpected license trigger binding';
  END IF;
END;
$preflight$;

SET LOCAL lock_timeout = '5s';

-- A private, transaction-scoped capability, NOT a caller-settable GUC. Provider
-- service writes must inherit manual intent; only the authorized RPC can change it.
CREATE TABLE public.agent_channel_activation_context (
  transaction_id bigint NOT NULL,
  site_id uuid NOT NULL,
  connection_id text NOT NULL,
  PRIMARY KEY (transaction_id,site_id,connection_id)
);
ALTER TABLE public.agent_channel_activation_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_channel_activation_context FROM PUBLIC, anon, authenticated, service_role;

-- Forward-correct the installed functions rather than replacing their trusted
-- identity/duplicate/order/team logic. CREATE OR REPLACE preserves existing ACLs.
DO $migration$
DECLARE original text; corrected text; old_fragment text; new_fragment text;
BEGIN
  original := pg_get_functiondef('public.enforce_settings_license()'::regprocedure);
  old_fragment := $old$marker := coalesce(item->'_license',previous->'_license','{}');$old$;
  IF strpos(original,old_fragment)=0 THEN
    RAISE EXCEPTION 'Unexpected settings license metadata guard; reconcile prerequisites';
  END IF;
  new_fragment := $new$marker := coalesce(item->'_license',previous->'_license','{}');
      IF category='agent' AND NOT EXISTS (
        SELECT 1 FROM public.agent_channel_activation_context c
        WHERE c.transaction_id=txid_current() AND c.site_id=NEW.site_id AND c.connection_id=item->>'id'
      ) THEN
        marker := marker - 'manually_disabled' - 'manualPreviousStatus' - 'manualPreviousEnabled';
        IF previous->'_license' ? 'manually_disabled' THEN
          marker := marker || jsonb_build_object('manually_disabled',previous->'_license'->'manually_disabled');
        END IF;
        IF previous->'_license' ? 'manualPreviousStatus' THEN
          marker := marker || jsonb_build_object('manualPreviousStatus',previous->'_license'->'manualPreviousStatus');
        END IF;
        IF previous->'_license' ? 'manualPreviousEnabled' THEN
          marker := marker || jsonb_build_object('manualPreviousEnabled',previous->'_license'->'manualPreviousEnabled');
        END IF;
      END IF;$new$;
  corrected := replace(original,old_fragment,new_fragment);
  old_fragment := $old$IF NOT (item->>'status' IN ('connected','license_suspended') OR
      (item->>'type'='voice' AND item->>'status' IN ('active','synced'))) THEN marker := marker - 'suspended' - 'previousStatus'; END IF;
        active := (item->>'status' = 'connected' OR
      (item->>'type'='voice' AND item->>'status' IN ('active','synced'))) OR coalesce((marker->>'suspended')::boolean,false);$old$;
  IF strpos(corrected,old_fragment)=0 THEN
    RAISE EXCEPTION 'Unexpected settings license activity guard; apply legacy voice correction first';
  END IF;
  new_fragment := $new$IF coalesce(marker->'manually_disabled'='true'::jsonb,false) THEN
          item := item || '{"status":"disabled","enabled":false}'::jsonb;
          marker := marker - 'suspended' - 'previousStatus';
          active := false;
        ELSE
          IF NOT (item->>'status' IN ('connected','license_suspended') OR
            (item->>'type'='voice' AND item->>'status' IN ('active','synced'))) THEN
            marker := marker - 'suspended' - 'previousStatus';
          END IF;
          active := item->'enabled' IS DISTINCT FROM 'false'::jsonb AND (
            item->>'status'='connected' OR (item->>'type'='voice' AND item->>'status' IN ('active','synced'))
            OR coalesce((marker->>'suspended')::boolean,false));
        END IF;$new$;
  corrected := replace(corrected,old_fragment,new_fragment);
  EXECUTE corrected;

  original := pg_get_functiondef('public.get_site_licensed_resources(uuid)'::regprocedure);
  old_fragment := $old$active := CASE WHEN category='social' THEN item->'isActive' IN ('true'::jsonb,'1'::jsonb)
        ELSE (item->>'status'='connected' OR
      (item->>'type'='voice' AND item->>'status' IN ('active','synced'))) END OR coalesce((item->'_license'->>'suspended')::boolean,false);$old$;
  IF strpos(original,old_fragment)=0 THEN
    RAISE EXCEPTION 'Unexpected licensed resource projection; apply legacy voice correction first';
  END IF;
  new_fragment := $new$IF category='agent' AND coalesce(item->'_license'->'manually_disabled'='true'::jsonb,false) THEN
        item := item || '{"status":"disabled","enabled":false,"license_suspended":false}'::jsonb;
      END IF;
      active := CASE WHEN category='social' THEN item->'isActive' IN ('true'::jsonb,'1'::jsonb)
        OR coalesce((item->'_license'->>'suspended')::boolean,false)
        ELSE NOT coalesce(item->'_license'->'manually_disabled'='true'::jsonb,false)
          AND item->'enabled' IS DISTINCT FROM 'false'::jsonb AND (
            item->>'status'='connected' OR (item->>'type'='voice' AND item->>'status' IN ('active','synced'))
            OR coalesce((item->'_license'->>'suspended')::boolean,false)) END;$new$;
  corrected := replace(original,old_fragment,new_fragment);
  EXECUTE corrected;
END;
$migration$;

-- Actor identity is server-derived. Membership flags alone are insufficient:
-- authorize under the same site lock that serializes billing/resource changes.
CREATE FUNCTION public.set_site_agent_channel_enabled(
  p_site_id uuid,p_connection_id text,p_enabled boolean,p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  stored public.settings%ROWTYPE; target jsonb; marker jsonb; channels_result jsonb;
  before_projection jsonb; after_projection jsonb; entry jsonb; category text;
  connection_count integer; social_used integer := 0; agent_used integer := 0;
  social_limit integer; agent_limit integer; addons integer; plan_name text;
  previous_status text; previous_enabled jsonb; already_active boolean;
BEGIN
  IF p_site_id IS NULL OR p_connection_id IS NULL OR btrim(p_connection_id)='' OR
    p_enabled IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Channel activation inputs are required';
  END IF;
  PERFORM public.lock_site_license(p_site_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.sites s WHERE s.id=p_site_id AND s.archived_at IS NULL AND (
      s.user_id=p_actor_id OR EXISTS (
        SELECT 1 FROM public.site_members m WHERE m.site_id=s.id AND m.user_id=p_actor_id
          AND m.status='active' AND public.site_member_has_effective_license(m.id)
          AND (m.role IN ('owner','admin') OR EXISTS (
            SELECT 1 FROM public.site_ownership o WHERE o.site_id=s.id AND o.user_id=p_actor_id))
      )
    )
  ) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Channel activation site access denied'; END IF;
  SELECT * INTO stored FROM public.settings WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND OR jsonb_typeof(stored.channels->'connections') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Channel does not belong to site';
  END IF;
  SELECT count(*) INTO connection_count FROM jsonb_array_elements(stored.channels->'connections')
    WHERE value->>'id'=p_connection_id;
  IF connection_count<>1 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Channel must uniquely belong to site';
  END IF;
  SELECT value INTO target FROM jsonb_array_elements(stored.channels->'connections') WHERE value->>'id'=p_connection_id;
  IF NOT coalesce(target->>'status' IN ('connected','disabled','license_suspended') OR
    (target->>'type'='voice' AND target->>'status' IN ('active','synced')),false) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Only established channels can change activation';
  END IF;
  before_projection := public.get_site_licensed_resources(p_site_id);
  IF before_projection IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Channel license is unavailable';
  END IF;
  SELECT coalesce(bool_or(value->>'status' IN ('connected','active','synced')
    AND value->'enabled' IS DISTINCT FROM 'false'::jsonb AND value->'license_suspended'='false'::jsonb),false)
    INTO already_active FROM jsonb_array_elements(before_projection->'channels'->'connections') WHERE value->>'id'=p_connection_id;
  IF p_enabled AND NOT already_active THEN
    -- Admission counts ALL current effective slots, even resources added after
    -- this connection. Immutable chronological reconciliation cannot evict them.
    SELECT count(*) INTO social_used FROM jsonb_array_elements(before_projection->'social_media')
      WHERE value->'isActive' IN ('true'::jsonb,'1'::jsonb) AND value->'license_suspended'='false'::jsonb;
    SELECT count(*) INTO agent_used FROM jsonb_array_elements(before_projection->'channels'->'connections')
      WHERE (value->>'status'='connected' OR (value->>'type'='voice' AND value->>'status' IN ('active','synced')))
        AND value->'enabled' IS DISTINCT FROM 'false'::jsonb AND value->'license_suspended'='false'::jsonb;
    plan_name := public.effective_site_plan(p_site_id);
    social_limit := CASE plan_name WHEN 'engine' THEN 3 WHEN 'foundry' THEN 6 WHEN 'enterprise' THEN 10 ELSE 1 END;
    agent_limit := CASE plan_name WHEN 'engine' THEN 1 WHEN 'foundry' THEN 3 WHEN 'enterprise' THEN 10 ELSE 0 END;
    SELECT CASE WHEN stripe_subscription_id IS NULL OR (
      paid_subscription_invoice_id IS NOT NULL AND paid_subscription_period_start <= clock_timestamp()
      AND paid_subscription_period_end > clock_timestamp()
      AND lower(coalesce(subscription_status,'')) NOT IN ('canceled','cancelled','incomplete_expired'))
      THEN greatest(coalesce(addons_count,0),0) ELSE 0 END INTO addons FROM public.billing WHERE site_id=p_site_id;
    IF greatest(social_used-social_limit,0)+greatest(agent_used+1-agent_limit,0)>coalesce(addons,0) THEN
      RETURN jsonb_build_object('success',false,'code','ACCOUNT_LIMIT');
    END IF;
  END IF;
  marker := coalesce(target->'_license','{}'::jsonb);
  previous_status := CASE WHEN coalesce(marker->'manually_disabled'='true'::jsonb,false)
    THEN marker->>'manualPreviousStatus' WHEN target->>'status'='license_suspended'
    THEN marker->>'previousStatus' ELSE target->>'status' END;
  IF NOT coalesce(previous_status='connected' OR (target->>'type'='voice' AND previous_status IN ('active','synced')),false) THEN
    previous_status := 'connected';
  END IF;
  previous_enabled := CASE WHEN coalesce(marker->'manually_disabled'='true'::jsonb,false)
    THEN coalesce(marker->'manualPreviousEnabled','true'::jsonb) ELSE coalesce(target->'enabled','true'::jsonb) END;
  marker := (marker - 'suspended' - 'previousStatus') || jsonb_build_object(
    'manually_disabled',NOT p_enabled,'manualPreviousStatus',previous_status,'manualPreviousEnabled',previous_enabled);
  -- Preserve the trusted historical enabled value in the marker, but explicit
  -- activation must enable legacy rows whose old enabled flag was already false.
  target := target || jsonb_build_object('_license',marker,'status',CASE WHEN p_enabled THEN previous_status ELSE 'disabled' END,
    'enabled',p_enabled,'license_suspended',false);
  BEGIN
    INSERT INTO public.agent_channel_activation_context VALUES(txid_current(),p_site_id,p_connection_id);
    UPDATE public.settings SET channels=jsonb_set(stored.channels,'{connections}',(
      SELECT jsonb_agg(CASE WHEN value->>'id'=p_connection_id THEN target ELSE value END ORDER BY ordinality)
      FROM jsonb_array_elements(stored.channels->'connections') WITH ORDINALITY
    )),updated_at=clock_timestamp() WHERE site_id=p_site_id RETURNING channels INTO channels_result;
    DELETE FROM public.agent_channel_activation_context WHERE transaction_id=txid_current() AND site_id=p_site_id AND connection_id=p_connection_id;
    IF p_enabled THEN
      after_projection := public.get_site_licensed_resources(p_site_id);
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(after_projection->'channels'->'connections')
        WHERE value->>'id'=p_connection_id AND (value->>'status'='connected' OR
          (value->>'type'='voice' AND value->>'status' IN ('active','synced')))
          AND value->'enabled' IS DISTINCT FROM 'false'::jsonb AND value->'license_suspended'='false'::jsonb) THEN
        RAISE EXCEPTION USING ERRCODE='PML01', MESSAGE='ACCOUNT_LIMIT';
      END IF;
      FOREACH category IN ARRAY ARRAY['social','agent'] LOOP
        FOR entry IN SELECT value FROM jsonb_array_elements(CASE WHEN category='social' THEN before_projection->'social_media'
          ELSE before_projection->'channels'->'connections' END) WHERE value->'license_suspended'='false'::jsonb AND (
            CASE WHEN category='social' THEN value->'isActive' IN ('true'::jsonb,'1'::jsonb)
              ELSE (value->>'status'='connected' OR (value->>'type'='voice' AND value->>'status' IN ('active','synced')))
                AND value->'enabled' IS DISTINCT FROM 'false'::jsonb END) LOOP
          IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN category='social' THEN after_projection->'social_media'
            ELSE after_projection->'channels'->'connections' END) WHERE value->'_license'->'order'=entry->'_license'->'order'
              AND value->'license_suspended'='false'::jsonb AND (CASE WHEN category='social' THEN value->'isActive' IN ('true'::jsonb,'1'::jsonb)
                ELSE (value->>'status'='connected' OR (value->>'type'='voice' AND value->>'status' IN ('active','synced')))
                  AND value->'enabled' IS DISTINCT FROM 'false'::jsonb END)) THEN
            RAISE EXCEPTION USING ERRCODE='PML01', MESSAGE='ACCOUNT_LIMIT';
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  EXCEPTION WHEN SQLSTATE 'PML01' THEN
    -- The settings write, trigger effects and capability all roll back together.
    RETURN jsonb_build_object('success',false,'code','ACCOUNT_LIMIT');
  END;
  RETURN jsonb_build_object('success',true,'channels',channels_result);
END;
$$;
REVOKE ALL ON FUNCTION public.set_site_agent_channel_enabled(uuid,text,boolean,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_site_agent_channel_enabled(uuid,text,boolean,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';

SET LOCAL lock_timeout = '5s';

-- Dynamic trial licensing made paid coverage part of the effective plan. Keep
-- persisted resource/member mirrors in sync even when the stored tier is unchanged.
DO $$
BEGIN
  IF to_regprocedure('public.billing_license_changed()') IS NULL
    OR to_regprocedure('public.effective_site_plan(uuid)') IS NULL
    OR to_regprocedure('public.reconcile_site_member_license(uuid)') IS NULL
    OR to_regprocedure('public.lock_site_license(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Paid coverage reconciliation requires installed site and trial licensing';
  END IF;
END;
$$;

-- Replacing the existing function preserves its owner, ACLs and trigger bindings.
CREATE OR REPLACE FUNCTION public.billing_license_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_site_id uuid;
BEGIN
  target_site_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END;
  PERFORM public.lock_site_license(target_site_id);
  IF TG_WHEN = 'AFTER' THEN
    -- Usage-only writes and identical provider retries must not rewrite settings.
    -- Include every billing input used by effective_site_plan and the add-on pool.
    IF TG_OP = 'UPDATE' AND ROW(
      NEW.plan,NEW.addons_count,NEW.status,NEW.stripe_subscription_id,NEW.subscription_status,
      NEW.paid_subscription_invoice_id,NEW.paid_subscription_period_start,NEW.paid_subscription_period_end,
      NEW.trial_started_at,NEW.trial_ends_at,NEW.trial_converted_at
    ) IS NOT DISTINCT FROM ROW(
      OLD.plan,OLD.addons_count,OLD.status,OLD.stripe_subscription_id,OLD.subscription_status,
      OLD.paid_subscription_invoice_id,OLD.paid_subscription_period_start,OLD.paid_subscription_period_end,
      OLD.trial_started_at,OLD.trial_ends_at,OLD.trial_converted_at
    ) THEN RETURN NULL; END IF;
    PERFORM public.reconcile_site_member_license(target_site_id);
    UPDATE public.settings SET social_media = social_media,channels = channels WHERE settings.site_id = target_site_id;
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND NEW.site_id IS DISTINCT FROM OLD.site_id THEN RAISE EXCEPTION 'Billing site is immutable'; END IF;
  RETURN NEW;
END;
$$;

-- No backfill: this migration cannot verify legacy Stripe invoices or grant
-- missing coverage. Existing accounts require explicitly authorized recovery.

DO $postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM (VALUES
    ('public.enforce_settings_license()','a43a21cd35675dea1ba74e745fbe7ace'),
    ('public.get_site_licensed_resources(uuid)','592e0becf0934913d1445f384e27b515'),
    ('public.billing_license_changed()','3ba6bd6920fcb208d9542dbf310ff7e0')) expected(signature,body_md5)
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(expected.signature)
    WHERE p.oid IS NULL OR md5(p.prosrc)<>expected.body_md5) THEN
    RAISE EXCEPTION 'Final license function body differs from reviewed correction';
  END IF;
  IF EXISTS (SELECT 1 FROM channel_coverage_original_contract saved JOIN pg_proc current ON current.oid=saved.oid
    WHERE ROW(current.proowner,current.proacl,current.prosecdef,current.provolatile,current.proisstrict,current.proconfig)
      IS DISTINCT FROM ROW(saved.proowner,saved.proacl,saved.prosecdef,saved.provolatile,saved.proisstrict,saved.proconfig))
    OR (SELECT count(*) FROM channel_coverage_original_contract saved JOIN pg_proc current ON current.oid=saved.oid)<>3 THEN
    RAISE EXCEPTION 'License correction changed trusted identities or privileges';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.agent_channel_activation_context'::regclass
    AND relowner='postgres'::regrole AND relrowsecurity AND relkind='r')
    OR EXISTS (SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) actor
      WHERE has_any_column_privilege(actor,'public.agent_channel_activation_context','SELECT,INSERT,UPDATE,REFERENCES'))
    OR NOT has_function_privilege('service_role','public.set_site_agent_channel_enabled(uuid,text,boolean,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.set_site_agent_channel_enabled(uuid,text,boolean,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.set_site_agent_channel_enabled(uuid,text,boolean,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected channel activation authorization boundary';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.enforce_settings_license()'::regprocedure
      AND strpos(prosrc,'public.agent_channel_activation_context')>0 AND strpos(prosrc,'manually_disabled')>0)
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.get_site_licensed_resources(uuid)'::regprocedure
      AND strpos(prosrc,'manually_disabled')>0)
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.billing_license_changed()'::regprocedure
      AND strpos(prosrc,'NEW.paid_subscription_invoice_id')>0 AND strpos(prosrc,'OLD.paid_subscription_invoice_id')>0) THEN
    RAISE EXCEPTION 'License correction postconditions failed';
  END IF;
END;
$postflight$;
NOTIFY pgrst, 'reload schema';
COMMIT;
