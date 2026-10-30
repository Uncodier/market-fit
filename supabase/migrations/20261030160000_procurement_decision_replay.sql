BEGIN;

-- Serialize votes and acknowledge only an exact replay by the same authorized actor.
-- A terminal business conflict must not masquerade as a retryable serialization failure.
CREATE OR REPLACE FUNCTION public.decide_procurement_event(p_site uuid,p_id uuid,p_stage uuid,p_decision text,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.procurement_event_approvals; s public.procurement_event_stages; d jsonb;
  previous public.procurement_event_decisions;
  votes integer; remaining integer; needed integer; mandatory boolean;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_site_role(p_site) IS NULL
    OR NOT COALESCE(public.user_can(p_site,'update'),false)
    OR public.current_user_has_site_location_restrictions(p_site) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approve','reject') OR COALESCE(length(trim(p_reason)) NOT BETWEEN 1 AND 2000,true)
    THEN RAISE EXCEPTION 'Decision and reason required' USING ERRCODE='22023'; END IF;
  SELECT * INTO a FROM public.procurement_event_approvals WHERE id=p_id AND site_id=p_site FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approval changed' USING ERRCODE='PT409'; END IF;
  SELECT * INTO s FROM public.procurement_event_stages WHERE id=p_stage AND approval_id=a.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stage changed' USING ERRCODE='PT409'; END IF;
  d:=s.definition;
  -- Only the exact generated baseline qualifies, never a custom owner-only rule.
  IF public.procurement_generated_manager_default(a.site_id,a.policy_revision,a.plan,d) THEN
    IF NOT COALESCE(public.current_user_site_role(p_site) IN ('owner','admin'),false) THEN
      RAISE EXCEPTION 'Default approval requires a current manager' USING ERRCODE='42501';
    END IF;
    d:=d || jsonb_build_object('approverIds',jsonb_build_array(auth.uid()::text),
      'mandatoryApproverIds','[]'::jsonb,'quorum',jsonb_build_object('mode','first_response'));
  END IF;
  IF d->>'decisionMode' IS DISTINCT FROM 'human' OR NOT COALESCE(d->'approverIds' ? auth.uid()::text,false)
    OR (a.actor_id=auth.uid() AND COALESCE((d->>'allowSelfApproval')::boolean,false)=false) THEN
    RAISE EXCEPTION 'Ineligible approver or pending AI review' USING ERRCODE='42501'; END IF;
  SELECT * INTO previous FROM public.procurement_event_decisions WHERE stage_id=s.id AND actor_id=auth.uid();
  IF FOUND THEN
    IF previous.decision=p_decision AND previous.reason=trim(p_reason) THEN RETURN a.id; END IF;
    RAISE EXCEPTION 'Stage changed' USING ERRCODE='PT409';
  END IF;
  IF a.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Approval changed' USING ERRCODE='PT409'; END IF;
  IF s.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Stage changed' USING ERRCODE='PT409'; END IF;
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