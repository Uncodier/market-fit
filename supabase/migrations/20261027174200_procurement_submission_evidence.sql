BEGIN;

CREATE TABLE public.procurement_submission_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quotation_id uuid NOT NULL REFERENCES public.quotations(id),
 publication_id uuid NOT NULL REFERENCES public.procurement_tender_publications(id), site_id uuid NOT NULL,
 supplier_id uuid NOT NULL, requirement_id uuid NOT NULL, revision_id uuid NOT NULL REFERENCES public.procurement_credential_revisions(id),
 submitted_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(quotation_id,requirement_id,revision_id),
 FOREIGN KEY(site_id,supplier_id) REFERENCES public.suppliers(site_id,id)
);
CREATE FUNCTION public.attach_procurement_quotation_evidence(p_quote uuid,p_evidence jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotations; p public.procurement_tender_publications; selection jsonb; r public.procurement_credential_revisions;
BEGIN
 SELECT * INTO q FROM public.quotations WHERE id=p_quote FOR UPDATE;
 IF q.procurement_source IS DISTINCT FROM 'supplier_submitted' OR q.procurement_custodian_id IS DISTINCT FROM auth.uid()
 OR NOT public.procurement_can_represent(q.buyer_site_id,q.procurement_supplier_id) THEN
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
-- Only the atomic supplier quotation RPC invokes this helper; no after-the-fact sharing.
REVOKE ALL ON FUNCTION public.attach_procurement_quotation_evidence(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.procurement_evidence_open(p_publication uuid,p_site uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.procurement_tender_access(p_site) AND EXISTS(SELECT 1 FROM public.procurement_tender_publications p
 WHERE p.id=p_publication AND p.site_id=p_site AND
 (p.snapshot->>'opening_policy'='on_receipt' OR
 (p.snapshot->>'opening_policy'='after_close' AND (p.snapshot->>'opening_at')::timestamptz<=now()
 AND (p.snapshot->>'participation_deadline')::timestamptz<=now())))
$$;
CREATE FUNCTION public.procurement_shared_revision_access(p_revision uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.procurement_submission_evidence e
 WHERE e.revision_id=p_revision AND public.procurement_evidence_open(e.publication_id,e.site_id))
$$;
ALTER TABLE public.procurement_submission_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_submission_evidence FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procurement_submission_evidence TO authenticated;
CREATE POLICY evidence_scoped_read ON public.procurement_submission_evidence FOR SELECT TO authenticated
 USING(submitted_by=auth.uid() OR public.procurement_evidence_open(publication_id,site_id));
CREATE POLICY credential_revision_shared_read ON public.procurement_credential_revisions FOR SELECT TO authenticated
 USING(state='ready' AND public.procurement_shared_revision_access(id));
CREATE TRIGGER procurement_submission_evidence_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
 ON public.procurement_submission_evidence FOR EACH STATEMENT EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();
CREATE OR REPLACE FUNCTION public.procurement_credential_object_access(p_name text,p_write boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.procurement_credential_revisions r
 WHERE r.object_path=p_name AND
 ((p_write AND r.uploader_id=auth.uid() AND r.state='pending' AND r.created_at>now()-interval '1 hour')
 OR (NOT p_write AND r.state='ready' AND (r.uploader_id=auth.uid() OR public.procurement_shared_revision_access(r.id)))))
$$;
REVOKE ALL ON FUNCTION public.procurement_evidence_open(uuid,uuid),public.procurement_shared_revision_access(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_evidence_open(uuid,uuid),public.procurement_shared_revision_access(uuid) TO authenticated;

CREATE FUNCTION public.my_procurement_participation() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(row),'[]'::jsonb) INTO result FROM (
  SELECT jsonb_build_object('site_id',p.site_id,'supplier_id',s.id,'supplier_name',s.name,'tender_id',p.tender_id,
   'publication_id',p.id,'version',p.version,'title',p.snapshot->>'title','description',p.snapshot->>'description',
   'currency',p.snapshot->>'currency','participation_deadline',p.snapshot->>'participation_deadline',
   'opening_at',p.snapshot->>'opening_at','opening_policy',p.snapshot->>'opening_policy',
   'requirements',(SELECT jsonb_agg(jsonb_build_object('id',line->>'id','description',line->>'description','quantity',line->'quantity','unit',line->>'unit'))
     FROM jsonb_array_elements(p.snapshot->'requirements') line)) AS row
  FROM public.supplier_representatives r JOIN public.suppliers s ON s.id=r.supplier_id AND s.site_id=r.site_id
  JOIN public.procurement_tenders t ON t.site_id=r.site_id
  JOIN public.procurement_tender_publications p ON p.tender_id=t.id AND p.version=t.version
  WHERE r.user_id=auth.uid() AND r.revoked_at IS NULL AND public.procurement_can_represent(r.site_id,r.supplier_id)
  AND s.status='approved' AND t.status='published' AND (p.snapshot->>'participation_deadline')::timestamptz>now()
  AND (p.snapshot->>'participation' IN ('open','approved_suppliers') OR EXISTS(
   SELECT 1 FROM public.procurement_tender_participants participant WHERE participant.tender_id=t.id AND participant.supplier_id=s.id AND participant.status='invited'))
  ORDER BY p.published_at DESC LIMIT 100
 ) rows;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.my_procurement_participation() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.my_procurement_participation() TO authenticated;

COMMIT;