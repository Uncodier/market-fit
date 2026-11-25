BEGIN;
SET LOCAL lock_timeout='5s';
-- As with the connector receipt gate, run the private state transition and
-- the actual authenticated parent SELECT in one statement. Neither the
-- service role nor the definer may substitute for parent RLS. The gate is empty.
CREATE SCHEMA workflow_connector_rpc;
REVOKE ALL ON SCHEMA workflow_connector_rpc FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA workflow_connector_rpc TO service_role;
CREATE TABLE workflow_connector_rpc.gate (
  op text, instance_id uuid, node_id uuid, actor_id uuid, digest text, trigger_id uuid,
  occurrence timestamptz, run_id uuid, job_id uuid, report jsonb, answer jsonb, site_id uuid, CHECK (false)
);
ALTER TABLE workflow_connector_rpc.gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON workflow_connector_rpc.gate FROM PUBLIC,anon,authenticated,service_role;
GRANT INSERT(op,instance_id,node_id,actor_id,digest,trigger_id,occurrence,run_id,job_id,report) ON workflow_connector_rpc.gate TO service_role;

CREATE FUNCTION workflow_connector_private.apply_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p workflow_connector_private.publications; s jsonb; j workflow_connector_private.jobs; live boolean; challenge text; head uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' OR current_setting('transaction_isolation') NOT IN
    ('read committed','read uncommitted') THEN RAISE insufficient_privilege; END IF;
  IF NEW.op IN ('dispatch','finish') THEN
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
  IF NEW.op IN ('bind','dispatch','finish','result') THEN
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
      IF (p.id,p.digest,p.trigger_id) IS DISTINCT FROM (j.publication_id,j.digest,j.trigger_id) OR j.occurrence<=clock_timestamp()-interval '5 minutes'
        THEN RAISE insufficient_privilege; END IF;
      IF NEW.op='dispatch' THEN
        UPDATE workflow_connector_private.jobs SET dispatched_at=clock_timestamp() WHERE run_id=j.run_id AND dispatched_at IS NULL;
        IF NOT FOUND THEN RAISE insufficient_privilege; END IF;
        NEW.answer:=s->'binding';
      ELSIF NEW.op='finish' AND workflow_connector_private.valid_report(NEW.report) THEN
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
CREATE TRIGGER a_apply BEFORE INSERT ON workflow_connector_rpc.gate FOR EACH ROW EXECUTE FUNCTION workflow_connector_private.apply_request();

CREATE FUNCTION workflow_connector_private.authorize_parent() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET role=authenticated SET row_security=on AS $$
DECLARE claims text:=jsonb_build_object('sub',NEW.actor_id,'role','authenticated','is_anonymous',false)::text;
  names text[]:=ARRAY['request.jwt.claims','request.jwt.claim','request.jwt.claim.sub','request.jwt.claim.role','request.headers','request.cookies'];
  replacements text[]:=ARRAY[claims,claims,NEW.actor_id::text,'authenticated','{}','{}']; saved text[]:='{}'; i integer;
BEGIN
  FOR i IN 1..cardinality(names) LOOP
    saved:=array_append(saved,coalesce(current_setting(names[i],true),'')); PERFORM set_config(names[i],replacements[i],true);
  END LOOP;
  IF current_user<>'authenticated' OR current_setting('role')<>'authenticated' OR NOT row_security_active('public.remote_instances') OR
    auth.uid() IS DISTINCT FROM NEW.actor_id OR auth.role() IS DISTINCT FROM 'authenticated' OR auth.jwt()::jsonb IS DISTINCT FROM claims::jsonb
    OR NOT EXISTS (SELECT FROM public.remote_instances r WHERE (r.id,r.site_id)=(NEW.instance_id,NEW.site_id)) THEN RAISE insufficient_privilege; END IF;
  FOR i IN 1..cardinality(names) LOOP PERFORM set_config(names[i],saved[i],true); END LOOP;
  IF NEW.op='publish' AND NEW.answer IS NULL THEN RAISE EXCEPTION 'Workflow review changed' USING ERRCODE='40001'; END IF;
  PERFORM set_config('workflow_connector.answer',NEW.answer::text,true);
  RETURN NULL;
