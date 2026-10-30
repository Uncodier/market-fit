BEGIN;

-- Match the complete generated policy and resolved stage, not a display name alone.
CREATE FUNCTION public.procurement_generated_manager_default(p_site uuid,p_revision integer,p_plan jsonb,p_stage jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.procurement_policy_versions v JOIN public.sites site ON site.id=v.site_id
    WHERE v.site_id=p_site AND v.revision=p_revision
      AND v.document->'version'='1'::jsonb AND v.document->'rules'='[]'::jsonb
      AND (v.document->'settings') - 'fallback' = '{"timeZone":"UTC","crossRuleCounting":"independent","supervisorId":null,"substituteIds":[],"visibility":"private","allowGlobalListing":false,"participation":"invitation_only","offerOpening":"after_close","timings":{"tenderResponse":null,"clarification":null,"offerValidity":null,"approval":null},"exceptions":[],"urgentPreset":{"enabled":false,"responseTiming":null,"notifyPreviousEligibleSuppliers":false,"minimumSupplierProposals":1,"decisionMode":"human","preserveMandatoryRequirements":true},"rejectionNotifications":{"notifyRequester":true,"notifyParticipants":false,"recipientIds":[]}}'::jsonb
      AND v.document->'settings'->'fallback'->>'mode'='approval'
      AND jsonb_array_length(v.document->'settings'->'fallback'->'stages')=1
      AND p_plan->>'source'='general' AND p_plan->'matchedRuleIds'='[]'::jsonb
      AND p_plan->'requirements'='[]'::jsonb AND p_plan->'minimumSupplierProposals'='null'::jsonb
      AND p_plan->'stages'=jsonb_build_array(p_stage)
      AND p_stage = (v.document->'settings'->'fallback'->'stages'->0) ||
        '{"sourceRuleId":null,"sourceRuleVersion":null,"resolvedDeadline":null}'::jsonb
      AND p_stage - ARRAY['id','name','approverIds','mandatoryApproverIds','quorum','sourceRuleId','sourceRuleVersion','resolvedDeadline'] =
        '{"decisionMode":"human","rejectionBehavior":"veto","execution":"parallel","allowSelfApproval":true,"delegatedAgentId":null,"deadline":null,"timeoutAction":"block","escalationIds":[]}'::jsonb
      AND (
        (p_stage->>'id'='workspace-owner' AND p_stage->>'name'='Workspace owner approval'
          AND p_stage->'approverIds'=jsonb_build_array(site.user_id::text)
          AND p_stage->'mandatoryApproverIds'=jsonb_build_array(site.user_id::text)
          AND p_stage->'quorum'='{"mode":"all"}'::jsonb)
        OR (p_stage->>'id'='workspace-managers' AND p_stage->>'name'='Workspace owner or admin approval'
          AND jsonb_typeof(p_stage->'approverIds')='array' AND p_stage->'approverIds' ? site.user_id::text
          AND p_stage->'mandatoryApproverIds'='[]'::jsonb
          AND p_stage->'quorum'='{"mode":"first_response"}'::jsonb)
      )
  );
$$;
REVOKE ALL ON FUNCTION public.procurement_generated_manager_default(uuid,integer,jsonb,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.decide_procurement_event(p_site uuid,p_id uuid,p_stage uuid,p_decision text,p_reason text)
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
  -- Only the exact generated baseline qualifies, never a custom owner-only rule.
  IF public.procurement_generated_manager_default(a.site_id,a.policy_revision,a.plan,d) THEN
    IF NOT COALESCE(public.current_user_site_role(p_site) IN ('owner','admin'),false) THEN
      RAISE EXCEPTION 'Default approval requires a current manager' USING ERRCODE='42501';
    END IF;
    -- Resolve role authority locally; preserve the immutable original plan and assignment.
    d:=d || jsonb_build_object('approverIds',jsonb_build_array(auth.uid()::text),
      'mandatoryApproverIds','[]'::jsonb,'quorum',jsonb_build_object('mode','first_response'));
  END IF;
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
