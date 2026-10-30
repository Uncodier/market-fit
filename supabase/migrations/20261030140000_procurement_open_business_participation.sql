BEGIN;
SET LOCAL lock_timeout='5s';

-- Same owner/active licensed member semantics as current_user_site_role. The
-- explicit actor is internal only, for post-close validation of quote custodians.
CREATE FUNCTION public.procurement_business_access(p_site uuid,p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p_actor IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.sites s WHERE s.id=p_site AND s.archived_at IS NULL
  AND (s.user_id=p_actor OR EXISTS(SELECT 1 FROM public.site_members m
   WHERE m.site_id=s.id AND m.user_id=p_actor AND m.status='active'
    AND public.site_member_has_effective_license(m.id))))
$$;
REVOKE ALL ON FUNCTION public.procurement_business_access(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- One fresh identity per publication/business, shared by its authorized members.
-- Never infer representation from names, email, companies or existing suppliers.
CREATE TABLE public.procurement_open_business_registrations (
 publication_id uuid NOT NULL REFERENCES public.procurement_tender_publications(id),
 acting_site_id uuid NOT NULL REFERENCES public.sites(id), site_id uuid NOT NULL,
 supplier_id uuid NOT NULL, registered_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(publication_id,acting_site_id),
 UNIQUE(site_id,supplier_id), FOREIGN KEY(site_id,supplier_id) REFERENCES public.suppliers(site_id,id)
);
ALTER TABLE public.procurement_open_business_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_open_business_registrations FROM PUBLIC,anon,authenticated,service_role;
-- No direct table access: discovery is through the filtered opportunity DTO.
CREATE TRIGGER open_business_registration_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
 ON public.procurement_open_business_registrations FOR EACH STATEMENT
 EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();

CREATE FUNCTION public.register_open_tender_business(p_publication uuid,p_acting_site uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.procurement_tender_publications; t public.procurement_tenders; result uuid; business_name text;
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
 SELECT name INTO business_name FROM public.sites WHERE id=p_acting_site FOR SHARE;
 PERFORM 1 FROM public.site_members WHERE site_id=p_acting_site FOR SHARE;
 IF NOT public.procurement_business_access(p_acting_site,auth.uid()) THEN
  RAISE EXCEPTION 'Business participation denied' USING ERRCODE='42501'; END IF;
 SELECT supplier_id INTO result FROM public.procurement_open_business_registrations
  WHERE publication_id=p.id AND acting_site_id=p_acting_site;
 IF result IS NULL THEN
  INSERT INTO public.suppliers(site_id,name,status,created_by)
   VALUES(p.site_id,left(COALESCE(NULLIF(btrim(business_name),''),'Business workspace'),200),'prospect',auth.uid()) RETURNING id INTO result;
  INSERT INTO public.procurement_open_business_registrations(publication_id,acting_site_id,site_id,supplier_id,registered_by)
   VALUES(p.id,p_acting_site,p.site_id,result,auth.uid());
 END IF;
 PERFORM 1 FROM public.suppliers WHERE id=result AND site_id=p.site_id AND status NOT IN ('blocked','archived') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Business participation unavailable' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.register_open_tender_business(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_open_tender_business(uuid,uuid) TO authenticated;

-- Legacy helper name retained for evidence, proposal, capture and award callers.
-- Both branches are publication-scoped open participation, NOT representation.
-- No deadline check here: receipt retries and post-close awards still work.
CREATE OR REPLACE FUNCTION public.procurement_self_participation(p_site uuid,p_supplier uuid,p_publication uuid,p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p_actor IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.procurement_tender_publications p
  JOIN public.suppliers s ON s.id=p_supplier AND s.site_id=p.site_id
  JOIN public.sites workspace ON workspace.id=p.site_id AND workspace.archived_at IS NULL
  JOIN public.procurement_tender_portals portal ON portal.site_id=p.site_id AND portal.enabled
  JOIN auth.users account ON account.id=p_actor AND account.email_confirmed_at IS NOT NULL
  WHERE p.id=p_publication AND p.site_id=p_site AND p.visibility='public'
   AND p.snapshot->>'participation'='open' AND s.status NOT IN ('blocked','archived')
   AND (EXISTS(SELECT 1 FROM public.procurement_open_registrations r
    WHERE r.publication_id=p.id AND r.site_id=p.site_id AND r.supplier_id=s.id AND r.user_id=p_actor)
   OR EXISTS(SELECT 1 FROM public.procurement_open_business_registrations r
    WHERE r.publication_id=p.id AND r.site_id=p.site_id AND r.supplier_id=s.id
     AND public.procurement_business_access(r.acting_site_id,p_actor)))
 )
$$;
REVOKE ALL ON FUNCTION public.procurement_self_participation(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.submit_procurement_quotation(p_site uuid,p_document jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean:=false; result uuid; business uuid; evidence jsonb:=COALESCE(p_document->'evidence','[]'::jsonb);
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Verified representation required' USING ERRCODE='42501'; END IF;
 SELECT acting_site_id INTO business FROM public.procurement_open_business_registrations
  WHERE site_id=p_site AND supplier_id=(p_document->>'supplier_id')::uuid;
 IF business IS NOT NULL THEN
  -- Lock and recheck even if somebody later grants representation/approval to
  -- this internal identity. A grant must never bypass workspace revocation.
  PERFORM 1 FROM public.sites WHERE id=business FOR SHARE;
  PERFORM 1 FROM public.site_members WHERE site_id=business FOR SHARE;
  IF NOT public.procurement_self_participation(p_site,(p_document->>'supplier_id')::uuid,
   (p_document->>'publication_id')::uuid,auth.uid()) THEN
   RAISE EXCEPTION 'Business participation denied' USING ERRCODE='42501'; END IF;
 ELSIF NOT public.procurement_self_participation(p_site,(p_document->>'supplier_id')::uuid,(p_document->>'publication_id')::uuid,auth.uid()) THEN
  IF NOT public.procurement_can_represent(p_site,(p_document->>'supplier_id')::uuid) THEN
   RAISE EXCEPTION 'Verified representation required' USING ERRCODE='42501'; END IF;
  SELECT true INTO allowed FROM public.supplier_representatives WHERE site_id=p_site
   AND supplier_id=(p_document->>'supplier_id')::uuid AND user_id=auth.uid() AND revoked_at IS NULL FOR SHARE;
  IF allowed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Verified representation required' USING ERRCODE='42501'; END IF;
 ELSE
  PERFORM 1 FROM public.procurement_open_registrations WHERE site_id=p_site AND supplier_id=(p_document->>'supplier_id')::uuid
   AND publication_id=(p_document->>'publication_id')::uuid AND user_id=auth.uid() FOR SHARE;
 END IF;
 IF jsonb_typeof(evidence) IS DISTINCT FROM 'array' OR jsonb_array_length(evidence)>100 THEN
  RAISE EXCEPTION 'Invalid evidence selection' USING ERRCODE='22023'; END IF;
 result:=public.capture_procurement_quotation(p_site,p_document,'supplier_submitted');
 IF jsonb_array_length(evidence)>0 THEN PERFORM public.attach_procurement_quotation_evidence(result,evidence); END IF;
 IF p_document ? 'proposal_revision_id' THEN
  PERFORM public.attach_procurement_quotation_proposal(result,(p_document->>'proposal_revision_id')::uuid);
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.submit_procurement_quotation(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_procurement_quotation(uuid,jsonb) TO authenticated;

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
  SELECT p.id AS publication_id,s.id AS supplier_id,s.name AS supplier_name,false AS acting_as_self,NULL::uuid AS acting_site_id
  FROM opportunities p JOIN public.supplier_representatives r ON r.site_id=p.site_id AND r.user_id=auth.uid() AND r.revoked_at IS NULL
  JOIN public.suppliers s ON s.site_id=r.site_id AND s.id=r.supplier_id AND s.status='approved'
  WHERE public.procurement_can_represent(r.site_id,r.supplier_id)
   AND NOT EXISTS(SELECT 1 FROM public.procurement_open_business_registrations b WHERE b.site_id=s.site_id AND b.supplier_id=s.id)
   AND (p.snapshot->>'participation' IN ('open','approved_suppliers') OR EXISTS(
    SELECT 1 FROM public.procurement_tender_participants participant WHERE participant.tender_id=p.tender_id
     AND participant.supplier_id=s.id AND participant.status='invited'))
  UNION ALL
  SELECT p.id,self.supplier_id,'On behalf of myself'::text,true,NULL::uuid
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
  UNION ALL
  SELECT p.id,b.supplier_id,business.name,false,business.id
  FROM opportunities p
  JOIN public.procurement_tender_portals portal ON portal.site_id=p.site_id AND portal.enabled
  JOIN auth.users account ON account.id=auth.uid() AND account.email_confirmed_at IS NOT NULL
  JOIN public.sites business ON public.procurement_business_access(business.id,auth.uid())
  LEFT JOIN public.procurement_open_business_registrations b ON b.publication_id=p.id AND b.acting_site_id=business.id
  WHERE p.visibility='public' AND p.snapshot->>'participation'='open'
   AND (b.supplier_id IS NULL OR EXISTS(SELECT 1 FROM public.suppliers s WHERE s.site_id=p.site_id
    AND s.id=b.supplier_id AND s.status NOT IN ('blocked','archived')))
 )
 SELECT COALESCE(jsonb_agg(row),'[]'::jsonb) INTO result FROM (
  SELECT jsonb_build_object('site_id',p.site_id,'supplier_id',c.supplier_id,'supplier_name',c.supplier_name,
   'acting_as_self',c.acting_as_self,'acting_site_id',c.acting_site_id,'tender_id',p.tender_id,
   'publication_id',p.id,'version',p.version,'title',p.snapshot->>'title','description',p.snapshot->>'description',
   'currency',p.snapshot->>'currency','participation_deadline',p.snapshot->>'participation_deadline',
   'opening_at',p.snapshot->>'opening_at','opening_policy',p.snapshot->>'opening_policy',
   'requirements',(SELECT jsonb_agg(jsonb_build_object('id',line->>'id','description',line->>'description','quantity',line->'quantity','unit',line->>'unit'))
    FROM jsonb_array_elements(p.snapshot->'requirements') line)) AS row
  FROM choices c JOIN opportunities p ON p.id=c.publication_id
  ORDER BY p.published_at DESC,p.id,c.acting_site_id NULLS FIRST,c.supplier_id
 ) rows;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.my_procurement_participation() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.my_procurement_participation() TO authenticated;

COMMIT;