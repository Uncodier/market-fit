BEGIN;

CREATE FUNCTION public.capture_procurement_quotation(p_site uuid,p_document jsonb,p_source text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.procurement_tenders; pub public.procurement_tender_publications; q public.quotations;
  sid uuid; qid uuid:=gen_random_uuid(); key uuid; line jsonb; offered jsonb; item public.catalog_items;
  unit_minor bigint; net bigint; tax_minor bigint; total_net bigint:=0; total_tax bigint:=0;
  taxes jsonb; rows jsonb:='[]'; quantity integer;
BEGIN
  IF auth.uid() IS NULL OR p_source NOT IN ('buyer_recorded','supplier_submitted') THEN RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_document) IS DISTINCT FROM 'object' OR octet_length(p_document::text)>32768
    OR p_document - ARRAY['supplier_id','tender_id','publication_id','reference','lines','idempotency_key','evidence'] <> '{}'::jsonb
    OR jsonb_typeof(p_document->'lines') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_document->'lines') NOT BETWEEN 1 AND 100
    OR COALESCE(length(btrim(p_document->>'reference')) NOT BETWEEN 1 AND 120,true) THEN
    RAISE EXCEPTION 'Invalid quotation' USING ERRCODE='22023'; END IF;
  sid:=(p_document->>'supplier_id')::uuid; key:=(p_document->>'idempotency_key')::uuid;
  IF sid IS NULL OR key IS NULL THEN RAISE EXCEPTION 'Invalid quotation identity' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_quote:'||p_site::text||key::text,0));
  SELECT * INTO q FROM public.quotations WHERE buyer_site_id=p_site AND procurement_idempotency_key=key;
  IF FOUND THEN
    IF q.procurement_input IS DISTINCT FROM p_document OR q.procurement_custodian_id IS DISTINCT FROM auth.uid()
      OR q.procurement_source IS DISTINCT FROM p_source THEN RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='40001'; END IF;
    RETURN q.id;
  END IF;
  SELECT * INTO t FROM public.procurement_tenders WHERE id=(p_document->>'tender_id')::uuid AND site_id=p_site FOR UPDATE;
  IF t.id IS NULL OR t.status<>'published' THEN RAISE EXCEPTION 'Published tender required' USING ERRCODE='22023'; END IF;
  SELECT * INTO pub FROM public.procurement_tender_publications WHERE tender_id=t.id ORDER BY version DESC LIMIT 1;
  IF pub.id IS DISTINCT FROM (p_document->>'publication_id')::uuid OR pub.version IS DISTINCT FROM t.version
    OR (pub.snapshot->>'participation_deadline')::timestamptz<=clock_timestamp() THEN
    RAISE EXCEPTION 'Publication changed or deadline reached' USING ERRCODE='40001'; END IF;
  PERFORM 1 FROM public.suppliers WHERE id=sid AND site_id=p_site AND status='approved' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier is not approved' USING ERRCODE='42501'; END IF;
  IF p_source='buyer_recorded' OR pub.snapshot->>'participation'='invitation_only' THEN
    PERFORM 1 FROM public.procurement_tender_participants WHERE tender_id=t.id AND supplier_id=sid AND status='invited' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invited supplier required' USING ERRCODE='42501'; END IF;
  ELSIF pub.snapshot->>'participation' NOT IN ('open','approved_suppliers') THEN
    RAISE EXCEPTION 'Participation terms unavailable' USING ERRCODE='42501';
  END IF;
  IF t.request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.procurement_requests WHERE id=t.request_id AND site_id=p_site AND status='approved') THEN
    RAISE EXCEPTION 'Request approval required' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(t.requirements)<>jsonb_array_length(p_document->'lines') OR EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_document->'lines') x GROUP BY x->>'requirement_id' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'All tender lines must be quoted exactly once' USING ERRCODE='22023'; END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(t.requirements) LOOP
    SELECT value INTO offered FROM jsonb_array_elements(p_document->'lines') WHERE value->>'requirement_id'=line->>'id';
    IF offered IS NULL OR offered - ARRAY['requirement_id','unit_net_minor'] <> '{}'::jsonb
      OR COALESCE((offered->>'unit_net_minor') !~ '^[0-9]{1,10}$',true) THEN
      RAISE EXCEPTION 'Invalid quoted line' USING ERRCODE='22023'; END IF;
    unit_minor:=(offered->>'unit_net_minor')::bigint; quantity:=(line->>'quantity')::integer;
    IF unit_minor>1000000000 OR quantity NOT BETWEEN 1 AND 1000000 THEN RAISE EXCEPTION 'Invalid quantity or price' USING ERRCODE='22023'; END IF;
    SELECT * INTO item FROM public.catalog_items WHERE id=(line->>'catalog_item_id')::uuid AND site_id=p_site AND status='active' FOR SHARE;
    IF item.id IS NULL OR item.currency IS DISTINCT FROM t.currency THEN
      RAISE EXCEPTION 'Active same-currency catalog mapping required' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM public.catalog_item_taxes it LEFT JOIN public.taxes tx ON tx.id=it.tax_id
      WHERE it.catalog_item_id=item.id AND (it.site_id IS DISTINCT FROM p_site OR tx.site_id IS DISTINCT FROM p_site
        OR tx.is_active IS DISTINCT FROM true OR tx.rate IS NULL OR tx.rate<0 OR tx.rate>100)) THEN
      RAISE EXCEPTION 'Catalog taxes unavailable' USING ERRCODE='22023'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id',tx.id,'name',tx.name,'rate',tx.rate) ORDER BY tx.id),'[]') INTO taxes
      FROM public.catalog_item_taxes it JOIN public.taxes tx ON tx.id=it.tax_id WHERE it.catalog_item_id=item.id;
    net:=unit_minor*quantity;
    SELECT COALESCE(sum(round(net*(v->>'rate')::numeric/100)),0)::bigint INTO tax_minor FROM jsonb_array_elements(taxes) v;
    total_net:=total_net+net; total_tax:=total_tax+tax_minor;
    rows:=rows||jsonb_build_array(jsonb_build_object('catalog_item_id',item.id,'name',line->>'description','quantity',quantity,
      'requirement_id',line->>'id','unit_minor',unit_minor,'net',net,'tax_minor',tax_minor,'taxes',taxes));
  END LOOP;
  INSERT INTO procurement_commerce_private.quote_writes VALUES(txid_current(),qid);
  INSERT INTO public.quotations(id,purpose,site_id,lead_id,buyer_site_id,procurement_supplier_id,procurement_tender_id,
    procurement_publication_id,procurement_revision,procurement_custodian_id,procurement_reference,procurement_idempotency_key,
    procurement_input,procurement_source,procurement_net_minor,procurement_tax_minor,currency,subtotal,tax_total,total)
  VALUES(qid,'procurement',NULL,NULL,p_site,sid,t.id,pub.id,1,auth.uid(),btrim(p_document->>'reference'),key,p_document,
    p_source,total_net,total_tax,t.currency,total_net::numeric/100,total_tax::numeric/100,(total_net+total_tax)::numeric/100);
  FOR line IN SELECT value FROM jsonb_array_elements(rows) LOOP
    INSERT INTO public.quotation_items(quotation_id,catalog_item_id,name,quantity,unit_price,subtotal,procurement_requirement_id,
      procurement_unit_net_minor,procurement_net_minor,procurement_tax_minor,procurement_tax_snapshot)
    VALUES(qid,(line->>'catalog_item_id')::uuid,line->>'name',(line->>'quantity')::integer,(line->>'unit_minor')::numeric/100,
      (line->>'net')::numeric/100,line->>'requirement_id',(line->>'unit_minor')::bigint,(line->>'net')::bigint,
      (line->>'tax_minor')::bigint,line->'taxes');
  END LOOP;
  DELETE FROM procurement_commerce_private.quote_writes WHERE transaction_id=txid_current() AND quotation_id=qid;
  RETURN qid;
