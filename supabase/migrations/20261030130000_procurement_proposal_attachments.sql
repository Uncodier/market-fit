BEGIN;
SET LOCAL lock_timeout='5s';

-- A quotation proposal is not certification evidence for any requirement.
CREATE TABLE public.procurement_quotation_attachments (
 quotation_id uuid PRIMARY KEY REFERENCES public.quotations(id),
 publication_id uuid NOT NULL REFERENCES public.procurement_tender_publications(id),
 site_id uuid NOT NULL, supplier_id uuid NOT NULL,
 revision_id uuid NOT NULL REFERENCES public.procurement_credential_revisions(id),
 submitted_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(site_id,supplier_id) REFERENCES public.suppliers(site_id,id)
);
ALTER TABLE public.procurement_quotation_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_quotation_attachments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procurement_quotation_attachments TO authenticated;
CREATE POLICY quotation_attachment_scoped_read ON public.procurement_quotation_attachments FOR SELECT TO authenticated
 USING(submitted_by=auth.uid() OR public.procurement_evidence_open(publication_id,site_id));
CREATE TRIGGER quotation_attachment_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
 ON public.procurement_quotation_attachments FOR EACH STATEMENT
 EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();

CREATE FUNCTION public.attach_procurement_quotation_proposal(p_quote uuid,p_revision uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotations; r public.procurement_credential_revisions;
BEGIN
 SELECT * INTO q FROM public.quotations WHERE id=p_quote FOR UPDATE;
 IF auth.uid() IS NULL OR q.procurement_source IS DISTINCT FROM 'supplier_submitted'
 OR q.procurement_custodian_id IS DISTINCT FROM auth.uid()
 OR NOT (public.procurement_can_represent(q.buyer_site_id,q.procurement_supplier_id)
  OR public.procurement_self_participation(q.buyer_site_id,q.procurement_supplier_id,q.procurement_publication_id,auth.uid())) THEN
  RAISE EXCEPTION 'Proposal sharing denied' USING ERRCODE='42501'; END IF;
 -- Enforce the original receipt, even for trusted internal callers.
 IF p_revision IS NULL OR (q.procurement_input->>'proposal_revision_id')::uuid IS DISTINCT FROM p_revision THEN
  RAISE EXCEPTION 'Proposal does not match quotation receipt' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.procurement_quotation_attachments WHERE quotation_id=q.id AND revision_id=p_revision) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.procurement_quotation_attachments WHERE quotation_id=q.id) THEN
  RAISE EXCEPTION 'Proposal attachment conflict' USING ERRCODE='40001'; END IF;
 SELECT revision.* INTO r FROM public.procurement_credential_revisions revision
 JOIN public.procurement_credentials credential ON credential.id=revision.credential_id
 WHERE revision.id=p_revision AND revision.uploader_id=auth.uid() AND revision.state='ready'
 AND revision.mime_type='application/pdf' AND revision.metadata->>'type'='tender_proposal'
 AND credential.owner_id=auth.uid() AND credential.archived_at IS NULL FOR SHARE OF credential,revision;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Private proposal unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO public.procurement_quotation_attachments(quotation_id,publication_id,site_id,supplier_id,revision_id,submitted_by)
 VALUES(q.id,q.procurement_publication_id,q.buyer_site_id,q.procurement_supplier_id,r.id,auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.attach_procurement_quotation_proposal(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Existing revision RLS and private storage/file-download policies call this helper.
-- Preserve evidence disclosure and add only explicitly attached proposal revisions.
CREATE OR REPLACE FUNCTION public.procurement_shared_revision_access(p_revision uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND (
 EXISTS(SELECT 1 FROM public.procurement_submission_evidence e
 WHERE e.revision_id=p_revision AND public.procurement_evidence_open(e.publication_id,e.site_id))
 OR EXISTS(SELECT 1 FROM public.procurement_quotation_attachments a
 WHERE a.revision_id=p_revision AND public.procurement_evidence_open(a.publication_id,a.site_id)))
$$;

-- Full replacements preserve pricing, authority, exact receipt idempotency and deadlines.
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


CREATE OR REPLACE FUNCTION public.submit_procurement_quotation(p_site uuid,p_document jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean:=false; result uuid; evidence jsonb:=COALESCE(p_document->'evidence','[]'::jsonb);
BEGIN
  IF auth.uid() IS NULL OR to_regprocedure('public.procurement_can_represent(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Verified representation required' USING ERRCODE='42501'; END IF;
  EXECUTE 'SELECT public.procurement_can_represent($1,$2)' INTO allowed USING p_site,(p_document->>'supplier_id')::uuid;
  IF NOT public.procurement_self_participation(p_site,(p_document->>'supplier_id')::uuid,(p_document->>'publication_id')::uuid,auth.uid()) THEN
  IF allowed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Verified representation required' USING ERRCODE='42501'; END IF;
  EXECUTE 'SELECT true FROM public.supplier_representatives WHERE site_id=$1 AND supplier_id=$2 AND user_id=$3 AND revoked_at IS NULL FOR SHARE'
    INTO allowed USING p_site,(p_document->>'supplier_id')::uuid,auth.uid();
  IF allowed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Verified representation required' USING ERRCODE='42501'; END IF;
  ELSE
    PERFORM 1 FROM public.procurement_open_registrations WHERE site_id=p_site AND supplier_id=(p_document->>'supplier_id')::uuid
      AND publication_id=(p_document->>'publication_id')::uuid AND user_id=auth.uid() FOR SHARE;
  END IF;
  IF jsonb_typeof(evidence) IS DISTINCT FROM 'array' OR jsonb_array_length(evidence)>100 THEN
    RAISE EXCEPTION 'Invalid evidence selection' USING ERRCODE='22023'; END IF;
  result:=public.capture_procurement_quotation(p_site,p_document,'supplier_submitted');
  IF jsonb_array_length(evidence)>0 THEN
    IF to_regprocedure('public.attach_procurement_quotation_evidence(uuid,jsonb)') IS NULL THEN
      RAISE EXCEPTION 'Evidence integration unavailable' USING ERRCODE='22023'; END IF;
    EXECUTE 'SELECT public.attach_procurement_quotation_evidence($1,$2)' USING result,evidence;
  END IF;
  IF p_document ? 'proposal_revision_id' THEN
    PERFORM public.attach_procurement_quotation_proposal(result,(p_document->>'proposal_revision_id')::uuid);
  END IF;
  RETURN result;
END $$;


REVOKE ALL ON FUNCTION public.capture_procurement_quotation(uuid,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.submit_procurement_quotation(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_procurement_quotation(uuid,jsonb) TO authenticated;

COMMIT;
