BEGIN;
SET LOCAL lock_timeout = '5s';

-- No backfill. A canvas reference, an enabled schedule, and manager status are
-- each insufficient. Only the service gateway can request an explicit grant.
CREATE SCHEMA workflow_connector_private;
REVOKE ALL ON SCHEMA workflow_connector_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE workflow_connector_private.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.remote_instances(id) ON DELETE CASCADE,
  site_id uuid NOT NULL, node_id uuid NOT NULL, principal_id uuid NOT NULL,
  trigger_id uuid NOT NULL, connector_id uuid NOT NULL, digest text NOT NULL, challenge text NOT NULL,
  epoch bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  operation jsonb NOT NULL, snapshot jsonb NOT NULL, approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '30 days'),
  revoked_at timestamptz, revoked_by uuid
);
CREATE UNIQUE INDEX workflow_connector_live ON workflow_connector_private.publications(instance_id) WHERE revoked_at IS NULL;
CREATE INDEX ON workflow_connector_private.publications(instance_id,epoch DESC);
-- A revoked epoch cannot be reopened or retargeted by an update. Replacement
-- authorizations always get a new row; no existing job follows a replacement.
CREATE FUNCTION workflow_connector_private.guard_revocation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR
    (to_jsonb(NEW)-'revoked_at'-'revoked_by') <> (to_jsonb(OLD)-'revoked_at'-'revoked_by') THEN RAISE check_violation; END IF;
  NEW.revoked_at:=clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_publication BEFORE UPDATE ON workflow_connector_private.publications
  FOR EACH ROW EXECUTE FUNCTION workflow_connector_private.guard_revocation();
