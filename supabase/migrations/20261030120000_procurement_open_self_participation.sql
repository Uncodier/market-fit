BEGIN;
SET LOCAL lock_timeout='5s';

-- Newly created account identities, never matched by email, contact or company.
-- This confers neither buyer approval nor organization representation.
CREATE TABLE public.procurement_self_suppliers (
 site_id uuid NOT NULL REFERENCES public.sites(id), user_id uuid NOT NULL REFERENCES auth.users(id),
 supplier_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(site_id,user_id), UNIQUE(site_id,supplier_id,user_id),
 FOREIGN KEY(site_id,supplier_id) REFERENCES public.suppliers(site_id,id)
);
CREATE TABLE public.procurement_open_registrations (
 publication_id uuid NOT NULL REFERENCES public.procurement_tender_publications(id),
 site_id uuid NOT NULL, supplier_id uuid NOT NULL, user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(publication_id,user_id),
 FOREIGN KEY(site_id,supplier_id,user_id) REFERENCES public.procurement_self_suppliers(site_id,supplier_id,user_id)
);
ALTER TABLE public.procurement_self_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_open_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_self_suppliers,public.procurement_open_registrations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procurement_self_suppliers,public.procurement_open_registrations TO authenticated;
CREATE POLICY self_supplier_read ON public.procurement_self_suppliers FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY open_registration_read ON public.procurement_open_registrations FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TRIGGER self_supplier_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.procurement_self_suppliers
 FOR EACH STATEMENT EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();
CREATE TRIGGER open_registration_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.procurement_open_registrations
 FOR EACH STATEMENT EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();

-- Internal only: commerce supplies the trusted quote custodian; submission uses
-- auth.uid(). No deadlines here, so exact retries and post-close awards work.
CREATE FUNCTION public.procurement_self_participation(p_site uuid,p_supplier uuid,p_publication uuid,p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p_actor IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.procurement_open_registrations r
  JOIN public.procurement_tender_publications p ON p.id=r.publication_id AND p.site_id=r.site_id
  JOIN public.suppliers s ON s.id=r.supplier_id AND s.site_id=r.site_id
  JOIN public.sites workspace ON workspace.id=r.site_id AND workspace.archived_at IS NULL
  JOIN public.procurement_tender_portals portal ON portal.site_id=r.site_id AND portal.enabled
  JOIN auth.users account ON account.id=r.user_id AND account.email_confirmed_at IS NOT NULL
  WHERE r.publication_id=p_publication AND r.site_id=p_site AND r.supplier_id=p_supplier AND r.user_id=p_actor
   AND p.visibility='public' AND p.snapshot->>'participation'='open' AND s.status NOT IN ('blocked','archived')
 )
