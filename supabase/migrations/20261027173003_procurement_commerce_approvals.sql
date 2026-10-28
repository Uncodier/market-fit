BEGIN;

-- Only the authorized API evaluates a plan; browser callers cannot supply one.
CREATE FUNCTION public.create_procurement_commerce_approval(p_site uuid,p_target uuid,p_version integer,p_event text,
  p_actor uuid,p_policy_revision integer,p_plan jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid; pos integer:=0; stage jsonb; claims text; context jsonb;
BEGIN
  claims:=current_setting('request.jwt.claims',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::text,true);
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_policy:'||p_site::text,0));
  IF p_policy_revision IS DISTINCT FROM (SELECT max(revision) FROM public.procurement_policy_versions WHERE site_id=p_site) THEN
    RAISE EXCEPTION 'Policy changed' USING ERRCODE='40001'; END IF;
  PERFORM public.procurement_validate_commerce_event(p_site,p_target,p_version,p_event);
  IF p_plan->>'status' IS DISTINCT FROM 'ready' OR jsonb_typeof(p_plan->'stages') IS DISTINCT FROM 'array'
    OR octet_length(p_plan::text)>262144 OR jsonb_array_length(p_plan->'requirements')>0
    THEN RAISE EXCEPTION 'Unresolved policy' USING ERRCODE='22023'; END IF;
  context:=public.procurement_commerce_event_context(p_site,p_target,p_version,p_event);
  IF p_plan->>'minimumSupplierProposals' IS NOT NULL AND (context->>'supplier_proposals')::integer<(p_plan->>'minimumSupplierProposals')::integer THEN
    RAISE EXCEPTION 'Minimum supplier proposals not met' USING ERRCODE='22023'; END IF;
  SELECT id INTO result FROM public.procurement_event_approvals WHERE site_id=p_site AND target_id=p_target
    AND target_version=p_version AND event=p_event AND policy_revision=p_policy_revision;
  IF result IS NULL THEN
    INSERT INTO public.procurement_event_approvals(site_id,target_id,target_version,event,policy_revision,actor_id,plan,status)
      VALUES(p_site,p_target,p_version,p_event,p_policy_revision,p_actor,p_plan,'pending') RETURNING id INTO result;
    FOR stage IN SELECT value FROM jsonb_array_elements(p_plan->'stages') LOOP
      INSERT INTO public.procurement_event_stages(approval_id,position,definition) VALUES(result,pos,stage); pos:=pos+1;
    END LOOP;
    IF pos=0 THEN
      UPDATE public.procurement_event_approvals SET status='approved' WHERE id=result;
      PERFORM public.finalize_procurement_event(result);
    END IF;
  END IF;
  PERFORM set_config('request.jwt.claims',COALESCE(claims,''),true);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.create_procurement_commerce_approval(uuid,uuid,integer,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_procurement_commerce_approval(uuid,uuid,integer,text,uuid,integer,jsonb) TO service_role;

CREATE FUNCTION public.record_procurement_receipt(p_site uuid,p_document jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE po public.purchase_orders; receipt public.procurement_receipts; item public.purchase_order_items;
  line jsonb; key uuid; quantity integer; received bigint; result uuid;
BEGIN
  IF NOT public.procurement_tender_access(p_site,'update') THEN RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_document) IS DISTINCT FROM 'object' OR octet_length(p_document::text)>32768
    OR p_document - ARRAY['order_id','idempotency_key','note','lines'] <> '{}'::jsonb
    OR COALESCE(length(btrim(p_document->>'note')) NOT BETWEEN 1 AND 1000,true)
    OR jsonb_typeof(p_document->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_document->'lines') NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid receipt' USING ERRCODE='22023'; END IF;
  key:=(p_document->>'idempotency_key')::uuid;
  IF key IS NULL THEN RAISE EXCEPTION 'Receipt identity required' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_receipt:'||p_site::text||key::text,0));
  SELECT * INTO receipt FROM public.procurement_receipts WHERE site_id=p_site AND idempotency_key=key;
  IF FOUND THEN
    IF receipt.input IS DISTINCT FROM p_document THEN RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='40001'; END IF;
    RETURN receipt.id;
  END IF;
  SELECT * INTO po FROM public.purchase_orders WHERE id=(p_document->>'order_id')::uuid AND site_id=p_site FOR UPDATE;
  IF po.id IS NULL THEN RAISE EXCEPTION 'Order access denied' USING ERRCODE='42501'; END IF;
  INSERT INTO public.procurement_receipts(site_id,order_id,actor_id,note,idempotency_key,input)
    VALUES(p_site,po.id,auth.uid(),btrim(p_document->>'note'),key,p_document) RETURNING id INTO result;
  FOR line IN SELECT value FROM jsonb_array_elements(p_document->'lines') LOOP
    IF line - ARRAY['item_id','quantity'] <> '{}'::jsonb OR COALESCE((line->>'quantity') !~ '^[0-9]{1,7}$',true) THEN
      RAISE EXCEPTION 'Invalid receipt line' USING ERRCODE='22023'; END IF;
    quantity:=(line->>'quantity')::integer;
    SELECT * INTO item FROM public.purchase_order_items WHERE id=(line->>'item_id')::uuid AND order_id=po.id;
    IF item.id IS NULL OR quantity NOT BETWEEN 1 AND 1000000 THEN RAISE EXCEPTION 'Invalid receipt quantity' USING ERRCODE='22023'; END IF;
    SELECT COALESCE(sum(ri.quantity),0) INTO received FROM public.procurement_receipt_items ri WHERE order_item_id=item.id;
    IF received+quantity>item.quantity THEN RAISE EXCEPTION 'Receipt exceeds ordered quantity' USING ERRCODE='40001'; END IF;
    INSERT INTO public.procurement_receipt_items VALUES(result,item.id,quantity);
  END LOOP;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.record_procurement_receipt(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_procurement_receipt(uuid,jsonb) TO authenticated;

COMMIT;