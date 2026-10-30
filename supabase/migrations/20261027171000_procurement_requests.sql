BEGIN;

CREATE TABLE public.procurement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  currency text NOT NULL CHECK (currency IN ('USD','MXN','EUR','GBP','CAD')),
  net_amount_minor bigint NOT NULL CHECK (net_amount_minor BETWEEN 0 AND 9007199254740991),
  requester_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','returned')),
  policy_revision integer,
  policy_snapshot jsonb,
  resolved_plan jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id,id),
  FOREIGN KEY (site_id, policy_revision) REFERENCES public.procurement_policy_versions(site_id, revision)
);
CREATE INDEX procurement_requests_site ON public.procurement_requests(site_id, updated_at DESC, id);

CREATE TABLE public.procurement_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.procurement_requests(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  position integer NOT NULL,
  catalog_item_id uuid,
  category_ids jsonb NOT NULL DEFAULT '[]',
  description text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  valuation_source text NOT NULL DEFAULT 'catalog_cost' CHECK (valuation_source IN ('catalog_cost','manager_estimate','unpriced')),
  unit_net_minor bigint CHECK (unit_net_minor BETWEEN 0 AND 9007199254740991),
  net_amount_minor bigint CHECK (net_amount_minor BETWEEN 0 AND 9007199254740991),
  tax_snapshot jsonb NOT NULL,
  UNIQUE (request_id, revision, position)
);
CREATE TABLE public.procurement_request_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.procurement_requests(id) ON DELETE RESTRICT,
  revision integer NOT NULL,
  position integer NOT NULL,
  definition jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  UNIQUE (request_id, revision, position)
);
CREATE TABLE public.procurement_request_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.procurement_request_stages(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_id, actor_id)
);
CREATE TABLE public.procurement_request_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.procurement_requests(id) ON DELETE RESTRICT,
  revision integer NOT NULL,
  actor_id uuid NOT NULL,
  event text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.procurement_request_access(p_site uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE(public.current_user_site_role(p_site) IN ('owner','admin'), false)
    AND public.current_user_has_site_location_restrictions(p_site) IS NOT DISTINCT FROM false
$$;
REVOKE ALL ON FUNCTION public.procurement_request_access(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.procurement_request_access(uuid) TO authenticated;

CREATE FUNCTION public.procurement_request_visible(p_id uuid,p_site uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.procurement_request_access(p_site) OR (
    auth.uid() IS NOT NULL AND public.current_user_site_role(p_site) IS NOT NULL
    AND COALESCE(public.user_can(p_site,'select'),false)
    AND public.current_user_has_site_location_restrictions(p_site) IS NOT DISTINCT FROM false
    AND EXISTS (SELECT 1 FROM public.procurement_request_stages s
      WHERE s.request_id=p_id AND s.definition->'approverIds' ? auth.uid()::text))
$$;
REVOKE ALL ON FUNCTION public.procurement_request_visible(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.procurement_request_visible(uuid,uuid) TO authenticated;

ALTER TABLE public.procurement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_request_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_request_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_request_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_requests, public.procurement_request_items,
  public.procurement_request_stages, public.procurement_request_decisions, public.procurement_request_audit
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.procurement_requests, public.procurement_request_items,
  public.procurement_request_stages, public.procurement_request_decisions, public.procurement_request_audit TO authenticated;
CREATE POLICY request_read ON public.procurement_requests FOR SELECT TO authenticated
  USING (public.procurement_request_visible(id,site_id));
CREATE POLICY item_read ON public.procurement_request_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.procurement_requests r WHERE r.id=request_id));
CREATE POLICY stage_read ON public.procurement_request_stages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.procurement_requests r WHERE r.id=request_id));
CREATE POLICY audit_read ON public.procurement_request_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.procurement_requests r WHERE r.id=request_id));
CREATE POLICY decision_read ON public.procurement_request_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.procurement_request_stages s WHERE s.id=stage_id));