$$;
REVOKE ALL ON FUNCTION public.procurement_self_participation(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;


CREATE FUNCTION public.register_open_tender_participant(p_publication uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.procurement_tender_publications; t public.procurement_tenders; result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Confirmed account required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.procurement_tender_publications WHERE id=p_publication;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Open public tender required' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.procurement_tenders WHERE id=p.tender_id AND site_id=p.site_id FOR UPDATE;
 IF t.id IS NULL OR t.status<>'published' OR t.version IS DISTINCT FROM p.version
 OR p.visibility IS DISTINCT FROM 'public' OR p.snapshot->>'participation' IS DISTINCT FROM 'open'
 OR (p.snapshot->>'participation_deadline')::timestamptz IS NULL
 OR (p.snapshot->>'participation_deadline')::timestamptz<=clock_timestamp()
 OR EXISTS(SELECT 1 FROM public.procurement_tender_publications newer WHERE newer.tender_id=t.id AND newer.version>p.version) THEN
  RAISE EXCEPTION 'Open public tender required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.sites WHERE id=p.site_id AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Open public tender required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.procurement_tender_portals WHERE site_id=p.site_id AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Open public tender required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('procurement_self:'||p.site_id::text||auth.uid()::text,0));
 SELECT supplier_id INTO result FROM public.procurement_self_suppliers WHERE site_id=p.site_id AND user_id=auth.uid();
 IF result IS NULL THEN
  INSERT INTO public.suppliers(site_id,name,status,created_by) VALUES(p.site_id,'On behalf of myself','prospect',auth.uid()) RETURNING id INTO result;
  INSERT INTO public.procurement_self_suppliers(site_id,user_id,supplier_id) VALUES(p.site_id,auth.uid(),result);
 END IF;
 PERFORM 1 FROM public.suppliers WHERE site_id=p.site_id AND id=result AND status NOT IN ('blocked','archived') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Self participation unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO public.procurement_open_registrations(publication_id,site_id,supplier_id,user_id)
 VALUES(p.id,p.site_id,result,auth.uid()) ON CONFLICT(publication_id,user_id) DO NOTHING;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.register_open_tender_participant(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_open_tender_participant(uuid) TO authenticated;

-- Preserve monetary validation, evidence custody, sealing and commerce policy checks.

CREATE OR REPLACE FUNCTION public.capture_procurement_quotation(p_site uuid,p_document jsonb,p_source text) RETURNS uuid
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
  RETURN result;
END $$;


CREATE OR REPLACE FUNCTION public.attach_procurement_quotation_evidence(p_quote uuid,p_evidence jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotations; p public.procurement_tender_publications; selection jsonb; r public.procurement_credential_revisions;
BEGIN
 SELECT * INTO q FROM public.quotations WHERE id=p_quote FOR UPDATE;
 IF q.procurement_source IS DISTINCT FROM 'supplier_submitted' OR q.procurement_custodian_id IS DISTINCT FROM auth.uid()
 OR NOT (public.procurement_can_represent(q.buyer_site_id,q.procurement_supplier_id)
  OR public.procurement_self_participation(q.buyer_site_id,q.procurement_supplier_id,q.procurement_publication_id,auth.uid())) THEN
  RAISE EXCEPTION 'Evidence sharing denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.procurement_tender_publications WHERE id=q.procurement_publication_id;
 IF jsonb_typeof(p_evidence) IS DISTINCT FROM 'array' OR jsonb_array_length(p_evidence)>100 THEN
  RAISE EXCEPTION 'Invalid evidence selection' USING ERRCODE='22023'; END IF;
 FOR selection IN SELECT value FROM jsonb_array_elements(p_evidence) LOOP
  IF jsonb_typeof(selection) IS DISTINCT FROM 'object' OR NOT selection ?& ARRAY['requirement_id','revision_id']
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(selection) k WHERE k NOT IN ('requirement_id','revision_id'))
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.snapshot->'requirements') line WHERE line->>'id'=selection->>'requirement_id') THEN
   RAISE EXCEPTION 'Evidence must match a published requirement' USING ERRCODE='22023'; END IF;
  -- An exact receipt retry remains valid after later profile archival or renewal.
  IF EXISTS(SELECT 1 FROM public.procurement_submission_evidence WHERE quotation_id=q.id
   AND requirement_id=(selection->>'requirement_id')::uuid AND revision_id=(selection->>'revision_id')::uuid) THEN CONTINUE; END IF;
  SELECT revision.* INTO r FROM public.procurement_credential_revisions revision
  JOIN public.procurement_credentials credential ON credential.id=revision.credential_id
  WHERE revision.id=(selection->>'revision_id')::uuid AND revision.uploader_id=auth.uid() AND revision.state='ready'
  AND credential.owner_id=auth.uid() AND credential.archived_at IS NULL FOR SHARE OF credential,revision;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Private evidence unavailable' USING ERRCODE='42501'; END IF;
  INSERT INTO public.procurement_submission_evidence(quotation_id,publication_id,site_id,supplier_id,requirement_id,revision_id,submitted_by)
  VALUES(q.id,p.id,q.buyer_site_id,q.procurement_supplier_id,(selection->>'requirement_id')::uuid,r.id,auth.uid()) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;


CREATE OR REPLACE FUNCTION public.procurement_supplier_proposal_count(p_site uuid,p_publication uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT count(DISTINCT proposal.procurement_supplier_id)::integer FROM public.quotations proposal
    JOIN public.suppliers supplier ON supplier.id=proposal.procurement_supplier_id AND supplier.site_id=p_site
    JOIN public.procurement_tender_publications publication ON publication.id=proposal.procurement_publication_id
    WHERE proposal.procurement_publication_id=p_publication AND proposal.buyer_site_id=p_site
      AND (supplier.status='approved' OR (proposal.procurement_source='supplier_submitted' AND
         public.procurement_self_participation(p_site,supplier.id,publication.id,proposal.procurement_custodian_id)))
      AND (CASE WHEN proposal.procurement_source='buyer_recorded' OR publication.snapshot->>'participation'='invitation_only'
        THEN EXISTS(SELECT 1 FROM public.procurement_tender_participants participant
          WHERE participant.tender_id=proposal.procurement_tender_id AND participant.supplier_id=supplier.id AND participant.status='invited')
        ELSE publication.snapshot->>'participation' IN ('open','approved_suppliers') END);
$$;

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
  IF p_event='award' AND EXISTS(SELECT 1 FROM public.procurement_awards WHERE tender_id=t.id AND quotation_id<>q.id) THEN
    RAISE EXCEPTION 'Tender already awarded' USING ERRCODE='40001'; END IF;
END $$;



CREATE OR REPLACE FUNCTION public.my_procurement_participation() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 WITH opportunities AS (
  SELECT p.* FROM public.procurement_tenders t
  JOIN public.procurement_tender_publications p ON p.tender_id=t.id AND p.site_id=t.site_id AND p.version=t.version
  JOIN public.sites workspace ON workspace.id=p.site_id AND workspace.archived_at IS NULL
  WHERE t.status='published' AND (p.snapshot->>'participation_deadline')::timestamptz>now()
   AND NOT EXISTS(SELECT 1 FROM public.procurement_tender_publications newer WHERE newer.tender_id=t.id AND newer.version>p.version)
 ), choices AS (
   SELECT p.id AS publication_id,s.id AS supplier_id,s.name AS supplier_name,false AS acting_as_self
  FROM opportunities p JOIN public.supplier_representatives r ON r.site_id=p.site_id AND r.user_id=auth.uid() AND r.revoked_at IS NULL
  JOIN public.suppliers s ON s.site_id=r.site_id AND s.id=r.supplier_id AND s.status='approved'
  WHERE public.procurement_can_represent(r.site_id,r.supplier_id)
   AND (p.snapshot->>'participation' IN ('open','approved_suppliers') OR EXISTS(
    SELECT 1 FROM public.procurement_tender_participants participant WHERE participant.tender_id=p.tender_id
      AND participant.supplier_id=s.id AND participant.status='invited'))
  UNION ALL
   SELECT p.id,self.supplier_id,'On behalf of myself'::text,true
  FROM opportunities p
  JOIN public.procurement_tender_portals portal ON portal.site_id=p.site_id AND portal.enabled
  JOIN auth.users account ON account.id=auth.uid() AND account.email_confirmed_at IS NOT NULL
  LEFT JOIN public.procurement_self_suppliers self ON self.site_id=p.site_id AND self.user_id=auth.uid()
  WHERE p.visibility='public' AND p.snapshot->>'participation'='open'
   AND (self.supplier_id IS NULL OR EXISTS(SELECT 1 FROM public.suppliers s WHERE s.site_id=p.site_id
    AND s.id=self.supplier_id AND s.status NOT IN ('blocked','archived')))
   AND NOT EXISTS(SELECT 1 FROM public.supplier_representatives r WHERE r.site_id=p.site_id AND r.supplier_id=self.supplier_id
    AND r.user_id=auth.uid() AND r.revoked_at IS NULL AND public.procurement_can_represent(r.site_id,r.supplier_id)
    AND EXISTS(SELECT 1 FROM public.suppliers s WHERE s.id=r.supplier_id AND s.site_id=r.site_id AND s.status='approved'))
 )
 SELECT COALESCE(jsonb_agg(row),'[]'::jsonb) INTO result FROM (
   SELECT jsonb_build_object('site_id',p.site_id,'supplier_id',c.supplier_id,'supplier_name',c.supplier_name,'acting_as_self',c.acting_as_self,'tender_id',p.tender_id,
   'publication_id',p.id,'version',p.version,'title',p.snapshot->>'title','description',p.snapshot->>'description',
   'currency',p.snapshot->>'currency','participation_deadline',p.snapshot->>'participation_deadline',
   'opening_at',p.snapshot->>'opening_at','opening_policy',p.snapshot->>'opening_policy',
   'requirements',(SELECT jsonb_agg(jsonb_build_object('id',line->>'id','description',line->>'description','quantity',line->'quantity','unit',line->>'unit'))
     FROM jsonb_array_elements(p.snapshot->'requirements') line)) AS row
  FROM choices c JOIN opportunities p ON p.id=c.publication_id ORDER BY p.published_at DESC,p.id,c.supplier_id LIMIT 100
 ) rows;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.capture_procurement_quotation(uuid,jsonb,text),
 public.attach_procurement_quotation_evidence(uuid,jsonb),
 public.procurement_supplier_proposal_count(uuid,uuid),
 public.procurement_validate_commerce_event(uuid,uuid,integer,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.submit_procurement_quotation(uuid,jsonb),public.my_procurement_participation()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_procurement_quotation(uuid,jsonb),public.my_procurement_participation() TO authenticated;

COMMIT;
