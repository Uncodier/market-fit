BEGIN;
SET LOCAL lock_timeout='5s';

-- Reserve while the occurrence is due. Existing job handles must not be re-enqueued
-- or acquire a new lifetime on upgrade. A NULL reserved_at is a legacy receipt.
ALTER TABLE workflow_connector_private.jobs ADD COLUMN reserved_at timestamptz,
  ADD COLUMN queue_lease_id uuid, ADD COLUMN queue_lease_until timestamptz, ADD COLUMN queued_at timestamptz;
ALTER TABLE workflow_connector_private.jobs ALTER COLUMN reserved_at SET DEFAULT clock_timestamp();
CREATE INDEX workflow_connector_queue_pending ON workflow_connector_private.jobs(reserved_at,run_id)
  WHERE reserved_at IS NOT NULL AND queued_at IS NULL AND dispatched_at IS NULL;

CREATE OR REPLACE FUNCTION workflow_connector_private.apply_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p workflow_connector_private.publications; s jsonb; j workflow_connector_private.jobs; live boolean; challenge text; head uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' OR current_setting('transaction_isolation') NOT IN
    ('read committed','read uncommitted') THEN RAISE insufficient_privilege; END IF;
  IF NEW.op IN ('prepare','dispatch','finish') THEN
    SELECT * INTO j FROM workflow_connector_private.jobs WHERE (run_id,job_id)=(NEW.run_id,NEW.job_id);
    SELECT instance_id INTO NEW.instance_id FROM workflow_connector_private.publications WHERE id=j.publication_id;
  END IF;
  -- Serialize every grant mutation and use in a workflow, including the first
  -- grant (where no existing publication row can be locked). FK cascades also
  -- serialize via this parent. Recheck in a fresh snapshot after acquiring it.
  SELECT site_id INTO NEW.site_id FROM public.remote_instances WHERE id=NEW.instance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE insufficient_privilege; END IF;
  SELECT * INTO p FROM workflow_connector_private.publications WHERE instance_id=NEW.instance_id AND revoked_at IS NULL;
  PERFORM FROM public.sites WHERE id=NEW.site_id FOR SHARE;
  PERFORM FROM public.site_ownership WHERE site_id=NEW.site_id AND user_id=coalesce(NEW.actor_id,p.principal_id) FOR SHARE;
  PERFORM FROM public.site_members WHERE site_id=NEW.site_id AND user_id=coalesce(NEW.actor_id,p.principal_id) ORDER BY id FOR SHARE;
  IF NEW.op='revoke' THEN
    IF p.node_id IS DISTINCT FROM NEW.node_id OR p.id IS NULL OR p.site_id<>NEW.site_id OR NOT EXISTS (
      SELECT FROM public.connector_effective_site_access(p.site_id,NEW.actor_id) a WHERE a.can_manage) THEN RAISE insufficient_privilege; END IF;
    UPDATE workflow_connector_private.publications SET revoked_at=clock_timestamp(),revoked_by=NEW.actor_id WHERE id=p.id;
    UPDATE workflow_connector_private.jobs SET report=NULL WHERE publication_id=p.id AND report IS NOT NULL;
    NEW.answer:=jsonb_build_object('published',false,'revoked',true,'connector_id',p.connector_id);
    RETURN NEW;
  END IF;
  IF NEW.op IN ('bind','prepare','dispatch','finish','result') THEN
    IF p.id IS NULL OR p.expires_at<=clock_timestamp() OR (NEW.op='result' AND
      ((NEW.node_id,NEW.actor_id) IS DISTINCT FROM (p.node_id,p.principal_id))) THEN RAISE insufficient_privilege; END IF;
    NEW.node_id:=p.node_id; NEW.actor_id:=p.principal_id;
  END IF;
  -- Don't authorize from a stale snapshot while an edit, policy change or
  -- use/proof revocation is already updating the very rows we intend to use.
  PERFORM FROM public.instance_nodes WHERE instance_id=NEW.instance_id AND starts_with(type,'wf-') ORDER BY id FOR SHARE;
  PERFORM FROM public.workflow_triggers WHERE instance_id=NEW.instance_id ORDER BY id FOR SHARE;
  PERFORM FROM public.connectors c JOIN public.instance_nodes n ON n.task_connector_id=c.id
    WHERE (n.id,n.instance_id,c.site_id)=(NEW.node_id,NEW.instance_id,NEW.site_id) FOR SHARE OF c;
  PERFORM FROM public.connector_members m JOIN public.instance_nodes n ON n.task_connector_id=m.connector_id
    WHERE (n.id,m.site_id,m.user_id)=(NEW.node_id,NEW.site_id,NEW.actor_id) FOR SHARE OF m;
  PERFORM FROM public.connector_policies cp JOIN public.instance_nodes n ON n.task_connector_id=cp.connector_id
    WHERE (n.id,cp.site_id)=(NEW.node_id,NEW.site_id) FOR SHARE OF cp;
  PERFORM FROM connector_result_private.direct_attestations b JOIN public.instance_nodes n ON n.task_connector_id=b.connector_id
    WHERE (n.id,b.site_id)=(NEW.node_id,NEW.site_id) AND b.revoked_at IS NULL FOR SHARE OF b;
  PERFORM FROM public.site_connector_providers WHERE site_id=NEW.site_id FOR SHARE;
  PERFORM FROM public.site_secrets WHERE site_id=NEW.site_id AND instance_id IS NULL AND provider='composio' AND use_case='integrations' FOR SHARE;
  PERFORM FROM connector_result_private.provider_attestations b JOIN public.site_connector_providers pr USING(site_id,credential_revision)
    WHERE pr.site_id=NEW.site_id FOR SHARE OF b;
  PERFORM FROM public.site_connector_auth_attempts a JOIN public.instance_nodes n ON n.task_connector_id=a.connector_id
    WHERE (n.id,a.site_id,a.status)=(NEW.node_id,NEW.site_id,'completed') FOR SHARE OF a;
  PERFORM FROM connector_result_private.direct_revisions d JOIN public.instance_nodes n ON n.task_connector_id=d.connector_id
    WHERE n.id=NEW.node_id FOR SHARE OF d;
  s:=workflow_connector_private.compile(NEW.instance_id,NEW.node_id,NEW.actor_id,
    CASE WHEN NEW.op IN ('publish','review') THEN NEW.report ELSE p.operation END);
  live:=p.id IS NOT NULL AND p.digest=s->>'digest' AND p.expires_at>clock_timestamp();
  IF NEW.op IN ('publish','review') THEN
    -- Compare-and-swap against this exact publication history, not just the
    -- draft content. Replacing A with B then reviewing A never revives A's token.
    SELECT id INTO head FROM workflow_connector_private.publications WHERE instance_id=NEW.instance_id
      ORDER BY epoch DESC LIMIT 1;
    challenge:=CASE WHEN live THEN p.challenge ELSE encode(sha256(convert_to(jsonb_build_array(
      s->>'digest',head,p.id,CASE WHEN p.id IS NULL THEN NULL ELSE p.expires_at>clock_timestamp() END)::text,'UTF8')),'hex') END;
  END IF;
  CASE NEW.op
  WHEN 'review' THEN NEW.answer:=workflow_connector_private.summary(s,live)||jsonb_build_object('digest',challenge);
  WHEN 'publish' THEN
    -- Report a conflict only after z_authorize confirms parent visibility.
    IF NEW.digest IS DISTINCT FROM challenge THEN NEW.answer:=NULL; RETURN NEW; END IF;
    IF NOT live THEN
      UPDATE workflow_connector_private.publications SET revoked_at=clock_timestamp(),revoked_by=NEW.actor_id WHERE id=p.id;
      UPDATE workflow_connector_private.jobs SET report=NULL WHERE publication_id=p.id AND report IS NOT NULL;
      INSERT INTO workflow_connector_private.publications(instance_id,site_id,node_id,principal_id,trigger_id,connector_id,digest,challenge,operation,snapshot)
        VALUES (NEW.instance_id,NEW.site_id,NEW.node_id,NEW.actor_id,(s#>>'{graph,trigger,id}')::uuid,(s#>>'{binding,connector_id}')::uuid,s->>'digest',challenge,NEW.report,s);
    END IF;
    NEW.answer:=workflow_connector_private.summary(s,true)||jsonb_build_object('digest',challenge);
  ELSE
    IF NOT live THEN RAISE insufficient_privilege; END IF;
    CASE NEW.op
    WHEN 'bind' THEN
      IF NEW.trigger_id IS DISTINCT FROM p.trigger_id OR NEW.occurrence<p.approved_at OR workflow_connector_private.due(s,NEW.occurrence) IS NOT TRUE
        OR NEW.run_id IS NULL OR NEW.job_id IS NULL OR NEW.run_id=NEW.job_id THEN RAISE insufficient_privilege; END IF;
      INSERT INTO workflow_connector_private.jobs(run_id,job_id,publication_id,trigger_id,occurrence,digest)
        VALUES (NEW.run_id,NEW.job_id,p.id,p.trigger_id,NEW.occurrence,p.digest);
      NEW.answer:=s->'binding';
    WHEN 'result' THEN
      SELECT report INTO NEW.answer FROM workflow_connector_private.jobs WHERE publication_id=p.id AND report IS NOT NULL
        AND completed_at>clock_timestamp()-interval '1 hour' ORDER BY occurrence DESC LIMIT 1;
      IF NEW.answer IS NULL THEN RAISE insufficient_privilege; END IF;
    ELSE
      IF (p.id,p.digest,p.trigger_id) IS DISTINCT FROM (j.publication_id,j.digest,j.trigger_id)
        THEN RAISE insufficient_privilege; END IF;
      IF NEW.op IN ('prepare','dispatch') AND (j.reserved_at IS NULL OR j.dispatched_at IS NOT NULL OR
        j.reserved_at <= clock_timestamp()-interval '24 hours') THEN RAISE insufficient_privilege; END IF;
      IF NEW.op='prepare' THEN
        NEW.answer:=s->'binding';
      ELSIF NEW.op='dispatch' THEN
        UPDATE workflow_connector_private.jobs SET dispatched_at=clock_timestamp() WHERE run_id=j.run_id AND dispatched_at IS NULL;
        IF NOT FOUND THEN RAISE insufficient_privilege; END IF;
        NEW.answer:=s->'binding';
      ELSIF NEW.op='finish' AND j.dispatched_at > clock_timestamp()-interval '5 minutes'
        AND workflow_connector_private.valid_report(NEW.report) THEN
        -- Keep only the newest occurrence's private preview; retain all one-shot claims.
        UPDATE workflow_connector_private.jobs SET report=NULL WHERE publication_id=p.id AND report IS NOT NULL AND occurrence<j.occurrence;
        UPDATE workflow_connector_private.jobs SET completed_at=clock_timestamp(),
          report=CASE WHEN NOT EXISTS (SELECT FROM workflow_connector_private.jobs later
            WHERE later.publication_id=p.id AND later.occurrence>j.occurrence AND later.completed_at IS NOT NULL) THEN NEW.report END
          WHERE run_id=j.run_id AND dispatched_at IS NOT NULL AND completed_at IS NULL;
        IF NOT FOUND THEN RAISE insufficient_privilege; END IF;
        NEW.answer:='true'::jsonb;
      ELSE RAISE insufficient_privilege;
      END IF;
    END CASE;
  END CASE;
  RETURN NEW;
END $$;

-- The queue contains opaque capabilities only. Neither the provider binding nor
-- the report goes through the workflow history. Queue acknowledgement is not dispatch.
CREATE FUNCTION public.workflow_connector_claim_queue(p_limit integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE batch jsonb;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE insufficient_privilege; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE invalid_parameter_value; END IF;
  WITH pending AS (
    SELECT j.run_id FROM workflow_connector_private.jobs j JOIN workflow_connector_private.publications p ON p.id=j.publication_id
    WHERE j.queued_at IS NULL AND j.dispatched_at IS NULL AND j.reserved_at>statement_timestamp()-interval '24 hours'
      AND (j.queue_lease_until IS NULL OR j.queue_lease_until<=statement_timestamp())
      AND p.revoked_at IS NULL AND p.expires_at>statement_timestamp()
    -- Retry at the tail of the already-eligible backlog, not always at its head.
    ORDER BY coalesce(j.queue_lease_until,j.reserved_at),j.run_id LIMIT p_limit FOR UPDATE OF j SKIP LOCKED
  ), claimed AS (
    UPDATE workflow_connector_private.jobs j SET queue_lease_id=gen_random_uuid(),queue_lease_until=clock_timestamp()+interval '2 minutes'
    FROM pending WHERE j.run_id=pending.run_id RETURNING j.run_id,j.job_id,j.queue_lease_id AS lease_id
  ) SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) INTO batch FROM claimed c;
  RETURN batch;
END $$;

CREATE FUNCTION public.workflow_connector_ack_queue(p_run uuid,p_job uuid,p_lease uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE insufficient_privilege; END IF;
  UPDATE workflow_connector_private.jobs SET queued_at=clock_timestamp(),queue_lease_id=NULL,queue_lease_until=NULL
    WHERE (run_id,job_id,queue_lease_id)=(p_run,p_job,p_lease) AND queued_at IS NULL;
  RETURN FOUND;
END $$;

CREATE FUNCTION public.workflow_connector_prepare(p_run uuid,p_job uuid) RETURNS jsonb
LANGUAGE sql SET search_path='' AS $$ SELECT workflow_connector_rpc.request('prepare',NULL,NULL,NULL,NULL,NULL,NULL,p_run,p_job,NULL) $$;
REVOKE ALL ON FUNCTION public.workflow_connector_claim_queue(integer), public.workflow_connector_ack_queue(uuid,uuid,uuid),
  public.workflow_connector_prepare(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.workflow_connector_claim_queue(integer), public.workflow_connector_ack_queue(uuid,uuid,uuid),
  public.workflow_connector_prepare(uuid,uuid) TO service_role;
COMMIT;
