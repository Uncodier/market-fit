BEGIN;
SET LOCAL lock_timeout='5s';

-- Enrich only opportunities already authorized by the canonical discovery RPC.
CREATE FUNCTION public.my_procurement_participation_details() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE(jsonb_agg(o.value || jsonb_build_object(
  'visibility',p.visibility,'participation',p.snapshot->>'participation')),'[]'::jsonb)
 FROM jsonb_array_elements(public.my_procurement_participation()) o(value)
 JOIN public.procurement_tender_publications p ON p.id=(o.value->>'publication_id')::uuid
$$;
REVOKE ALL ON FUNCTION public.my_procurement_participation_details() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.my_procurement_participation_details() TO authenticated;

-- Never accept a tenant or actor from the caller. Discovery checks active
-- representation, business licensing, invitation, publication and deadlines.
CREATE FUNCTION public.procurement_draft_site(p_publication uuid,p_version integer,p_applicant text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT (o.value->>'site_id')::uuid
 FROM jsonb_array_elements(public.my_procurement_participation()) o(value)
 WHERE (o.value->>'publication_id')::uuid=p_publication AND (o.value->>'version')::integer=p_version
 AND CASE WHEN o.value->>'acting_site_id' IS NOT NULL THEN 'business:'||(o.value->>'acting_site_id')
  WHEN (o.value->>'acting_as_self')::boolean OR o.value->>'supplier_id' IS NULL THEN 'personal'
  ELSE 'supplier:'||(o.value->>'supplier_id') END=p_applicant
 LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.procurement_draft_site(uuid,integer,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_draft_site(uuid,integer,text) TO authenticated;

CREATE SEQUENCE public.procurement_submission_draft_revision_seq AS bigint;
REVOKE ALL ON SEQUENCE public.procurement_submission_draft_revision_seq FROM PUBLIC,anon,service_role;
GRANT USAGE ON SEQUENCE public.procurement_submission_draft_revision_seq TO authenticated;
CREATE TABLE public.procurement_submission_drafts (
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 publication_id uuid NOT NULL REFERENCES public.procurement_tender_publications(id),
 publication_version integer NOT NULL CHECK(publication_version>0),
 applicant_key text NOT NULL CHECK(applicant_key='personal' OR applicant_key ~ '^(business|supplier):[0-9a-f-]{36}$'),
 site_id uuid NOT NULL REFERENCES public.sites(id), draft jsonb NOT NULL,
 draft_revision bigint NOT NULL DEFAULT nextval('public.procurement_submission_draft_revision_seq'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,publication_id,publication_version,applicant_key)
);
ALTER TABLE public.procurement_submission_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_submission_drafts FROM PUBLIC,anon,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.procurement_submission_drafts TO authenticated;
CREATE POLICY owner_draft_read ON public.procurement_submission_drafts FOR SELECT TO authenticated
 USING(owner_id=auth.uid());
CREATE POLICY owner_draft_delete ON public.procurement_submission_drafts FOR DELETE TO authenticated
 USING(owner_id=auth.uid());
CREATE POLICY owner_draft_insert ON public.procurement_submission_drafts FOR INSERT TO authenticated
 WITH CHECK(owner_id=auth.uid() AND site_id=public.procurement_draft_site(publication_id,publication_version,applicant_key));
CREATE POLICY owner_draft_update ON public.procurement_submission_drafts FOR UPDATE TO authenticated
 USING(owner_id=auth.uid())
 WITH CHECK(owner_id=auth.uid() AND site_id=public.procurement_draft_site(publication_id,publication_version,applicant_key));

CREATE FUNCTION public.guard_procurement_submission_draft() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE field text; limit_length integer; item record;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.owner_id,NEW.publication_id,NEW.publication_version,NEW.applicant_key,NEW.site_id)
   IS DISTINCT FROM (OLD.owner_id,OLD.publication_id,OLD.publication_version,OLD.applicant_key,OLD.site_id)
   OR NEW.draft->>'key' IS DISTINCT FROM OLD.draft->>'key'
   OR (OLD.draft->>'attempted'='true' AND NEW.draft IS DISTINCT FROM OLD.draft) THEN
   RAISE EXCEPTION 'Saved receipt and attempted payload are immutable' USING ERRCODE='40001'; END IF;
 END IF;
 IF jsonb_typeof(NEW.draft) IS DISTINCT FROM 'object' OR octet_length(NEW.draft::text)>131072 THEN
  RAISE EXCEPTION 'Invalid draft' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(NEW.draft))<>8
 OR NOT NEW.draft ?& ARRAY['reference','prices','evidence','key','attempted','registeredSupplier','proposalRevision','holderName']
 THEN
  RAISE EXCEPTION 'Invalid draft fields' USING ERRCODE='22023';
 END IF;
 FOREACH field IN ARRAY ARRAY['reference','key','proposalRevision','holderName','registeredSupplier'] LOOP
  limit_length:=CASE WHEN field IN ('reference','holderName') THEN 200 ELSE 100 END;
  IF field='registeredSupplier' AND NEW.draft->field='null'::jsonb THEN CONTINUE; END IF;
  IF jsonb_typeof(NEW.draft->field) IS DISTINCT FROM 'string' OR length(NEW.draft->>field)>limit_length
   OR (field='key' AND length(NEW.draft->>field)=0) THEN
   RAISE EXCEPTION 'Invalid draft string' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF jsonb_typeof(NEW.draft->'attempted') IS DISTINCT FROM 'boolean' THEN
  RAISE EXCEPTION 'Invalid attempted state' USING ERRCODE='22023'; END IF;
 FOREACH field IN ARRAY ARRAY['prices','evidence'] LOOP
  IF jsonb_typeof(NEW.draft->field) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Invalid draft entries' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(NEW.draft->field))>200 THEN
   RAISE EXCEPTION 'Too many draft entries' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT * FROM jsonb_each(NEW.draft->field) LOOP
   IF length(item.key) NOT BETWEEN 1 AND 100 OR jsonb_typeof(item.value)<>'string'
    OR length(item.value #>> '{}')>(CASE WHEN field='prices' THEN 40 ELSE 100 END) THEN
    RAISE EXCEPTION 'Invalid draft entry' USING ERRCODE='22023'; END IF;
  END LOOP;
 END LOOP;
 NEW.draft_revision:=nextval('public.procurement_submission_draft_revision_seq');
 NEW.updated_at:=clock_timestamp();
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_procurement_submission_draft() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER guard_procurement_submission_draft BEFORE INSERT OR UPDATE ON public.procurement_submission_drafts
 FOR EACH ROW EXECUTE FUNCTION public.guard_procurement_submission_draft();

-- User-scoped RPC: table access remains subject to owner-only RLS. A globally
-- increasing revision prevents stale requests after deletion/recreation (ABA).
CREATE FUNCTION public.procurement_submission_draft(p_action text,p_publication uuid,p_version integer,
 p_applicant text,p_expected_revision bigint DEFAULT NULL,p_draft jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE tenant uuid; saved public.procurement_submission_drafts;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('get','put','delete') THEN
  RAISE EXCEPTION 'Invalid draft action' USING ERRCODE='22023'; END IF;
 -- Serialize creation and mutation for this owner/selector, not other applicants.
 IF p_action<>'get' THEN PERFORM pg_advisory_xact_lock(hashtextextended(
  auth.uid()::text||p_publication::text||p_version::text||p_applicant,0)); END IF;
 SELECT * INTO saved FROM public.procurement_submission_drafts
 WHERE owner_id=auth.uid() AND publication_id=p_publication
 AND publication_version=p_version AND applicant_key=p_applicant;
 -- Retained owner receipts remain readable/clearable after close or revocation.
 -- Unknown selectors still require current participation and reveal no foreign row.
 IF saved.owner_id IS NULL THEN
  tenant:=public.procurement_draft_site(p_publication,p_version,p_applicant);
  IF tenant IS NULL THEN RAISE EXCEPTION 'Draft access denied' USING ERRCODE='42501'; END IF;
 END IF;
 IF p_action='get' THEN
  RETURN jsonb_build_object('draft',saved.draft,'draft_revision',saved.draft_revision); END IF;
 IF (saved.owner_id IS NULL AND p_expected_revision IS NOT NULL)
 OR (saved.owner_id IS NOT NULL AND p_expected_revision IS DISTINCT FROM saved.draft_revision)
 OR (p_action='delete' AND p_expected_revision IS NULL) THEN
  RAISE EXCEPTION 'Stale draft revision' USING ERRCODE='40001'; END IF;
 -- An ambiguous-send retry persists no changes. Its owner may recover the
 -- exact receipt after close/revocation; the submit RPC authorizes receipt replay.
 IF p_action='put' AND saved.draft->>'attempted'='true' AND p_draft=saved.draft THEN
  RETURN jsonb_build_object('draft',saved.draft,'draft_revision',saved.draft_revision); END IF;
 IF p_action='put' THEN
  tenant:=public.procurement_draft_site(p_publication,p_version,p_applicant);
  IF tenant IS NULL THEN RAISE EXCEPTION 'Draft access denied' USING ERRCODE='42501'; END IF;
 END IF;
 IF p_action='delete' THEN
  DELETE FROM public.procurement_submission_drafts WHERE owner_id=auth.uid() AND publication_id=p_publication
   AND publication_version=p_version AND applicant_key=p_applicant;
  RETURN jsonb_build_object('draft',NULL,'draft_revision',NULL);
 END IF;
 IF saved.owner_id IS NULL THEN
  INSERT INTO public.procurement_submission_drafts(owner_id,publication_id,publication_version,applicant_key,site_id,draft)
   VALUES(auth.uid(),p_publication,p_version,p_applicant,tenant,p_draft) RETURNING * INTO saved;
 ELSE
  UPDATE public.procurement_submission_drafts SET draft=p_draft WHERE owner_id=auth.uid() AND publication_id=p_publication
   AND publication_version=p_version AND applicant_key=p_applicant RETURNING * INTO saved;
 END IF;
 RETURN jsonb_build_object('draft',saved.draft,'draft_revision',saved.draft_revision);
END $$;
REVOKE ALL ON FUNCTION public.procurement_submission_draft(text,uuid,integer,text,bigint,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_submission_draft(text,uuid,integer,text,bigint,jsonb) TO authenticated;
COMMIT;