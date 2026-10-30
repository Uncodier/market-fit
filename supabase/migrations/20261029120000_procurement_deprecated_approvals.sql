BEGIN;

-- Guard every approval vote, not only the vote that completes the quorum.
-- Keep historical approvals and decisions unchanged for audit purposes.
CREATE FUNCTION public.procurement_guard_event_decision_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.procurement_event_approvals; current_version integer;
BEGIN
  IF NEW.decision <> 'approve' THEN RETURN NEW; END IF;
  SELECT approval.* INTO STRICT a FROM public.procurement_event_approvals approval
    JOIN public.procurement_event_stages stage ON stage.approval_id=approval.id
    WHERE stage.id=NEW.stage_id FOR UPDATE OF approval;
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_policy:'||a.site_id::text,0));
  IF a.policy_revision IS DISTINCT FROM (SELECT max(revision) FROM public.procurement_policy_versions WHERE site_id=a.site_id) THEN
    RAISE EXCEPTION 'Policy changed; request a new approval' USING ERRCODE='40001';
  END IF;
  IF a.event='publication' THEN
    SELECT version INTO current_version FROM public.procurement_tenders
      WHERE site_id=a.site_id AND id=a.target_id FOR SHARE;
    IF current_version IS DISTINCT FROM a.target_version THEN
      RAISE EXCEPTION 'Tender version conflict' USING ERRCODE='40001';
    END IF;
  ELSIF a.event IN ('award','order') THEN
    PERFORM public.procurement_validate_commerce_event(a.site_id,a.target_id,a.target_version,a.event);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.procurement_guard_event_decision_revision() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER procurement_event_decision_revision
  BEFORE INSERT ON public.procurement_event_decisions
  FOR EACH ROW EXECUTE FUNCTION public.procurement_guard_event_decision_revision();

COMMIT;