END $$;
REVOKE ALL ON FUNCTION public.capture_procurement_quotation(uuid,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.record_procurement_quotation(p_site uuid,p_document jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.procurement_tender_access(p_site,'insert') THEN RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501'; END IF;
  RETURN public.capture_procurement_quotation(p_site,p_document,'buyer_recorded');
END $$;
REVOKE ALL ON FUNCTION public.record_procurement_quotation(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_procurement_quotation(uuid,jsonb) TO authenticated;

CREATE FUNCTION public.procurement_quotation_options(p_site uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.procurement_tender_access(p_site,'select') THEN RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(row),'[]') INTO result FROM (
    SELECT jsonb_build_object('tender_id',t.id,'publication_id',p.id,'title',p.snapshot->>'title','currency',p.snapshot->>'currency',
      'participation_deadline',p.snapshot->>'participation_deadline','requirements',p.snapshot->'requirements',
      'suppliers',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)),'[]')
        FROM public.procurement_tender_participants part JOIN public.suppliers s ON s.id=part.supplier_id AND s.site_id=t.site_id
        WHERE part.tender_id=t.id AND part.status='invited' AND s.status='approved')) AS row
    FROM public.procurement_tenders t JOIN LATERAL (
      SELECT * FROM public.procurement_tender_publications WHERE tender_id=t.id ORDER BY version DESC LIMIT 1) p ON true
    WHERE t.site_id=p_site AND t.status='published' AND t.version=p.version
      AND (p.snapshot->>'participation_deadline')::timestamptz>now()
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.requirements) line WHERE line->>'catalog_item_id' IS NULL)
    ORDER BY p.published_at DESC LIMIT 100
  ) choices;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.procurement_quotation_options(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_quotation_options(uuid) TO authenticated;

COMMIT;