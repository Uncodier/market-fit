BEGIN;
SET LOCAL lock_timeout='5s';

-- Preserve sales requirements while allowing immutable net-only procurement offers.
ALTER TABLE public.quotation_items ALTER COLUMN catalog_item_id DROP NOT NULL;
ALTER TABLE public.quotation_items ADD CONSTRAINT quotation_item_catalog_scope
  CHECK (catalog_item_id IS NOT NULL OR procurement_requirement_id IS NOT NULL);
ALTER TABLE public.quotations ALTER COLUMN tax_total DROP NOT NULL, ALTER COLUMN total DROP NOT NULL;
ALTER TABLE public.quotations DROP CONSTRAINT quotation_purpose_boundary;
ALTER TABLE public.quotations
ADD CONSTRAINT quotation_purpose_boundary CHECK(
    (purpose='sales' AND tax_total IS NOT NULL AND total IS NOT NULL AND site_id IS NOT NULL AND lead_id IS NOT NULL AND buyer_site_id IS NULL
      AND procurement_supplier_id IS NULL AND procurement_tender_id IS NULL AND procurement_publication_id IS NULL
      AND procurement_revision IS NULL AND procurement_custodian_id IS NULL AND procurement_reference IS NULL
      AND procurement_idempotency_key IS NULL AND procurement_input IS NULL AND procurement_source IS NULL AND procurement_net_minor IS NULL AND procurement_tax_minor IS NULL)
    OR (purpose='procurement' AND site_id IS NULL AND lead_id IS NULL AND deal_id IS NULL
      AND buyer_user_id IS NULL AND price_list_id IS NULL AND location_id IS NULL AND status='draft'
      AND buyer_site_id IS NOT NULL AND procurement_supplier_id IS NOT NULL AND procurement_tender_id IS NOT NULL
      AND procurement_publication_id IS NOT NULL AND procurement_revision=1 AND procurement_custodian_id IS NOT NULL
      AND length(procurement_reference) BETWEEN 1 AND 120 AND procurement_idempotency_key IS NOT NULL
      AND procurement_input IS NOT NULL AND procurement_source IS NOT NULL AND procurement_net_minor BETWEEN 0 AND 1000000000000000
      AND ((procurement_tax_minor IS NULL AND tax_total IS NULL AND total IS NULL)
        OR (procurement_tax_minor IS NOT NULL AND tax_total IS NOT NULL AND total IS NOT NULL
          AND procurement_tax_minor BETWEEN 0 AND 1000000000000000
          AND tax_total=procurement_tax_minor::numeric/100 AND total=subtotal+tax_total))
      AND subtotal=procurement_net_minor::numeric/100
      AND discount_total=0
      AND public_access_token IS NULL AND public_access_token_expires_at IS NULL AND public_access_token_revoked_at IS NULL
      AND checkout_claim_id IS NULL AND checkout_claimed_at IS NULL AND checkout_sale_id IS NULL AND checkout_order_id IS NULL)
  );

