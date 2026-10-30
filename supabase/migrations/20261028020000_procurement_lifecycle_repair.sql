BEGIN;

-- Internal publication provenance is deliberately separate from the public DTO.
CREATE TABLE public.procurement_tender_policy_bindings (
  publication_id uuid PRIMARY KEY REFERENCES public.procurement_tender_publications(id),
  tender_id uuid NOT NULL REFERENCES public.procurement_tenders(id),
  request_id uuid REFERENCES public.procurement_requests(id),
  request_revision integer,
  request_plan jsonb,
  working_snapshot jsonb
);
CREATE INDEX procurement_tender_policy_bindings_tender ON public.procurement_tender_policy_bindings(tender_id);
ALTER TABLE public.procurement_tender_policy_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_tender_policy_bindings FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public.procurement_tender_policy_bindings FOR EACH STATEMENT
  EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();

-- Only exact historical saved versions are trustworthy. Missing provenance stays
-- NULL and fails closed; never infer an old request binding from today's draft.
INSERT INTO public.procurement_tender_policy_bindings
SELECT p.id,p.tender_id,(saved.snapshot->>'request_id')::uuid,
  (submitted.snapshot->>'revision')::integer,submitted.snapshot->'resolved_plan',
  saved.snapshot-ARRAY['status','updated_at','version']
FROM public.procurement_tender_publications p
LEFT JOIN LATERAL (SELECT a.snapshot FROM public.procurement_tender_audit a
  WHERE a.tender_id=p.tender_id AND a.site_id=p.site_id AND a.version=p.version AND a.event='saved'
  ORDER BY a.created_at DESC LIMIT 1) saved ON true
LEFT JOIN LATERAL (SELECT a.snapshot FROM public.procurement_request_audit a
  WHERE a.request_id=(saved.snapshot->>'request_id')::uuid AND a.event='submitted' AND a.created_at<=p.published_at
  ORDER BY a.created_at DESC LIMIT 1) submitted ON true;

