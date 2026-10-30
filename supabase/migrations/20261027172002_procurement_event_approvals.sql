BEGIN;

CREATE TABLE public.procurement_event_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites(id),
  target_id uuid NOT NULL, target_version integer NOT NULL CHECK(target_version>0),
  event text NOT NULL CHECK(event IN ('publication','offer','award','order')),
  policy_revision integer NOT NULL, actor_id uuid NOT NULL,
  plan jsonb NOT NULL CHECK(jsonb_typeof(plan)='object'),
  status text NOT NULL CHECK(status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(site_id,policy_revision) REFERENCES public.procurement_policy_versions(site_id,revision),
  UNIQUE(site_id,target_id,target_version,event,policy_revision)
);
CREATE TABLE public.procurement_event_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), approval_id uuid NOT NULL REFERENCES public.procurement_event_approvals(id),
  position integer NOT NULL, definition jsonb NOT NULL, status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected')), UNIQUE(approval_id,position)
);
CREATE TABLE public.procurement_event_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), stage_id uuid NOT NULL REFERENCES public.procurement_event_stages(id),
  actor_id uuid NOT NULL, decision text NOT NULL CHECK(decision IN ('approve','reject')),
  reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(stage_id,actor_id)
);
CREATE FUNCTION public.procurement_event_visible(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.procurement_event_approvals a WHERE a.id=p_id
    AND auth.uid() IS NOT NULL AND public.current_user_site_role(a.site_id) IS NOT NULL
    AND public.current_user_has_site_location_restrictions(a.site_id) IS FALSE
    AND (public.current_user_site_role(a.site_id) IN ('owner','admin') OR EXISTS(
      SELECT 1 FROM public.procurement_event_stages s WHERE s.approval_id=a.id
      AND s.definition->'approverIds' ? auth.uid()::text)));
$$;
REVOKE ALL ON FUNCTION public.procurement_event_visible(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_event_visible(uuid) TO authenticated;
ALTER TABLE public.procurement_event_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_event_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_event_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_event_approvals,public.procurement_event_stages,public.procurement_event_decisions
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procurement_event_approvals,public.procurement_event_stages,public.procurement_event_decisions TO authenticated;
CREATE POLICY event_read ON public.procurement_event_approvals FOR SELECT TO authenticated USING(public.procurement_event_visible(id));
CREATE POLICY stage_read ON public.procurement_event_stages FOR SELECT TO authenticated USING(public.procurement_event_visible(approval_id));
CREATE POLICY decision_read ON public.procurement_event_decisions FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.procurement_event_stages s WHERE s.id=stage_id AND public.procurement_event_visible(s.approval_id)));
CREATE TRIGGER procurement_event_decisions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public.procurement_event_decisions FOR EACH STATEMENT EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();