CREATE OR REPLACE FUNCTION public.guard_procurement_quotation_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotations;
BEGIN
  IF TG_OP<>'INSERT' AND public.is_procurement_quotation(OLD.quotation_id) THEN
    RAISE EXCEPTION 'Procurement quotation items are immutable' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  SELECT * INTO q FROM public.quotations WHERE id=NEW.quotation_id;
  IF q.purpose='procurement' THEN
    IF NOT EXISTS(SELECT 1 FROM procurement_commerce_private.quote_writes
      WHERE transaction_id=txid_current() AND quotation_id=q.id) THEN
      RAISE EXCEPTION 'Procurement quotation writer required' USING ERRCODE='42501'; END IF;
    IF (NEW.catalog_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.catalog_items WHERE id=NEW.catalog_item_id AND site_id=q.buyer_site_id))
      OR NEW.quantity NOT BETWEEN 1 AND 1000000 OR NEW.procurement_requirement_id IS NULL
      OR NEW.procurement_unit_net_minor IS NULL
      OR NEW.procurement_net_minor IS DISTINCT FROM NEW.procurement_unit_net_minor*NEW.quantity
      OR NEW.unit_price IS DISTINCT FROM NEW.procurement_unit_net_minor::numeric/100
      OR NEW.subtotal IS DISTINCT FROM NEW.procurement_net_minor::numeric/100
      OR (NEW.catalog_item_id IS NULL AND (NEW.procurement_tax_minor IS NOT NULL OR NEW.procurement_tax_snapshot IS NOT NULL))
      OR (NEW.catalog_item_id IS NOT NULL AND (NEW.procurement_tax_minor IS NULL OR NEW.procurement_tax_snapshot IS NULL)) THEN
      RAISE EXCEPTION 'Invalid procurement item snapshot' USING ERRCODE='23514'; END IF;
  ELSIF NEW.catalog_item_id IS NULL OR NEW.procurement_requirement_id IS NOT NULL OR NEW.procurement_unit_net_minor IS NOT NULL
    OR NEW.procurement_net_minor IS NOT NULL OR NEW.procurement_tax_minor IS NOT NULL OR NEW.procurement_tax_snapshot IS NOT NULL THEN
    RAISE EXCEPTION 'Sales item cannot contain procurement state' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.capture_procurement_quotation(p_site uuid,p_document jsonb,p_source text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.procurement_tenders; pub public.procurement_tender_publications; q public.quotations;
  sid uuid; qid uuid:=gen_random_uuid(); key uuid; line jsonb; offered jsonb; item public.catalog_items;
  unit_minor bigint; net bigint; tax_minor bigint; total_net bigint:=0; total_tax bigint:=0;
  taxes jsonb; rows jsonb:='[]'; quantity integer;
BEGIN
  IF auth.uid() IS NULL OR p_source NOT IN ('buyer_recorded','supplier_submitted') THEN RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_document) IS DISTINCT FROM 'object' OR octet_length(p_document::text)>32768
    OR p_document - ARRAY['supplier_id','tender_id','publication_id','reference','lines','idempotency_key','evidence','proposal_revision_id'] <> '{}'::jsonb
    OR jsonb_typeof(p_document->'lines') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_document->'lines') NOT BETWEEN 1 AND 100
    OR COALESCE(length(btrim(p_document->>'reference')) NOT BETWEEN 1 AND 120,true) THEN
    RAISE EXCEPTION 'Invalid quotation' USING ERRCODE='22023'; END IF;
  IF p_document ? 'proposal_revision_id' AND (p_source<>'supplier_submitted'
    OR jsonb_typeof(p_document->'proposal_revision_id') IS DISTINCT FROM 'string'
    OR (p_document->>'proposal_revision_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'Invalid proposal revision' USING ERRCODE='22023'; END IF;
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
  PERFORM 1 FROM public.suppliers WHERE id=sid AND site_id=p_site AND (status='approved' OR (p_source='supplier_submitted' AND public.procurement_self_participation(p_site,sid,pub.id,auth.uid()))) FOR SHARE;
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
    net:=unit_minor*quantity;
    item:=NULL;
    IF line->>'catalog_item_id' IS NULL THEN
      -- Missing catalog mapping means unknown taxes, never zero-rated supply.
      taxes:=NULL;
      tax_minor:=NULL;
    ELSE
    SELECT * INTO item FROM public.catalog_items WHERE id=(line->>'catalog_item_id')::uuid AND site_id=p_site AND status='active' FOR SHARE;
    IF item.id IS NULL OR item.currency IS DISTINCT FROM t.currency THEN
      RAISE EXCEPTION 'Active same-currency catalog mapping required' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM public.catalog_item_taxes it LEFT JOIN public.taxes tx ON tx.id=it.tax_id
      WHERE it.catalog_item_id=item.id AND (it.site_id IS DISTINCT FROM p_site OR tx.site_id IS DISTINCT FROM p_site
        OR tx.is_active IS DISTINCT FROM true OR tx.rate IS NULL OR tx.rate<0 OR tx.rate>100)) THEN
      RAISE EXCEPTION 'Catalog taxes unavailable' USING ERRCODE='22023'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id',tx.id,'name',tx.name,'rate',tx.rate) ORDER BY tx.id),'[]') INTO taxes
      FROM public.catalog_item_taxes it JOIN public.taxes tx ON tx.id=it.tax_id WHERE it.catalog_item_id=item.id;
    SELECT COALESCE(sum(round(net*(v->>'rate')::numeric/100)),0)::bigint INTO tax_minor FROM jsonb_array_elements(taxes) v;
    END IF;
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
      (line->>'tax_minor')::bigint,NULLIF(line->'taxes','null'::jsonb));
  END LOOP;
  DELETE FROM procurement_commerce_private.quote_writes WHERE transaction_id=txid_current() AND quotation_id=qid;
  RETURN qid;
END $$;

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
  PERFORM 1 FROM public.suppliers WHERE id=q.procurement_supplier_id AND site_id=p_site AND (status='approved' OR (q.procurement_source='supplier_submitted' AND public.procurement_self_participation(p_site,q.procurement_supplier_id,pub.id,q.procurement_custodian_id))) FOR SHARE;
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
  IF p_event='order' AND (q.procurement_tax_minor IS NULL OR EXISTS(
    SELECT 1 FROM public.quotation_items WHERE quotation_id=q.id AND
      (catalog_item_id IS NULL OR procurement_tax_minor IS NULL OR procurement_tax_snapshot IS NULL))) THEN
    RAISE EXCEPTION 'Quotation catalog mapping and taxes must be resolved before ordering' USING ERRCODE='22023';
  END IF;
  IF p_event='award' AND EXISTS(SELECT 1 FROM public.procurement_awards WHERE tender_id=t.id AND quotation_id<>q.id) THEN
    RAISE EXCEPTION 'Tender already awarded' USING ERRCODE='40001'; END IF;
END $$;

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
    FROM public.quotation_items i LEFT JOIN public.catalog_items c ON c.id=i.catalog_item_id AND c.site_id=p_site WHERE i.quotation_id=q.id;
  RETURN result||public.procurement_inherited_policy(p_site,q.procurement_tender_id,p_event);
END $$;

REVOKE ALL ON FUNCTION public.guard_procurement_quotation_item(),
  public.capture_procurement_quotation(uuid,jsonb,text),
  public.procurement_validate_commerce_event(uuid,uuid,integer,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.procurement_commerce_event_context(uuid,uuid,integer,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_commerce_event_context(uuid,uuid,integer,text) TO authenticated;
COMMIT;