-- Draft amounts/classification/taxes come from the catalog within this transaction.
-- Service estimates are explicitly manager-entered budgets, never supplier prices.
-- Unpriced services are retained as drafts, not falsely treated as zero-tax purchases.
CREATE FUNCTION public.save_procurement_request(p_site uuid, p_id uuid, p_revision integer, p_document jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r public.procurement_requests; line jsonb; product record; taxes jsonb;
  pos integer := 0; rev integer; unit_minor bigint; total bigint := 0; qty integer;
BEGIN
  IF NOT public.procurement_request_access(p_site) THEN RAISE EXCEPTION 'Request access denied' USING ERRCODE='42501'; END IF;
  IF p_document IS NULL OR jsonb_typeof(p_document) <> 'object'
    OR p_document - ARRAY['title','description','currency','lines'] <> '{}'
    OR COALESCE(jsonb_typeof(p_document->'lines') <> 'array',true)
    OR jsonb_array_length(p_document->'lines') NOT BETWEEN 1 AND 100
    OR COALESCE(length(trim(p_document->>'title')) NOT BETWEEN 1 AND 200,true)
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF p_id IS NULL THEN
    IF p_revision IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
    INSERT INTO public.procurement_requests(site_id,title,description,currency,net_amount_minor,requester_id)
      VALUES(p_site,trim(p_document->>'title'),COALESCE(p_document->>'description',''),p_document->>'currency',0,auth.uid()) RETURNING * INTO r;
    rev := 1;
  ELSE
    SELECT * INTO r FROM public.procurement_requests WHERE id=p_id AND site_id=p_site FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE='42501'; END IF;
    IF r.revision IS DISTINCT FROM p_revision OR r.status NOT IN ('draft','returned') THEN
      RAISE EXCEPTION 'Revision or state conflict' USING ERRCODE='40001'; END IF;
    rev := r.revision+1;
  END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(p_document->'lines') LOOP
    IF jsonb_typeof(line) <> 'object' OR line - ARRAY['catalog_item_id','description','quantity','unit_estimate_minor','tax_ids'] <> '{}'
      OR COALESCE((line->>'quantity') !~ '^[0-9]+$',true)
    THEN RAISE EXCEPTION 'Invalid line' USING ERRCODE='22023'; END IF;
    qty := (line->>'quantity')::integer;
    unit_minor := NULL; taxes := 'null';
    IF line->>'catalog_item_id' IS NOT NULL THEN
      IF line ? 'unit_estimate_minor' OR line ? 'tax_ids' THEN
        RAISE EXCEPTION 'Catalog prices and taxes cannot be overridden' USING ERRCODE='22023'; END IF;
      SELECT id,name,cost,currency,category_id INTO product FROM public.catalog_items
        WHERE id=(line->>'catalog_item_id')::uuid AND site_id=p_site AND status='active';
      IF NOT FOUND OR product.currency IS DISTINCT FROM p_document->>'currency' OR product.cost IS NULL
        OR product.cost < 0 OR product.cost::text IN ('NaN','Infinity','-Infinity')
      THEN RAISE EXCEPTION 'Catalog pricing unavailable' USING ERRCODE='22023'; END IF;
      IF product.category_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.catalog_categories
        WHERE id=product.category_id AND site_id=p_site AND status='active') THEN
        RAISE EXCEPTION 'Catalog classification unavailable' USING ERRCODE='22023'; END IF;
      unit_minor := round(product.cost::numeric*100)::bigint;
      IF EXISTS (SELECT 1 FROM public.catalog_item_taxes ct LEFT JOIN public.taxes t ON t.id=ct.tax_id
        WHERE ct.catalog_item_id=product.id AND (ct.site_id<>p_site OR t.id IS NULL OR t.site_id<>p_site
          OR t.is_active IS NULL OR t.rate IS NULL OR t.rate<0 OR t.rate>100 OR t.rate::text IN ('NaN','Infinity','-Infinity'))) THEN
        RAISE EXCEPTION 'Catalog taxes unavailable' USING ERRCODE='22023'; END IF;
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'rate',t.rate) ORDER BY t.id),'[]') INTO taxes
        FROM public.catalog_item_taxes ct JOIN public.taxes t ON t.id=ct.tax_id
        WHERE ct.catalog_item_id=product.id AND ct.site_id=p_site AND t.site_id=p_site AND t.is_active=true;
      INSERT INTO public.procurement_request_items(request_id,revision,position,catalog_item_id,category_ids,description,quantity,unit_net_minor,net_amount_minor,tax_snapshot)
        VALUES(r.id,rev,pos,product.id,CASE WHEN product.category_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(product.category_id) END,
          product.name,qty,unit_minor,unit_minor*qty,taxes);
      total := total + unit_minor*qty;
    ELSE
      IF COALESCE(length(trim(line->>'description')) NOT BETWEEN 1 AND 500,true) THEN
        RAISE EXCEPTION 'Service description required' USING ERRCODE='22023'; END IF;
      IF line->>'unit_estimate_minor' IS NOT NULL THEN
        IF (line->>'unit_estimate_minor') !~ '^[0-9]+$' OR jsonb_typeof(line->'tax_ids') IS DISTINCT FROM 'array'
          OR jsonb_array_length(line->'tax_ids')>20 THEN
          RAISE EXCEPTION 'Explicit estimate and tax selection required' USING ERRCODE='22023'; END IF;
        unit_minor := (line->>'unit_estimate_minor')::bigint;
        IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(line->'tax_ids') selected
          LEFT JOIN public.taxes t ON t.id=selected.value::uuid
          WHERE t.id IS NULL OR t.site_id<>p_site OR t.is_active IS DISTINCT FROM true OR t.rate IS NULL
            OR t.rate<0 OR t.rate>100 OR t.rate::text IN ('NaN','Infinity','-Infinity')) THEN
          RAISE EXCEPTION 'Invalid service tax selection' USING ERRCODE='22023'; END IF;
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'rate',t.rate) ORDER BY t.id),'[]') INTO taxes
          FROM public.taxes t WHERE t.id IN (SELECT value::uuid FROM jsonb_array_elements_text(line->'tax_ids'));
        total := total+unit_minor*qty;
      END IF;
      INSERT INTO public.procurement_request_items(request_id,revision,position,description,quantity,unit_net_minor,net_amount_minor,tax_snapshot,valuation_source)
        VALUES(r.id,rev,pos,trim(line->>'description'),qty,unit_minor,unit_minor*qty,taxes,
          CASE WHEN unit_minor IS NULL THEN 'unpriced' ELSE 'manager_estimate' END);
    END IF;
    pos := pos+1;
  END LOOP;
  UPDATE public.procurement_requests SET revision=rev,title=trim(p_document->>'title'),description=COALESCE(p_document->>'description',''),
    currency=p_document->>'currency',net_amount_minor=total,status='draft',policy_revision=NULL,policy_snapshot=NULL,resolved_plan=NULL,updated_at=clock_timestamp()
    WHERE id=r.id;
  INSERT INTO public.procurement_request_audit(request_id,revision,actor_id,event,snapshot)
    SELECT r.id,rev,auth.uid(),'draft_saved',to_jsonb(saved) FROM public.procurement_requests saved WHERE saved.id=r.id;
  RETURN r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_procurement_request(uuid,uuid,integer,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_procurement_request(uuid,uuid,integer,jsonb) TO authenticated;

-- Only the authorized server evaluator may provide a plan. No authenticated
-- client (including a policy manager) can manufacture a resolved plan via RPC.
CREATE FUNCTION public.submit_procurement_request(p_site uuid,p_id uuid,p_revision integer,p_policy_revision integer,p_actor uuid,p_plan jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.procurement_requests; policy jsonb; stage jsonb; pos integer := 0; claims text;
BEGIN
  claims := current_setting('request.jwt.claims',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::text,true);
  IF NOT public.procurement_request_access(p_site) THEN RAISE EXCEPTION 'Request access denied' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_policy:'||p_site::text,0));
  SELECT * INTO r FROM public.procurement_requests WHERE id=p_id AND site_id=p_site FOR UPDATE;
  IF NOT FOUND OR r.revision IS DISTINCT FROM p_revision OR r.status<>'draft' THEN
    RAISE EXCEPTION 'Revision or state conflict' USING ERRCODE='40001'; END IF;
  IF p_policy_revision IS DISTINCT FROM (SELECT max(revision) FROM public.procurement_policy_versions WHERE site_id=p_site) THEN
    RAISE EXCEPTION 'Policy revision conflict' USING ERRCODE='40001'; END IF;
  SELECT document INTO policy FROM public.procurement_policy_versions WHERE site_id=p_site AND revision=p_policy_revision;
  IF policy IS NULL OR COALESCE(p_plan->>'status'<>'ready',true) OR jsonb_typeof(p_plan->'stages') IS DISTINCT FROM 'array'
    OR EXISTS(SELECT 1 FROM public.procurement_request_items WHERE request_id=r.id AND revision=r.revision AND unit_net_minor IS NULL)
  THEN RAISE EXCEPTION 'Unresolved policy or pricing' USING ERRCODE='22023'; END IF;
  FOR stage IN SELECT value FROM jsonb_array_elements(p_plan->'stages') LOOP
    INSERT INTO public.procurement_request_stages(request_id,revision,position,definition) VALUES(r.id,r.revision,pos,stage);
    pos := pos+1;
  END LOOP;
  UPDATE public.procurement_requests SET policy_revision=p_policy_revision,policy_snapshot=policy,resolved_plan=p_plan,
    status=CASE WHEN pos=0 THEN 'approved' ELSE 'submitted' END,updated_at=clock_timestamp() WHERE id=r.id;
  INSERT INTO public.procurement_request_audit(request_id,revision,actor_id,event,snapshot)
    SELECT r.id,r.revision,p_actor,'submitted',to_jsonb(saved) FROM public.procurement_requests saved WHERE saved.id=r.id;
  PERFORM set_config('request.jwt.claims',COALESCE(claims,''),true);
  RETURN r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_procurement_request(uuid,uuid,integer,integer,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_procurement_request(uuid,uuid,integer,integer,uuid,jsonb) TO service_role;

CREATE FUNCTION public.decide_procurement_request(p_site uuid,p_id uuid,p_revision integer,p_stage uuid,p_decision text,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.procurement_requests; s public.procurement_request_stages; d jsonb; votes integer; needed integer; remaining integer; mandatory boolean;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_site_role(p_site) IS NULL
    OR NOT COALESCE(public.user_can(p_site,'update'),false)
    OR public.current_user_has_site_location_restrictions(p_site) IS DISTINCT FROM false
  THEN RAISE EXCEPTION 'Request access denied' USING ERRCODE='42501'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approve','reject') OR COALESCE(length(trim(p_reason)) NOT BETWEEN 1 AND 2000,true) THEN
    RAISE EXCEPTION 'Decision and reason required' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM public.procurement_requests WHERE id=p_id AND site_id=p_site FOR UPDATE;
  IF NOT FOUND OR r.revision IS DISTINCT FROM p_revision OR r.status<>'submitted' THEN
    RAISE EXCEPTION 'Revision or state conflict' USING ERRCODE='40001'; END IF;
  SELECT * INTO s FROM public.procurement_request_stages WHERE id=p_stage AND request_id=r.id AND revision=r.revision;
  IF NOT FOUND OR s.status<>'pending' THEN RAISE EXCEPTION 'Stage conflict' USING ERRCODE='40001'; END IF;
  d := s.definition;
  IF d->>'decisionMode' IS DISTINCT FROM 'human' OR NOT COALESCE(d->'approverIds' ? auth.uid()::text,false)
    OR (r.requester_id=auth.uid() AND COALESCE((d->>'allowSelfApproval')::boolean,false)=false)
  THEN RAISE EXCEPTION 'Ineligible approver or pending AI integration' USING ERRCODE='42501'; END IF;
  IF d->>'resolvedDeadline' IS NOT NULL AND (d->>'resolvedDeadline')::timestamptz<=clock_timestamp() THEN
    RAISE EXCEPTION 'Deadline reached; never approval by silence' USING ERRCODE='22023'; END IF;
  IF d->>'execution'='sequential' AND EXISTS(SELECT 1 FROM public.procurement_request_stages
    WHERE request_id=r.id AND revision=r.revision AND position<s.position AND status<>'approved'
      AND definition->'sourceRuleId' IS NOT DISTINCT FROM d->'sourceRuleId') THEN
    RAISE EXCEPTION 'Earlier stage pending' USING ERRCODE='22023'; END IF;
  IF r.resolved_plan->>'crossRuleCounting'='independent' AND p_decision='approve' AND EXISTS (
    SELECT 1 FROM public.procurement_request_decisions v JOIN public.procurement_request_stages other ON other.id=v.stage_id
    WHERE other.request_id=r.id AND other.revision=r.revision AND v.actor_id=auth.uid() AND v.decision='approve'
      AND other.definition->'sourceRuleId' IS DISTINCT FROM d->'sourceRuleId') THEN
    RAISE EXCEPTION 'Independent rules require distinct approvers' USING ERRCODE='22023'; END IF;
  INSERT INTO public.procurement_request_decisions(stage_id,actor_id,decision,reason) VALUES(s.id,auth.uid(),p_decision,trim(p_reason));
  needed := CASE d->'quorum'->>'mode' WHEN 'all' THEN jsonb_array_length(d->'approverIds')
    WHEN 'n_of_m' THEN (d->'quorum'->>'count')::integer WHEN 'first_response' THEN 1 ELSE NULL END;
  IF needed IS NULL OR needed<1 THEN RAISE EXCEPTION 'Invalid quorum' USING ERRCODE='22023'; END IF;
  SELECT count(*) FILTER (WHERE decision='approve'),jsonb_array_length(d->'approverIds')-count(*) INTO votes,remaining
    FROM public.procurement_request_decisions WHERE stage_id=s.id;
  SELECT NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(d->'mandatoryApproverIds') m
    WHERE NOT EXISTS(SELECT 1 FROM public.procurement_request_decisions WHERE stage_id=s.id AND actor_id::text=m.value AND decision='approve')) INTO mandatory;
  IF p_decision='reject' AND (d->>'rejectionBehavior' IN ('veto','return_for_correction')
    OR d->'mandatoryApproverIds' ? auth.uid()::text OR votes+remaining<needed) THEN
    UPDATE public.procurement_request_stages SET status='rejected' WHERE id=s.id;
    UPDATE public.procurement_requests SET status=CASE WHEN d->>'rejectionBehavior'='return_for_correction' THEN 'returned' ELSE 'rejected' END WHERE id=r.id;
  ELSIF votes>=needed AND mandatory THEN
    UPDATE public.procurement_request_stages SET status='approved' WHERE id=s.id;
    IF NOT EXISTS(SELECT 1 FROM public.procurement_request_stages WHERE request_id=r.id AND revision=r.revision AND status<>'approved') THEN
      UPDATE public.procurement_requests SET status='approved' WHERE id=r.id;
    END IF;
  END IF;
  UPDATE public.procurement_requests SET updated_at=clock_timestamp() WHERE id=r.id;
  INSERT INTO public.procurement_request_audit(request_id,revision,actor_id,event,snapshot)
    VALUES(r.id,r.revision,auth.uid(),'decision',jsonb_build_object('stage_id',s.id,'decision',p_decision,'reason',trim(p_reason)));
  RETURN r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_procurement_request(uuid,uuid,integer,uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decide_procurement_request(uuid,uuid,integer,uuid,text,text) TO authenticated;

COMMIT;