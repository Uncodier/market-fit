-- Intersect legacy site-wide policies with ownership and operation permissions.
-- Keep existing location/procurement guards: permissive policies cannot override
-- these restrictive policies. No historical attribution is inferred or rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.instance_row_access(
  p_site uuid, p_user uuid, p_created uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.user_can(p_site, 'select') IS TRUE
    AND EXISTS (
      SELECT 1 FROM public.sites s WHERE s.id = p_site AND (
        s.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.site_ownership so
          WHERE so.site_id = s.id AND so.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.site_members sm
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (NOT coalesce(sm.restrict_to_assigned_only, false)
              OR p_user = auth.uid() OR p_created = auth.uid()))
      )
    );
$$;
REVOKE ALL ON FUNCTION public.instance_row_access(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.instance_row_access(uuid, uuid, uuid) TO authenticated;

-- Attribution supplied by a browser must match the authenticated actor. Legacy
-- user_id/created_by differences remain readable, but clients cannot reassign them.
CREATE OR REPLACE FUNCTION public.guard_instance_attribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('role', true) NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Instance attribution requires authentication' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := coalesce(NEW.user_id, auth.uid());
    NEW.created_by := coalesce(NEW.created_by, auth.uid());
    IF NEW.user_id IS DISTINCT FROM auth.uid() OR NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Instance attribution must match the actor' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.site_id IS DISTINCT FROM OLD.site_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Instance attribution is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_instance_attribution() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS instance_attribution_guard ON public.remote_instances;
CREATE TRIGGER instance_attribution_guard BEFORE INSERT OR UPDATE ON public.remote_instances
FOR EACH ROW EXECUTE FUNCTION public.guard_instance_attribution();

ALTER TABLE public.remote_instances ENABLE ROW LEVEL SECURITY;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.remote_instances FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS instance_ownership_anon_guard ON public.remote_instances;
CREATE POLICY instance_ownership_anon_guard ON public.remote_instances
AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DO $$
DECLARE
  operation text;
  table_name text;
  relation regclass;
  predicate text;
  parent_predicate text;
BEGIN
  FOREACH operation IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
    predicate := format(
      'public.instance_row_access(site_id, user_id, created_by) AND public.user_can(site_id, %L) IS TRUE',
      operation);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.remote_instances', 'instance_ownership_' || operation);
    EXECUTE format('CREATE POLICY %I ON public.remote_instances AS RESTRICTIVE FOR %s TO authenticated %s %s',
      'instance_ownership_' || operation, upper(operation),
      CASE WHEN operation <> 'insert' THEN 'USING (' || predicate || ')' ELSE '' END,
      CASE WHEN operation IN ('insert', 'update') THEN 'WITH CHECK (' || predicate || ')' ELSE '' END);
  END LOOP;

  -- Optional API-owned tables are guarded when installed; existing permissive
  -- grants/policies remain authoritative. Never broaden a read-only table's writes.
  FOREACH table_name IN ARRAY ARRAY[
    'instance_logs', 'instance_artifacts', 'instance_context_memories',
    'instance_context_state', 'instance_nodes', 'instance_pending_work',
    'instance_plans', 'assets', 'workflow_runs', 'workflow_triggers',
    'cloud_files', 'cloud_file_operations', 'requirement_status', 'remote_sessions',
    'automation_auth_sessions', 'site_secrets', 'catalog_item_requirements'
  ] LOOP
    relation := to_regclass('public.' || table_name);
    IF relation IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', relation);
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON %s FROM PUBLIC, anon, authenticated', relation);
    EXECUTE format('DROP POLICY IF EXISTS instance_ownership_anon_guard ON %s', relation);
    EXECUTE format('CREATE POLICY instance_ownership_anon_guard ON %s AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)', relation);
    FOREACH operation IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
      -- The parent query is invoker-scoped: it includes ownership, location and
      -- procurement RLS. A supplied site must match the real parent site.
      parent_predicate := format(
        'EXISTS (SELECT 1 FROM public.remote_instances parent WHERE parent.id = %1$I.instance_id AND parent.site_id = %1$I.site_id)', table_name);
      -- Only established standalone resources may omit an instance. Core
      -- instance data cannot be detached to escape the parent authorization.
      IF table_name IN ('assets', 'cloud_files', 'cloud_file_operations',
        'requirement_status', 'remote_sessions', 'automation_auth_sessions', 'site_secrets') THEN
        parent_predicate := format('(%I.instance_id IS NULL OR %s)', table_name, parent_predicate);
      END IF;
      predicate := format('(%s) AND public.user_can(%I.site_id, %L) IS TRUE',
        parent_predicate, table_name, operation);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %s', 'instance_ownership_' || operation, relation);
      EXECUTE format('CREATE POLICY %I ON %s AS RESTRICTIVE FOR %s TO authenticated %s %s',
        'instance_ownership_' || operation, relation, upper(operation),
        CASE WHEN operation <> 'insert' THEN 'USING (' || predicate || ')' ELSE '' END,
        CASE WHEN operation IN ('insert', 'update') THEN 'WITH CHECK (' || predicate || ')' ELSE '' END);
    END LOOP;
  END LOOP;

  -- Context edges expose both nodes, including edges between different instances.
  relation := to_regclass('public.instance_node_contexts');
  IF relation IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.instance_node_contexts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.instance_node_contexts FROM PUBLIC, anon, authenticated';
    EXECUTE 'DROP POLICY IF EXISTS instance_ownership_anon_guard ON public.instance_node_contexts';
    EXECUTE 'CREATE POLICY instance_ownership_anon_guard ON public.instance_node_contexts AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)';
    FOREACH operation IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
      predicate := format(
        'EXISTS (SELECT 1 FROM public.instance_nodes n WHERE n.id = target_node_id AND n.site_id = instance_node_contexts.site_id) AND EXISTS (SELECT 1 FROM public.instance_nodes n WHERE n.id = context_node_id AND n.site_id = instance_node_contexts.site_id) AND public.user_can(site_id, %L) IS TRUE', operation);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %s', 'instance_ownership_' || operation, relation);
      EXECUTE format('CREATE POLICY %I ON %s AS RESTRICTIVE FOR %s TO authenticated %s %s',
        'instance_ownership_' || operation, relation, upper(operation),
        CASE WHEN operation <> 'insert' THEN 'USING (' || predicate || ')' ELSE '' END,
        CASE WHEN operation IN ('insert', 'update') THEN 'WITH CHECK (' || predicate || ')' ELSE '' END);
    END LOOP;
  END IF;

  -- Infrastructure diagnostics inherit the visible plan's instance boundary.
  relation := to_regclass('public.instance_plan_step_infrastructure_events');
  IF relation IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', relation);
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON %s FROM PUBLIC, anon, authenticated', relation);
    EXECUTE format('DROP POLICY IF EXISTS instance_ownership_anon_guard ON %s', relation);
    EXECUTE format('CREATE POLICY instance_ownership_anon_guard ON %s AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)', relation);
    FOREACH operation IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
      predicate := format('EXISTS (SELECT 1 FROM public.instance_plans p WHERE p.id = instance_plan_step_infrastructure_events.plan_id AND public.user_can(p.site_id, %L) IS TRUE)', operation);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %s', 'instance_ownership_' || operation, relation);
      EXECUTE format('CREATE POLICY %I ON %s AS RESTRICTIVE FOR %s TO authenticated %s %s',
        'instance_ownership_' || operation, relation, upper(operation),
        CASE WHEN operation <> 'insert' THEN 'USING (' || predicate || ')' ELSE '' END,
        CASE WHEN operation IN ('insert', 'update') THEN 'WITH CHECK (' || predicate || ')' ELSE '' END);
    END LOOP;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;