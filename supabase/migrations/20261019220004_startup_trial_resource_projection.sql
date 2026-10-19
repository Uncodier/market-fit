BEGIN;
SET LOCAL lock_timeout = '5s';

-- Read-only execution projection for API/Temporal/provider consumers. A raw
-- settings flag is a UI mirror, NOT authorization. Consumers must use this RPC
-- immediately before execution; database RLS cannot constrain service-role code.
CREATE FUNCTION public.get_site_licensed_resources(p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.settings%ROWTYPE; b public.billing%ROWTYPE;
  plan_name text; social_limit integer; agent_limit integer; addons integer;
  social_used integer := 0; agent_used integer := 0; entry jsonb; item jsonb;
  active boolean; keep boolean; category text; all_items jsonb := '[]';
  social_result jsonb := '[]'; agent_result jsonb := '[]'; result_channels jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id=p_site_id AND archived_at IS NULL) THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.settings WHERE site_id=p_site_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id;
  IF NOT FOUND OR b.status IS DISTINCT FROM 'active' THEN RETURN NULL; END IF;
  plan_name := public.effective_site_plan(p_site_id);
  social_limit := CASE plan_name WHEN 'engine' THEN 3 WHEN 'foundry' THEN 6 WHEN 'enterprise' THEN 10 ELSE 1 END;
  agent_limit := CASE plan_name WHEN 'engine' THEN 1 WHEN 'foundry' THEN 3 WHEN 'enterprise' THEN 10 ELSE 0 END;
  addons := CASE WHEN b.stripe_subscription_id IS NULL OR (
    b.paid_subscription_invoice_id IS NOT NULL AND b.paid_subscription_period_start <= clock_timestamp()
    AND b.paid_subscription_period_end > clock_timestamp()
    AND lower(coalesce(b.subscription_status,'')) NOT IN ('canceled','cancelled','incomplete_expired'))
    THEN greatest(coalesce(b.addons_count,0),0) ELSE 0 END;
  FOREACH category IN ARRAY ARRAY['social','agent'] LOOP
    FOR item IN SELECT value FROM jsonb_array_elements(CASE WHEN category='social'
      THEN coalesce(nullif(s.social_media,'null'::jsonb),'[]')
      ELSE coalesce(nullif(s.channels->'connections','null'::jsonb),'[]') END) LOOP
      active := CASE WHEN category='social' THEN item->'isActive' IN ('true'::jsonb,'1'::jsonb)
        ELSE item->>'status'='connected' END OR coalesce((item->'_license'->>'suspended')::boolean,false);
      all_items := all_items || jsonb_build_array(jsonb_build_object('category',category,'item',item,'active',coalesce(active,false)));
    END LOOP;
  END LOOP;
  FOR entry IN SELECT value FROM jsonb_array_elements(all_items)
    ORDER BY (value->'item'->'_license'->>'order')::bigint NULLS LAST LOOP
    item := entry->'item'; category := entry->>'category'; active := (entry->>'active')::boolean; keep := false;
    IF active THEN
      IF category='social' AND social_used < social_limit THEN social_used := social_used + 1; keep := true;
      ELSIF category='agent' AND agent_used < agent_limit THEN agent_used := agent_used + 1; keep := true;
      ELSIF addons > 0 THEN addons := addons - 1; keep := true; END IF;
    END IF;
    IF active THEN
      item := item || CASE WHEN category='social' THEN jsonb_build_object('isActive',keep)
        ELSE jsonb_build_object('status',CASE WHEN keep THEN 'connected' ELSE 'license_suspended' END) END;
    END IF;
    item := item || jsonb_build_object('license_suspended',active AND NOT keep);
    IF category='social' THEN social_result := social_result || jsonb_build_array(item);
    ELSE agent_result := agent_result || jsonb_build_array(item); END IF;
  END LOOP;
  result_channels := CASE WHEN jsonb_typeof(s.channels)='object' THEN s.channels ELSE '{}'::jsonb END;
  RETURN jsonb_build_object('social_media',social_result,'channels',
    jsonb_set(result_channels,'{connections}',agent_result),'effective_plan',plan_name);
END;
$$;
REVOKE ALL ON FUNCTION public.get_site_licensed_resources(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_licensed_resources(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;