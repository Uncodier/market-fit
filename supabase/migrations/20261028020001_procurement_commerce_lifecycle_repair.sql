BEGIN;

CREATE FUNCTION public.procurement_supplier_proposal_count(p_site uuid,p_publication uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT count(DISTINCT proposal.procurement_supplier_id)::integer FROM public.quotations proposal
    JOIN public.suppliers supplier ON supplier.id=proposal.procurement_supplier_id AND supplier.site_id=p_site
    JOIN public.procurement_tender_publications publication ON publication.id=proposal.procurement_publication_id
    WHERE proposal.procurement_publication_id=p_publication AND proposal.buyer_site_id=p_site
      AND supplier.status='approved'
      AND (CASE WHEN proposal.procurement_source='buyer_recorded' OR publication.snapshot->>'participation'='invitation_only'
        THEN EXISTS(SELECT 1 FROM public.procurement_tender_participants participant
          WHERE participant.tender_id=proposal.procurement_tender_id AND participant.supplier_id=supplier.id AND participant.status='invited')
        ELSE publication.snapshot->>'participation' IN ('open','approved_suppliers') END);
$$;
REVOKE ALL ON FUNCTION public.procurement_supplier_proposal_count(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.procurement_validate_commerce_event(p_site uuid,p_target uuid,p_version integer,p_event text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotations; t public.procurement_tenders; pub public.procurement_tender_publications;
  a public.procurement_awards; b public.procurement_tender_policy_bindings; inherited jsonb;
BEGIN
  IF NOT public.procurement_tender_access(p_site,'update') THEN RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_policy:'||p_site::text,0));
  IF p_event='order' THEN
    SELECT * INTO a FROM public.procurement_awards WHERE id=p_target AND site_id=p_site FOR UPDATE;
    IF a.id IS NULL OR p_version IS DISTINCT FROM a.version THEN RAISE EXCEPTION 'Award changed' USING ERRCODE='40001'; END IF;
    SELECT * INTO q FROM public.quotations WHERE id=a.quotation_id;
  ELSIF p_event='award' THEN
    SELECT * INTO q FROM public.quotations WHERE id=p_target AND buyer_site_id=p_site AND purpose='procurement';
    IF q.id IS NULL OR p_version IS DISTINCT FROM q.procurement_revision THEN RAISE EXCEPTION 'Quotation changed' USING ERRCODE='40001'; END IF;
  ELSE RAISE EXCEPTION 'Unsupported commerce event' USING ERRCODE='22023'; END IF;
  SELECT * INTO t FROM public.procurement_tenders WHERE id=q.procurement_tender_id AND site_id=p_site FOR UPDATE;
  SELECT * INTO pub FROM public.procurement_tender_publications WHERE tender_id=t.id ORDER BY version DESC LIMIT 1;
  SELECT * INTO b FROM public.procurement_tender_policy_bindings WHERE publication_id=pub.id;
  IF t.id IS NULL OR t.status NOT IN ('published','closed') OR pub.id IS DISTINCT FROM q.procurement_publication_id
    OR t.version IS DISTINCT FROM (pub.version+CASE WHEN t.status='closed' THEN 1 ELSE 0 END)
    OR b.working_snapshot IS NULL OR b.request_id IS DISTINCT FROM t.request_id
    OR to_jsonb(t)-ARRAY['status','updated_at','version'] IS DISTINCT FROM b.working_snapshot
    OR (pub.snapshot->>'opening_at')::timestamptz>clock_timestamp()
    OR (pub.snapshot->>'participation_deadline')::timestamptz>clock_timestamp() THEN
    RAISE EXCEPTION 'Tender is not open for award or has unpublished amendments' USING ERRCODE='40001'; END IF;
  PERFORM 1 FROM public.suppliers WHERE id=q.procurement_supplier_id AND site_id=p_site AND status='approved' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier approval revoked' USING ERRCODE='42501'; END IF;
  IF q.procurement_source='buyer_recorded' OR pub.snapshot->>'participation'='invitation_only' THEN
    PERFORM 1 FROM public.procurement_tender_participants WHERE tender_id=t.id AND supplier_id=q.procurement_supplier_id AND status='invited' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invitation revoked' USING ERRCODE='42501'; END IF;
  END IF;
  inherited:=public.procurement_inherited_policy(p_site,t.id,p_event);
  IF jsonb_array_length(inherited->'inherited_requirements')>0 THEN
    RAISE EXCEPTION 'Inherited request requirements unresolved' USING ERRCODE='22023'; END IF;
  IF public.procurement_supplier_proposal_count(p_site,pub.id)<(inherited->>'minimum_supplier_proposals')::integer THEN
    RAISE EXCEPTION 'Inherited minimum supplier proposals not met' USING ERRCODE='22023'; END IF;
  IF p_event='award' AND EXISTS(SELECT 1 FROM public.procurement_awards WHERE tender_id=t.id AND quotation_id<>q.id) THEN
    RAISE EXCEPTION 'Tender already awarded' USING ERRCODE='40001'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.procurement_validate_commerce_event(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.procurement_commerce_event_context(p_site uuid,p_target uuid,p_version integer,p_event text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotations; result jsonb;
BEGIN
  PERFORM public.procurement_validate_commerce_event(p_site,p_target,p_version,p_event);
  IF p_event='award' THEN SELECT * INTO q FROM public.quotations WHERE id=p_target;
  ELSE SELECT quotation.* INTO q FROM public.quotations quotation JOIN public.procurement_awards a ON a.quotation_id=quotation.id WHERE a.id=p_target; END IF;
  SELECT jsonb_build_object('currency',q.currency,'net_amount_minor',q.procurement_net_minor,
    'supplier_proposals',public.procurement_supplier_proposal_count(p_site,q.procurement_publication_id),
    'lines',jsonb_agg(jsonb_build_object('id',i.id,'productId',i.catalog_item_id,
      'categoryIds',CASE WHEN c.category_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(c.category_id) END,
      'netAmountMinor',i.procurement_net_minor) ORDER BY i.id)) INTO result
    FROM public.quotation_items i JOIN public.catalog_items c ON c.id=i.catalog_item_id AND c.site_id=p_site WHERE i.quotation_id=q.id;
  RETURN result||public.procurement_inherited_policy(p_site,q.procurement_tender_id,p_event);
END $$;
REVOKE ALL ON FUNCTION public.procurement_commerce_event_context(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_commerce_event_context(uuid,uuid,integer,text) TO authenticated;

COMMIT;