CREATE FUNCTION public.procurement_inherited_policy(p_site uuid,p_tender uuid,p_event text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.procurement_tenders; r public.procurement_requests; plan jsonb; requirement jsonb;
  requirements jsonb:='[]'; minimum integer:=0; milestones text[];
BEGIN
  IF NOT public.procurement_tender_access(p_site,'update') THEN RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_policy:'||p_site::text,0));
  SELECT * INTO t FROM public.procurement_tenders WHERE id=p_tender AND site_id=p_site FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tender access denied' USING ERRCODE='42501'; END IF;
  milestones:=CASE p_event WHEN 'publication' THEN ARRAY['participation']
    WHEN 'award' THEN ARRAY['participation','evaluation','award']
    WHEN 'order' THEN ARRAY['participation','evaluation','award','order'] END;
  IF milestones IS NULL THEN RAISE EXCEPTION 'Unsupported event' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.procurement_tender_policy_bindings b WHERE b.tender_id=t.id
    AND (b.working_snapshot IS NULL OR b.request_id IS DISTINCT FROM t.request_id)) THEN
    RAISE EXCEPTION 'Published request provenance unavailable or changed' USING ERRCODE='40001'; END IF;
  IF t.request_id IS NOT NULL THEN
    SELECT * INTO r FROM public.procurement_requests WHERE id=t.request_id AND site_id=p_site FOR SHARE;
    IF NOT FOUND OR r.status<>'approved' OR r.policy_revision IS DISTINCT FROM
      (SELECT max(revision) FROM public.procurement_policy_versions WHERE site_id=p_site) THEN
      RAISE EXCEPTION 'Current request approval required; explicitly revalidate approval' USING ERRCODE='40001'; END IF;
    FOR plan IN SELECT r.resolved_plan UNION ALL SELECT b.request_plan
      FROM public.procurement_tender_policy_bindings b WHERE b.tender_id=t.id AND b.request_id IS NOT NULL LOOP
      IF plan->>'status' IS DISTINCT FROM 'ready' OR jsonb_typeof(plan->'requirements') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Inherited request policy unavailable' USING ERRCODE='22023'; END IF;
      minimum:=greatest(minimum,COALESCE((plan->>'minimumSupplierProposals')::integer,0));
      FOR requirement IN SELECT value FROM jsonb_array_elements(plan->'requirements') LOOP
        IF requirement->>'milestone' IS NULL OR requirement->>'milestone' NOT IN ('participation','evaluation','award','order','receipt')
          OR requirement->>'milestone'=ANY(milestones) THEN
          requirements:=requirements||jsonb_build_array(requirement);
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('inherited_requirements',requirements,'minimum_supplier_proposals',minimum);
END $$;
REVOKE ALL ON FUNCTION public.procurement_inherited_policy(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_inherited_policy(uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.procurement_guard_tender_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.procurement_tender_policy_bindings; published_version integer;
BEGIN
  IF EXISTS(SELECT 1 FROM public.procurement_tender_publications WHERE tender_id=OLD.id) THEN
    IF NEW.request_id IS DISTINCT FROM OLD.request_id THEN
      RAISE EXCEPTION 'Published request binding is immutable' USING ERRCODE='40001'; END IF;
    IF NEW.status='closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
      SELECT binding.* INTO b
        FROM public.procurement_tender_policy_bindings binding JOIN public.procurement_tender_publications p ON p.id=binding.publication_id
        WHERE p.tender_id=OLD.id ORDER BY p.version DESC LIMIT 1;
      SELECT version INTO published_version FROM public.procurement_tender_publications WHERE id=b.publication_id;
      IF b.working_snapshot IS NULL OR OLD.version IS DISTINCT FROM published_version
        OR to_jsonb(OLD)-ARRAY['status','updated_at','version'] IS DISTINCT FROM b.working_snapshot THEN
        RAISE EXCEPTION 'Publish all amendments before closing' USING ERRCODE='40001'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.procurement_guard_tender_lifecycle() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER procurement_lifecycle_guard BEFORE UPDATE ON public.procurement_tenders
  FOR EACH ROW EXECUTE FUNCTION public.procurement_guard_tender_lifecycle();

CREATE FUNCTION public.procurement_capture_publication_policy() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.procurement_tenders; r public.procurement_requests; inherited jsonb;
BEGIN
  inherited:=public.procurement_inherited_policy(NEW.site_id,NEW.tender_id,'publication');
  IF jsonb_array_length(inherited->'inherited_requirements')>0 THEN
    RAISE EXCEPTION 'Inherited publication requirements unresolved' USING ERRCODE='22023'; END IF;
  SELECT * INTO STRICT t FROM public.procurement_tenders WHERE id=NEW.tender_id;
  SELECT * INTO r FROM public.procurement_requests WHERE id=t.request_id;
  INSERT INTO public.procurement_tender_policy_bindings VALUES
    (NEW.id,t.id,t.request_id,r.revision,r.resolved_plan,to_jsonb(t)-ARRAY['status','updated_at','version']);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.procurement_capture_publication_policy() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER procurement_publication_policy AFTER INSERT ON public.procurement_tender_publications
  FOR EACH ROW EXECUTE FUNCTION public.procurement_capture_publication_policy();

CREATE FUNCTION public.procurement_guard_publication_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE inherited jsonb;
BEGIN
  IF NEW.event='publication' THEN
    inherited:=public.procurement_inherited_policy(NEW.site_id,NEW.target_id,'publication');
    IF jsonb_typeof(NEW.plan->'requirements') IS DISTINCT FROM 'array'
      OR jsonb_array_length(NEW.plan->'requirements')>0 OR NEW.plan->>'minimumSupplierProposals' IS NOT NULL
      OR jsonb_array_length(inherited->'inherited_requirements')>0 THEN
      RAISE EXCEPTION 'Publication requirements unresolved' USING ERRCODE='22023'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.procurement_guard_publication_approval() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER procurement_publication_approval_guard BEFORE INSERT ON public.procurement_event_approvals
  FOR EACH ROW EXECUTE FUNCTION public.procurement_guard_publication_approval();

ALTER TABLE public.procurement_requests ADD COLUMN revalidation_of_revision integer;
CREATE FUNCTION public.procurement_guard_revalidated_content() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF OLD.revalidation_of_revision IS NOT NULL AND
    (to_jsonb(NEW)-ARRAY['revision','status','policy_revision','policy_snapshot','resolved_plan','updated_at','revalidation_of_revision']
      IS DISTINCT FROM to_jsonb(OLD)-ARRAY['revision','status','policy_revision','policy_snapshot','resolved_plan','updated_at','revalidation_of_revision']
      OR (NEW.revision<>OLD.revision AND (OLD.status NOT IN ('approved','returned')
        OR NEW.revalidation_of_revision IS DISTINCT FROM OLD.revision))) THEN
    RAISE EXCEPTION 'Revalidation preserves approved content; editing is not allowed' USING ERRCODE='40001'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.procurement_guard_revalidated_content() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER procurement_revalidated_content BEFORE UPDATE ON public.procurement_requests
  FOR EACH ROW EXECUTE FUNCTION public.procurement_guard_revalidated_content();

CREATE FUNCTION public.revalidate_procurement_request(p_site uuid,p_id uuid,p_revision integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.procurement_requests;
BEGIN
  IF NOT public.procurement_request_access(p_site) OR NOT COALESCE(public.user_can(p_site,'update'),false) THEN
    RAISE EXCEPTION 'Request access denied' USING ERRCODE='42501'; END IF;
  -- Same lock order as publication and order materialization prevents a committed
  -- order racing this deliberate return to draft.
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_policy:'||p_site::text,0));
  SELECT * INTO r FROM public.procurement_requests WHERE id=p_id AND site_id=p_site FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request access denied' USING ERRCODE='42501'; END IF;
  IF r.revision IS DISTINCT FROM p_revision OR NOT (r.status='approved' OR
    (r.status='returned' AND r.revalidation_of_revision IS NOT NULL)) THEN
    RAISE EXCEPTION 'Request revision or state changed' USING ERRCODE='40001'; END IF;
  IF EXISTS(SELECT 1 FROM public.purchase_orders po JOIN public.procurement_awards a ON a.id=po.award_id
    JOIN public.procurement_tenders t ON t.id=a.tender_id WHERE t.request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.purchase_orders po JOIN public.procurement_awards a ON a.id=po.award_id
      JOIN public.procurement_tender_policy_bindings b ON b.tender_id=a.tender_id WHERE b.request_id=r.id) THEN
    RAISE EXCEPTION 'Committed orders prevent request revalidation' USING ERRCODE='40001'; END IF;
  INSERT INTO public.procurement_request_items(request_id,revision,position,catalog_item_id,category_ids,description,
    quantity,valuation_source,unit_net_minor,net_amount_minor,tax_snapshot)
  SELECT request_id,r.revision+1,position,catalog_item_id,category_ids,description,
    quantity,valuation_source,unit_net_minor,net_amount_minor,tax_snapshot
    FROM public.procurement_request_items WHERE request_id=r.id AND revision=r.revision;
  UPDATE public.procurement_requests SET revision=r.revision+1,revalidation_of_revision=r.revision,status='draft',policy_revision=NULL,
    policy_snapshot=NULL,resolved_plan=NULL,updated_at=clock_timestamp() WHERE id=r.id;
  INSERT INTO public.procurement_request_audit(request_id,revision,actor_id,event,snapshot)
    VALUES(r.id,r.revision+1,auth.uid(),'approval_revalidation_started',to_jsonb(r));
  RETURN r.id;
END $$;
REVOKE ALL ON FUNCTION public.revalidate_procurement_request(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.revalidate_procurement_request(uuid,uuid,integer) TO authenticated;

COMMIT;