END $$;
CREATE TRIGGER z_authorize BEFORE INSERT ON workflow_connector_rpc.gate FOR EACH ROW EXECUTE FUNCTION workflow_connector_private.authorize_parent();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA workflow_connector_private FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION workflow_connector_rpc.request(op text,i uuid,n uuid,a uuid,d text,t uuid,o timestamptz,r uuid,j uuid,v jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE answer jsonb; saved text:=current_setting('workflow_connector.answer',true);
BEGIN
  IF current_user <> 'service_role' OR current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE insufficient_privilege; END IF;
  PERFORM set_config('workflow_connector.answer','',true);
  INSERT INTO workflow_connector_rpc.gate(op,instance_id,node_id,actor_id,digest,trigger_id,occurrence,run_id,job_id,report)
    VALUES(op,i,n,a,d,t,o,r,j,v);
  answer:=nullif(current_setting('workflow_connector.answer',true),'')::jsonb;
  PERFORM set_config('workflow_connector.answer',coalesce(saved,''),true);
  IF answer IS NULL THEN RAISE insufficient_privilege; END IF;
  RETURN answer;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA workflow_connector_rpc FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION workflow_connector_rpc.request(text,uuid,uuid,uuid,text,uuid,timestamptz,uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.workflow_connector_review(p_instance uuid,p_node uuid,p_actor uuid,p_operation jsonb) RETURNS jsonb
LANGUAGE sql SET search_path='' AS $$ SELECT workflow_connector_rpc.request('review',p_instance,p_node,p_actor,NULL,NULL,NULL,NULL,NULL,p_operation) $$;
CREATE FUNCTION public.workflow_connector_publish(p_instance uuid,p_node uuid,p_actor uuid,p_digest text,p_operation jsonb) RETURNS jsonb
LANGUAGE sql SET search_path='' AS $$ SELECT workflow_connector_rpc.request('publish',p_instance,p_node,p_actor,p_digest,NULL,NULL,NULL,NULL,p_operation) $$;
CREATE FUNCTION public.workflow_connector_revoke(p_instance uuid,p_node uuid,p_actor uuid) RETURNS jsonb
LANGUAGE sql SET search_path='' AS $$ SELECT workflow_connector_rpc.request('revoke',p_instance,p_node,p_actor,NULL,NULL,NULL,NULL,NULL,NULL) $$;
CREATE FUNCTION public.workflow_connector_result(p_instance uuid,p_node uuid,p_actor uuid) RETURNS jsonb
LANGUAGE sql SET search_path='' AS $$ SELECT workflow_connector_rpc.request('result',p_instance,p_node,p_actor,NULL,NULL,NULL,NULL,NULL,NULL) $$;
CREATE FUNCTION public.workflow_connector_bind(p_instance uuid,p_trigger uuid,p_occurrence timestamptz,p_run uuid,p_job uuid) RETURNS jsonb
LANGUAGE sql SET search_path='' AS $$ SELECT workflow_connector_rpc.request('bind',p_instance,NULL,NULL,NULL,p_trigger,p_occurrence,p_run,p_job,NULL) $$;
CREATE FUNCTION public.workflow_connector_dispatch(p_run uuid,p_job uuid) RETURNS jsonb
LANGUAGE sql SET search_path='' AS $$ SELECT workflow_connector_rpc.request('dispatch',NULL,NULL,NULL,NULL,NULL,NULL,p_run,p_job,NULL) $$;
CREATE FUNCTION public.workflow_connector_finish(p_run uuid,p_job uuid,p_result jsonb) RETURNS boolean
LANGUAGE sql SET search_path='' AS $$ SELECT workflow_connector_rpc.request('finish',NULL,NULL,NULL,NULL,NULL,NULL,p_run,p_job,p_result)::boolean $$;
CREATE FUNCTION public.workflow_connector_route(p_instance uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' OR NOT EXISTS (SELECT FROM public.remote_instances WHERE id=p_instance)
    THEN RAISE insufficient_privilege; END IF;
  RETURN EXISTS (SELECT FROM public.instance_nodes WHERE instance_id=p_instance AND task_connector_id IS NOT NULL)
    OR EXISTS (SELECT FROM workflow_connector_private.publications WHERE instance_id=p_instance);
END $$;
DO $$
DECLARE f regprocedure;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.workflow_connector_review(uuid,uuid,uuid,jsonb)'::regprocedure,'public.workflow_connector_publish(uuid,uuid,uuid,text,jsonb)',
    'public.workflow_connector_revoke(uuid,uuid,uuid)','public.workflow_connector_result(uuid,uuid,uuid)',
    'public.workflow_connector_bind(uuid,uuid,timestamptz,uuid,uuid)','public.workflow_connector_dispatch(uuid,uuid)',
    'public.workflow_connector_finish(uuid,uuid,jsonb)','public.workflow_connector_route(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
  END LOOP;
END $$;
COMMIT;
