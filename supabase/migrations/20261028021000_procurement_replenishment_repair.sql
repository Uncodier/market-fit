BEGIN;

-- Retire unsafe batching: PostgreSQL cannot release inventory/queue locks between
-- loop iterations. The HTTP worker must issue one RPC transaction per rule.
CREATE OR REPLACE FUNCTION public.process_procurement_replenishment(p_limit integer DEFAULT 1) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job record; actor uuid; result jsonb; claims text;
BEGIN
  IF p_limit IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Worker limit must be 1; use separate RPC transactions' USING ERRCODE='22023'; END IF;
  -- Claim only the worker, never a queue row before inventory. This transaction
  -- claim releases on success, rollback or disconnect; no abandoned lease exists.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('procurement_replenishment_worker',0)) THEN
    RETURN jsonb_build_object('processed',0,'failed',0,'busy',true); END IF;
  SELECT rule_id,site_id,generation INTO job FROM public.procurement_replenishment_queue
    WHERE generation>evaluated_generation ORDER BY updated_at,rule_id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('processed',0,'failed',0,'busy',false); END IF;
  claims:=current_setting('request.jwt.claims',true);
  BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('procurement_replenishment:'||job.site_id::text,0));
    SELECT updated_by INTO STRICT actor FROM public.procurement_replenishment_rules
      WHERE id=job.rule_id AND site_id=job.site_id FOR UPDATE;
    -- The saved manager delegated this rule only. The existing evaluator checks
    -- current membership, license, location scope and write permission again.
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    result:=public.evaluate_procurement_replenishment_rule(job.site_id,job.rule_id);
    -- A stock/rule event arriving during evaluation advances generation, not the
    -- snapshot being acknowledged. It remains pending after this transaction.
    UPDATE public.procurement_replenishment_queue SET evaluated_generation=job.generation,
      last_result=result,last_error=NULL,evaluated_at=clock_timestamp() WHERE rule_id=job.rule_id;
  EXCEPTION WHEN OTHERS THEN
    -- Partial drafts and all evaluation locks roll back before acknowledging a
    -- failure. Only a fresh stock/rule event retries this consumed generation.
    PERFORM set_config('request.jwt.claims',COALESCE(claims,''),true);
    UPDATE public.procurement_replenishment_queue SET evaluated_generation=job.generation,last_result=NULL,
      last_error=CASE WHEN SQLSTATE='42501' THEN 'Rule manager is no longer authorized'
        ELSE 'Evaluation failed; review rule, stock and catalog before retrying' END,
      evaluated_at=clock_timestamp() WHERE rule_id=job.rule_id;
    RETURN jsonb_build_object('processed',0,'failed',1,'busy',false);
  END;
  PERFORM set_config('request.jwt.claims',COALESCE(claims,''),true);
  RETURN jsonb_build_object('processed',1,'failed',0,'busy',false);
END $$;
REVOKE ALL ON FUNCTION public.process_procurement_replenishment(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.process_procurement_replenishment(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.save_procurement_replenishment_rule(p_site uuid,p_id uuid,p_version integer,p_document jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.procurement_replenishment_rules; item uuid; location uuid;
  v_minimum numeric; v_target numeric; min_order numeric; multiple numeric;
BEGIN
  IF public.procurement_request_access(p_site) IS NOT TRUE OR public.user_can(p_site,'update') IS NOT TRUE THEN
    RAISE EXCEPTION 'Replenishment access denied' USING ERRCODE='42501'; END IF;
  IF p_document IS NULL OR jsonb_typeof(p_document)<>'object'
    OR p_document - ARRAY['name','catalog_item_id','location_id','minimum','target','minimum_order','order_multiple','action','enabled'] <> '{}'
    OR NOT p_document ?& ARRAY['name','catalog_item_id','location_id','minimum','target','minimum_order','order_multiple','action','enabled']
    OR jsonb_typeof(p_document->'name') IS DISTINCT FROM 'string'
    OR COALESCE(length(btrim(p_document->>'name')) NOT BETWEEN 1 AND 200,true)
    OR jsonb_typeof(p_document->'minimum') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_document->'target') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_document->'minimum_order') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_document->'order_multiple') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_document->'enabled') IS DISTINCT FROM 'boolean'
    OR COALESCE(p_document->>'action' NOT IN ('alert','draft'),true)
  THEN RAISE EXCEPTION 'Invalid replenishment rule' USING ERRCODE='22023'; END IF;
  item := (p_document->>'catalog_item_id')::uuid; location := (p_document->>'location_id')::uuid;
  v_minimum := (p_document->>'minimum')::numeric; v_target := (p_document->>'target')::numeric;
  min_order := (p_document->>'minimum_order')::numeric; multiple := (p_document->>'order_multiple')::numeric;
  IF v_minimum NOT BETWEEN 0 AND 1000000 OR v_target <= v_minimum OR v_target > 1000000
    OR min_order NOT BETWEEN 1 AND 1000000 OR multiple NOT BETWEEN 1 AND 1000000
    OR trunc(min_order)<>min_order OR trunc(multiple)<>multiple THEN
    RAISE EXCEPTION 'Invalid replenishment quantities' USING ERRCODE='22023'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO r FROM public.procurement_replenishment_rules WHERE site_id=p_site AND id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rule not found' USING ERRCODE='42501'; END IF;
    IF r.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='40001'; END IF;
    IF r.catalog_item_id IS DISTINCT FROM item OR r.location_id IS DISTINCT FROM location THEN
      RAISE EXCEPTION 'Rule item and location are immutable' USING ERRCODE='22023'; END IF;
  ELSIF p_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='40001'; END IF;
  -- Obsolete references must not trap an existing rule in its enabled state.
  -- Only an existing, version-checked rule with the same references may bypass
  -- eligibility when disabled. Creation and every re-enable still validate both.
  IF p_id IS NULL OR (p_document->>'enabled')::boolean THEN
    PERFORM 1 FROM public.catalog_items WHERE id=item AND site_id=p_site
      AND status='active' AND procurement_enabled AND track_inventory FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item unavailable' USING ERRCODE='22023'; END IF;
    PERFORM 1 FROM public.locations WHERE id=location AND site_id=p_site AND is_active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Location unavailable' USING ERRCODE='22023'; END IF;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.procurement_replenishment_rules(site_id,name,catalog_item_id,location_id,minimum,target,
      minimum_order,order_multiple,action,enabled,created_by,updated_by)
    VALUES(p_site,btrim(p_document->>'name'),item,location,v_minimum,v_target,min_order,multiple,p_document->>'action',(p_document->>'enabled')::boolean,auth.uid(),auth.uid())
    RETURNING id INTO p_id;
  ELSE
    UPDATE public.procurement_replenishment_rules SET name=btrim(p_document->>'name'),minimum=v_minimum,target=v_target,minimum_order=min_order,
      order_multiple=multiple,action=p_document->>'action',enabled=(p_document->>'enabled')::boolean,
      version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id=p_id;
  END IF;
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.save_procurement_replenishment_rule(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_procurement_replenishment_rule(uuid,uuid,integer,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;