CREATE TABLE workflow_connector_private.jobs (
  run_id uuid PRIMARY KEY, job_id uuid NOT NULL UNIQUE,
  publication_id uuid NOT NULL REFERENCES workflow_connector_private.publications(id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL, occurrence timestamptz NOT NULL, digest text NOT NULL,
  dispatched_at timestamptz, completed_at timestamptz, report jsonb,
  -- Stronger than uniqueness within one digest: republishing cannot replay a minute.
  UNIQUE(trigger_id,occurrence), CHECK (run_id <> job_id)
);
CREATE INDEX ON workflow_connector_private.jobs(publication_id,occurrence DESC) WHERE completed_at IS NOT NULL;
ALTER TABLE workflow_connector_private.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_connector_private.jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA workflow_connector_private FROM PUBLIC,anon,authenticated,service_role;

-- Never retain a provider envelope: accept only the bounded private report emitted
-- by the worker redactor. Validate each shape before expanding JSON arrays.
CREATE FUNCTION workflow_connector_private.valid_report(v jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE r jsonb:=v->'report'; cell jsonb;
BEGIN
  IF (jsonb_typeof(v)='object' AND octet_length(v::text)<=65536 AND
      v-ARRAY['executed','report']='{}'::jsonb AND v->'executed'='true'::jsonb AND
      jsonb_typeof(r)='object' AND r-ARRAY['title','note','columns','rows']='{}'::jsonb AND
      r->>'title'='Connector result' AND jsonb_typeof(r->'note')='string' AND length(r->>'note')<=512 AND
      r->'columns'='["Field","Value"]'::jsonb AND jsonb_typeof(r->'rows')='array') IS NOT TRUE THEN RETURN false; END IF;
  IF jsonb_array_length(r->'rows')>100 THEN RETURN false; END IF;
  FOR cell IN SELECT value FROM jsonb_array_elements(r->'rows') LOOP
    IF jsonb_typeof(cell)<>'array' THEN RETURN false; END IF;
    IF (jsonb_array_length(cell)=2 AND jsonb_typeof(cell->0)='string' AND jsonb_typeof(cell->1)='string'
      AND length(cell->>0)<=200 AND length(cell->>1)<=200) IS NOT TRUE THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

-- Only a reviewed subset of five-field cron. No implicit site timezone or
-- browser default. Account, version, verb and arguments are never canvas inputs.
CREATE FUNCTION workflow_connector_private.compile(p_instance uuid,p_node uuid,p_actor uuid,p_operation jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' SET timezone='UTC' AS $$
DECLARE snap jsonb; binding jsonb; graph jsonb; grant_data jsonb;
BEGIN
  -- The service resolves the descriptor and validates arguments against its
  -- pinned schema. The database admits only the exact envelope and recomputes
  -- account, tool policy and downstream resource authority independently.
  IF (jsonb_typeof(p_operation)='object' AND octet_length(p_operation::text)<=65536 AND
    p_operation-ARRAY['connector_id','toolkit_slug','tool_slug','toolkit_version','schema_hash','arguments']='{}'::jsonb AND
    jsonb_typeof(p_operation->'connector_id')='string' AND jsonb_typeof(p_operation->'toolkit_slug')='string' AND
    jsonb_typeof(p_operation->'tool_slug')='string' AND jsonb_typeof(p_operation->'toolkit_version')='string' AND
    jsonb_typeof(p_operation->'schema_hash')='string' AND jsonb_typeof(p_operation->'arguments')='object' AND
    (p_operation->>'toolkit_slug') COLLATE "C" ~ '^[a-z0-9_][a-z0-9_-]{0,99}$' AND
    (p_operation->>'tool_slug') COLLATE "C" ~ '^[A-Z0-9]+(_[A-Z0-9]+)+$' AND length(p_operation->>'tool_slug')<=150 AND
    NOT starts_with(p_operation->>'tool_slug','COMPOSIO_') AND
    starts_with(p_operation->>'tool_slug',upper(replace(p_operation->>'toolkit_slug','-','_') COLLATE "C")||'_') AND
    (p_operation->>'toolkit_version') COLLATE "C" ~ '^20[0-9]{6}_[0-9]{2}$' AND
    (p_operation->>'schema_hash') COLLATE "C" ~ '^[a-f0-9]{64}$') IS NOT TRUE THEN RAISE insufficient_privilege; END IF;
  SELECT jsonb_build_object('trigger',to_jsonb(t)-'created_at'-'updated_at',
    'root',to_jsonb(root)-'created_at'-'updated_at','step',to_jsonb(n)-'created_at'-'updated_at'),
    jsonb_build_object('site_id',c.site_id,'principal_id',p_actor,'connector_id',c.id,
      'connector_revision',c.revision,'provider_id',b.provider_id,'provider_project_id',b.project_id,
      'provider_user_id',c.site_id::text,'provider_account_id',b.account_id,'auth_config_id',b.auth_config_id,
      'credential_revision',b.credential_revision) || p_operation,
    jsonb_build_object('grant',to_jsonb(m),'proof',b.id,'attempt',a.attempt_id,'policy',to_jsonb(cp),
      'grant_epoch',m.xmin::text,'connector_epoch',c.xmin::text,'policy_epoch',cp.xmin::text,
      'membership_epoch',(SELECT sm.xmin::text FROM public.site_members sm WHERE (sm.site_id,sm.user_id)=(i.site_id,p_actor) LIMIT 1),
      'ownership_epoch',(SELECT so.xmin::text FROM public.site_ownership so WHERE (so.site_id,so.user_id)=(i.site_id,p_actor) LIMIT 1),
      'scopes',c.granted_scopes,'resource_screens',r.required_screens,'direct_revision',a.direct_revision)
    INTO STRICT graph,binding,grant_data
    FROM public.remote_instances i
    JOIN public.instance_nodes n ON (n.instance_id,n.site_id,n.id,n.type)=(i.id,i.site_id,p_node,'wf-step')
    JOIN public.instance_nodes root ON (root.id,root.instance_id,root.site_id,root.type)=(n.parent_node_id,i.id,i.site_id,'wf-trigger')
    JOIN public.workflow_triggers t ON (t.instance_id,t.site_id,t.node_id,t.kind)=(i.id,i.site_id,root.id,'cron')
    CROSS JOIN LATERAL (SELECT coalesce(n.settings->'step',n.settings) AS cfg) step
    JOIN public.connectors c ON (c.id,c.site_id)=(n.task_connector_id,i.site_id)
    JOIN public.connector_members m ON (m.site_id,m.connector_id,m.user_id)=(i.site_id,c.id,p_actor)
    JOIN public.connector_policies cp ON (cp.site_id,cp.connector_id)=(i.site_id,c.id)
    JOIN connector_result_private.direct_bindings b ON (b.connector_id,b.site_id,b.toolkit_slug,b.resource_kind)=
      (c.id,i.site_id,c.toolkit_slug,'external_business_resource')
    JOIN connector_result_private.direct_resources r USING(resource_namespace,resource_boundary)
    JOIN connector_result_private.ask_connections a ON (a.connector_id,a.site_id)=(c.id,i.site_id)
    WHERE i.id=p_instance AND i.is_archived IS FALSE AND root.parent_node_id IS NULL AND t.enabled
      AND t.config=coalesce(root.settings->'trigger',root.settings) AND coalesce(root.settings->'enabled','true')='true'::jsonb
      AND coalesce(t.config->'active_kinds',jsonb_build_array(t.config->>'kind'))='["cron"]'::jsonb
      AND coalesce(t.config->>'kind','cron')='cron'
      AND t.config->>'cron' COLLATE "C" ~ '^(\*|\*/([1-9]|[1-5][0-9])|[0-9]|[1-5][0-9]) (\*|[0-9]|1[0-9]|2[0-3]) \* \* \*$'
      AND (t.config->>'timezone'='UTC' OR (t.config->>'timezone' COLLATE "C" ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){1,2}$'
        AND EXISTS (SELECT FROM pg_timezone_names z WHERE z.name=t.config->>'timezone')))
      AND NOT EXISTS (SELECT FROM public.instance_nodes x WHERE x.instance_id=i.id AND starts_with(x.type,'wf-') AND x.id NOT IN (n.id,root.id))
      AND NOT EXISTS (SELECT FROM public.workflow_triggers x WHERE x.instance_id=i.id AND x.id<>t.id)
      AND NOT EXISTS (SELECT FROM public.instance_node_contexts x WHERE x.target_node_id IN (n.id,root.id) OR x.context_node_id IN (n.id,root.id))
      AND jsonb_typeof(step.cfg)='object'
      AND coalesce(step.cfg->'requires_browser','false')='false'::jsonb AND coalesce(step.cfg->'requires_sandbox','false')='false'::jsonb
      AND coalesce(step.cfg->'browser_interaction_required','false')='false'::jsonb AND coalesce(step.cfg->'mcp_actions','[]')='[]'::jsonb
      AND coalesce(step.cfg->'browser_secret_names','[]')='[]'::jsonb AND coalesce(step.cfg->'browser_allowed_domains','[]')='[]'::jsonb
      AND m.can_use AND m.can_view AND m.revoked_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>clock_timestamp())
      AND b.expires_at>clock_timestamp() AND r.site_id=i.site_id
      AND c.id::text=p_operation->>'connector_id' AND c.toolkit_slug=p_operation->>'toolkit_slug'
      AND 'direct'=ANY(cp.allowed_hosts) AND (cp.tool_access_mode='all' OR (cp.tool_access_mode='selected' AND (p_operation->>'tool_slug')=ANY(cp.allowed_tools)))
      AND EXISTS (SELECT FROM public.connector_effective_site_access(i.site_id,p_actor) v WHERE v.can_manage)
      AND public.site_user_has_effective_access(i.site_id,p_actor)
      AND NOT EXISTS (SELECT FROM public.site_members sm WHERE (sm.site_id,sm.user_id)=(i.site_id,p_actor) AND
        (sm.restrict_to_assigned_only IS DISTINCT FROM false OR sm.blocked_screens IS NULL OR
         sm.blocked_screens && (r.required_screens || ARRAY['connectors','robots','workflows']) OR
         EXISTS (SELECT FROM public.site_member_location_restrictions l WHERE (l.site_id,l.site_member_id)=(i.site_id,sm.id))));
  IF binding IS NULL OR octet_length(graph::text)>65536 THEN RAISE insufficient_privilege; END IF;
  snap:=jsonb_build_object('graph',graph,'binding',binding,'authority',grant_data);
  RETURN snap || jsonb_build_object('digest',encode(sha256(convert_to(snap::text,'UTF8')),'hex'));
EXCEPTION WHEN no_data_found OR too_many_rows THEN RAISE insufficient_privilege;
END $$;

CREATE FUNCTION workflow_connector_private.summary(s jsonb, published boolean) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT jsonb_build_object('digest',s->'digest','connector_id',s#>'{binding,connector_id}','operation',s#>'{binding,tool_slug}',
    'toolkit_slug',s#>'{binding,toolkit_slug}','toolkit_version',s#>'{binding,toolkit_version}','schema_hash',s#>'{binding,schema_hash}',
    'arguments',s#>'{binding,arguments}','principal_id',s#>'{binding,principal_id}','instance_id',s#>'{graph,step,instance_id}',
    'node_id',s#>'{graph,step,id}','trigger_id',s#>'{graph,trigger,id}','cron',s#>'{graph,trigger,config,cron}',
    'timezone',s#>'{graph,trigger,config,timezone}','published',published);
$$;

-- Dedicated private runs. No public workflow_runs, mutable plans, logs, prompts
-- or sandbox artifacts become receipts or evidence of cron provenance.
CREATE FUNCTION workflow_connector_private.due(s jsonb, occ timestamptz) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
  WITH x AS (SELECT string_to_array(s#>>'{graph,trigger,config,cron}',' ') f,
    occ AT TIME ZONE (s#>>'{graph,trigger,config,timezone}') local_time)
  SELECT isfinite(occ) AND occ=date_trunc('minute',occ,'UTC') AND occ<=clock_timestamp()
    AND occ>clock_timestamp()-interval '120 seconds'
    AND CASE WHEN f[1]='*' THEN true WHEN starts_with(f[1],'*/') THEN extract(minute FROM local_time)::int%substr(f[1],3)::int=0
      ELSE extract(minute FROM local_time)=f[1]::int END
    AND CASE WHEN f[2]='*' THEN true ELSE extract(hour FROM local_time)=f[2]::int END FROM x;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA workflow_connector_private FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