-- Private finalization; other event consumers must verify their own target revision.
CREATE FUNCTION public.finalize_procurement_event(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.procurement_event_approvals;
BEGIN
  SELECT * INTO STRICT a FROM public.procurement_event_approvals WHERE id=p_id;
  IF a.status<>'approved' THEN RAISE EXCEPTION 'Approval incomplete' USING ERRCODE='22023'; END IF;
  IF a.event='publication' THEN
    PERFORM public.procurement_materialize_tender_publication(a.site_id,a.target_id,a.target_version,a.actor_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_procurement_event(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.create_procurement_event_approval(p_site uuid,p_target uuid,p_version integer,p_event text,
  p_actor uuid,p_policy_revision integer,p_plan jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid; pos integer:=0; stage jsonb; claims text; tender public.procurement_tenders;
BEGIN
  claims:=current_setting('request.jwt.claims',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::text,true);
  IF auth.uid() IS NULL OR NOT COALESCE(public.current_user_site_role(p_site) IN ('owner','admin'),false)
    OR public.current_user_has_site_location_restrictions(p_site) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_policy:'||p_site::text,0));
  IF p_policy_revision IS DISTINCT FROM (SELECT max(revision) FROM public.procurement_policy_versions WHERE site_id=p_site) THEN
    RAISE EXCEPTION 'Policy changed' USING ERRCODE='40001'; END IF;
  IF p_plan->>'status' IS DISTINCT FROM 'ready' OR jsonb_typeof(p_plan->'stages') IS DISTINCT FROM 'array'
    OR octet_length(p_plan::text)>262144 THEN RAISE EXCEPTION 'Invalid plan' USING ERRCODE='22023'; END IF;
  IF p_event='publication' THEN
    SELECT * INTO tender FROM public.procurement_tenders WHERE id=p_target AND site_id=p_site FOR UPDATE;
    IF NOT FOUND OR tender.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Tender changed' USING ERRCODE='40001'; END IF;
  ELSE
    -- Additional event integrations must install their own target validator before use.
    RAISE EXCEPTION 'Event target validation is not installed' USING ERRCODE='22023';
  END IF;
  SELECT id INTO result FROM public.procurement_event_approvals WHERE site_id=p_site AND target_id=p_target
    AND target_version=p_version AND event=p_event AND policy_revision=p_policy_revision;
  IF result IS NOT NULL THEN RETURN result; END IF;
  IF tender.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'Tender state invalid' USING ERRCODE='22023'; END IF;
  INSERT INTO public.procurement_event_approvals(site_id,target_id,target_version,event,policy_revision,actor_id,plan,status)
    VALUES(p_site,p_target,p_version,p_event,p_policy_revision,p_actor,p_plan,'pending') RETURNING id INTO result;
  FOR stage IN SELECT value FROM jsonb_array_elements(p_plan->'stages') LOOP
    INSERT INTO public.procurement_event_stages(approval_id,position,definition) VALUES(result,pos,stage); pos:=pos+1;
  END LOOP;
  IF pos=0 THEN
    UPDATE public.procurement_event_approvals SET status='approved' WHERE id=result;
    PERFORM public.finalize_procurement_event(result);
  END IF;
  PERFORM set_config('request.jwt.claims',COALESCE(claims,''),true);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_procurement_event_approval(uuid,uuid,integer,text,uuid,integer,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_procurement_event_approval(uuid,uuid,integer,text,uuid,integer,jsonb) TO service_role;

CREATE FUNCTION public.decide_procurement_event(p_site uuid,p_id uuid,p_stage uuid,p_decision text,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.procurement_event_approvals; s public.procurement_event_stages; d jsonb;
  votes integer; remaining integer; needed integer; mandatory boolean;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_site_role(p_site) IS NULL
    OR NOT COALESCE(public.user_can(p_site,'update'),false)
    OR public.current_user_has_site_location_restrictions(p_site) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approve','reject') OR COALESCE(length(trim(p_reason)) NOT BETWEEN 1 AND 2000,true)
    THEN RAISE EXCEPTION 'Decision and reason required' USING ERRCODE='22023'; END IF;
  SELECT * INTO a FROM public.procurement_event_approvals WHERE id=p_id AND site_id=p_site FOR UPDATE;
  IF NOT FOUND OR a.status<>'pending' THEN RAISE EXCEPTION 'Approval changed' USING ERRCODE='40001'; END IF;
  SELECT * INTO s FROM public.procurement_event_stages WHERE id=p_stage AND approval_id=a.id;
  IF NOT FOUND OR s.status<>'pending' THEN RAISE EXCEPTION 'Stage changed' USING ERRCODE='40001'; END IF;
  d:=s.definition;
  IF d->>'decisionMode' IS DISTINCT FROM 'human' OR NOT COALESCE(d->'approverIds' ? auth.uid()::text,false)
    OR (a.actor_id=auth.uid() AND COALESCE((d->>'allowSelfApproval')::boolean,false)=false) THEN
    RAISE EXCEPTION 'Ineligible approver or pending AI review' USING ERRCODE='42501'; END IF;
  IF d->>'resolvedDeadline' IS NOT NULL AND (d->>'resolvedDeadline')::timestamptz<=clock_timestamp() THEN
    RAISE EXCEPTION 'Deadline reached' USING ERRCODE='22023'; END IF;
  IF d->>'execution'='sequential' AND EXISTS(SELECT 1 FROM public.procurement_event_stages
    WHERE approval_id=a.id AND position<s.position AND status<>'approved'
    AND definition->'sourceRuleId' IS NOT DISTINCT FROM d->'sourceRuleId') THEN
    RAISE EXCEPTION 'Earlier stage pending' USING ERRCODE='22023'; END IF;
  IF a.plan->>'crossRuleCounting'='independent' AND p_decision='approve' AND EXISTS(
    SELECT 1 FROM public.procurement_event_decisions v JOIN public.procurement_event_stages other ON other.id=v.stage_id
    WHERE other.approval_id=a.id AND v.actor_id=auth.uid() AND v.decision='approve'
    AND other.definition->'sourceRuleId' IS DISTINCT FROM d->'sourceRuleId') THEN
    RAISE EXCEPTION 'Independent rules require distinct approvers' USING ERRCODE='22023'; END IF;
  INSERT INTO public.procurement_event_decisions(stage_id,actor_id,decision,reason) VALUES(s.id,auth.uid(),p_decision,trim(p_reason));
  needed:=CASE d->'quorum'->>'mode' WHEN 'all' THEN jsonb_array_length(d->'approverIds')
    WHEN 'n_of_m' THEN (d->'quorum'->>'count')::integer WHEN 'first_response' THEN 1 ELSE NULL END;
  IF needed IS NULL OR needed<1 THEN RAISE EXCEPTION 'Invalid quorum' USING ERRCODE='22023'; END IF;
  SELECT count(*) FILTER(WHERE decision='approve'),jsonb_array_length(d->'approverIds')-count(*) INTO votes,remaining
    FROM public.procurement_event_decisions WHERE stage_id=s.id;
  SELECT NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(d->'mandatoryApproverIds') m
    WHERE NOT EXISTS(SELECT 1 FROM public.procurement_event_decisions WHERE stage_id=s.id AND actor_id::text=m.value AND decision='approve')) INTO mandatory;
  IF p_decision='reject' AND (d->>'rejectionBehavior' IN ('veto','return_for_correction')
    OR d->'mandatoryApproverIds' ? auth.uid()::text OR votes+remaining<needed) THEN
    UPDATE public.procurement_event_stages SET status='rejected' WHERE id=s.id;
    UPDATE public.procurement_event_approvals SET status='rejected' WHERE id=a.id;
  ELSIF votes>=needed AND mandatory THEN
    UPDATE public.procurement_event_stages SET status='approved' WHERE id=s.id;
    IF NOT EXISTS(SELECT 1 FROM public.procurement_event_stages WHERE approval_id=a.id AND status<>'approved') THEN
      UPDATE public.procurement_event_approvals SET status='approved' WHERE id=a.id;
      PERFORM public.finalize_procurement_event(a.id);
    END IF;
  END IF;
  RETURN a.id;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_procurement_event(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.decide_procurement_event(uuid,uuid,uuid,text,text) TO authenticated;
COMMIT;