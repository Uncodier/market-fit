-- Makinari only. Requires the existing atomic instance-deletion schema/RPCs.
-- No backfill: historical plans change only on an explicitly authorized request.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.cancel_quiescent_instance_plan(p_plan_id uuid, p_instance_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE
  plan public.instance_plans%ROWTYPE;
  instance public.remote_instances%ROWTYPE;
  ids uuid[];
  next_steps jsonb;
  mutation_at timestamptz;
  changed integer;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'PT401';
  END IF;
  SELECT * INTO plan FROM public.instance_plans WHERE id = p_plan_id AND instance_id = p_instance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'PT404'; END IF;
  IF public.current_user_site_role(plan.site_id) IS NULL
    OR public.current_user_site_role(plan.site_id) NOT IN ('owner','admin')
    OR public.user_can(plan.site_id, 'update') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Site owner or administrator update permission required' USING ERRCODE = 'PT403';
  END IF;

  ids := public.robot_instance_requirement_candidates(p_instance_id);
  -- Match worker/deletion lock order: requirements before instance before plan.
  PERFORM 1 FROM public.requirements WHERE id = ANY(ids) ORDER BY id FOR UPDATE;
  SELECT * INTO instance FROM public.remote_instances WHERE id = p_instance_id FOR UPDATE;
  IF NOT FOUND OR instance.site_id IS DISTINCT FROM plan.site_id THEN
    RAISE EXCEPTION 'Plan instance scope changed' USING ERRCODE = 'PT409';
  END IF;
  SELECT * INTO plan FROM public.instance_plans WHERE id = p_plan_id AND instance_id = p_instance_id FOR UPDATE;
  IF NOT FOUND OR plan.site_id IS DISTINCT FROM instance.site_id
    OR ids IS DISTINCT FROM public.robot_instance_requirement_candidates(p_instance_id) THEN
    RAISE EXCEPTION 'Plan requirement scope changed' USING ERRCODE = 'PT409';
  END IF;
  IF public.current_user_site_role(plan.site_id) IS NULL
    OR public.current_user_site_role(plan.site_id) NOT IN ('owner','admin')
    OR public.user_can(plan.site_id, 'update') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Site owner or administrator update permission required' USING ERRCODE = 'PT403';
  END IF;
  -- This is reconciliation, not remote cancellation or inferred lease expiry.
  -- Paused/stopped instances fence new harness/assistant admission under this lock.
  IF COALESCE(instance.status,'') NOT IN ('paused','stopped')
    OR instance.provider_instance_id IS NOT NULL
    OR NULLIF(instance.metadata->>'active_sandbox_id','') IS NOT NULL
    OR NULLIF(instance.metadata->>'sandbox_id','') IS NOT NULL
    OR NULLIF(instance.configuration->>'active_sandbox_id','') IS NOT NULL
    OR NULLIF(instance.configuration->>'sandbox_id','') IS NOT NULL
    OR NULLIF(plan.metadata->>'active_sandbox_id','') IS NOT NULL
    OR NULLIF(plan.metadata->>'sandbox_id','') IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.instance_plans sibling WHERE sibling.instance_id = p_instance_id AND (
      NULLIF(sibling.metadata->>'active_sandbox_id','') IS NOT NULL
      OR NULLIF(sibling.metadata->>'sandbox_id','') IS NOT NULL
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(sibling.steps) = 'array'
        THEN sibling.steps ELSE '[]'::jsonb END) step WHERE
        NULLIF(step->>'active_sandbox_id','') IS NOT NULL OR NULLIF(step->>'sandbox_id','') IS NOT NULL
        OR NULLIF(step->'metadata'->>'active_sandbox_id','') IS NOT NULL
        OR NULLIF(step->'metadata'->>'sandbox_id','') IS NOT NULL)))
    OR EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = ANY(ids) AND (
      r.site_id IS DISTINCT FROM instance.site_id OR r.cron_lock_active IS TRUE
      OR r.cron_lock_run_id IS NOT NULL OR r.cron_lock_expires_at IS NOT NULL
      OR NULLIF(r.metadata->>'active_sandbox_id','') IS NOT NULL
      OR NULLIF(r.metadata->>'sandbox_id','') IS NOT NULL))
    OR EXISTS (SELECT 1 FROM public.instance_logs WHERE instance_id = p_instance_id
      AND log_type = 'user_action' AND details->>'status' = 'running')
    OR EXISTS (SELECT 1 FROM public.instance_nodes WHERE instance_id = p_instance_id
      AND status IN ('running','in_progress','active'))
    OR EXISTS (SELECT 1 FROM public.workflow_runs WHERE instance_id = p_instance_id
      AND status IN ('pending','in_progress','running','active'))
    OR EXISTS (SELECT 1 FROM public.workflow_triggers WHERE instance_id = p_instance_id AND enabled IS TRUE)
    OR EXISTS (SELECT 1 FROM public.requirement_migration_diagnostics WHERE requirement_id = ANY(ids)
      AND state IN ('running','followup_reviewing'))
    OR EXISTS (SELECT 1 FROM public.requirement_status s WHERE s.requirement_id = ANY(ids)
      AND s.stage IN ('in-progress','running','active') AND NULLIF(s.active_sandbox_id,'') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.requirement_status newer WHERE newer.requirement_id = s.requirement_id
        AND (newer.updated_at, newer.id) > (s.updated_at, s.id)))
    OR EXISTS (SELECT 1 FROM public.harness_requirement_runs h JOIN public.harness_sessions s ON s.id = h.session_id
      WHERE h.requirement_id = ANY(ids) AND (s.snapshot->>'status' IN ('queued','running')
        OR s.lease_owner IS NOT NULL OR s.lease_expires_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Stop and reconcile execution before cancelling the plan' USING ERRCODE = 'PT409';
  END IF;
  IF plan.status NOT IN ('pending','in_progress','paused','blocked','cancelled')
    OR plan.metadata->>'workflow_template' = 'true'
    OR plan.metadata->>'workflow_run' = 'true'
    OR (plan.steps IS NOT NULL AND jsonb_typeof(plan.steps) IS DISTINCT FROM 'array') THEN
    RAISE EXCEPTION 'Plan cannot be cancelled through this operation' USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(plan.steps,'[]'::jsonb)) s WHERE
    jsonb_typeof(s) IS DISTINCT FROM 'object' OR s->>'status' IS NULL
    OR s->>'status' NOT IN ('pending','in_progress','in-progress','running','active','paused','blocked',
      'completed','failed','cancelled','canceled','skipped')
    OR NULLIF(s->>'active_sandbox_id','') IS NOT NULL OR NULLIF(s->>'sandbox_id','') IS NOT NULL
    OR NULLIF(s->'metadata'->>'active_sandbox_id','') IS NOT NULL
    OR NULLIF(s->'metadata'->>'sandbox_id','') IS NOT NULL) THEN
    RAISE EXCEPTION 'Plan steps require execution reconciliation' USING ERRCODE = 'PT409';
  END IF;
  mutation_at := clock_timestamp();
  SELECT COALESCE(jsonb_agg(CASE WHEN s.value->>'status' IN
    ('pending','in_progress','in-progress','running','active','paused','blocked') THEN
      s.value || jsonb_build_object('status','cancelled','cancelled_at',mutation_at,
        'cancellation_reason','Cancelled by project manager') ELSE s.value END ORDER BY s.ordinality),'[]'::jsonb),
    count(*) FILTER (WHERE s.value->>'status' IN
      ('pending','in_progress','in-progress','running','active','paused','blocked'))::integer
  INTO next_steps, changed FROM jsonb_array_elements(COALESCE(plan.steps,'[]'::jsonb))
    WITH ORDINALITY s(value,ordinality);
  IF plan.status <> 'cancelled' OR changed > 0
    OR plan.completion_reason IS DISTINCT FROM 'Cancelled by project manager' THEN
    UPDATE public.instance_plans SET status = 'cancelled', steps = next_steps,
      completed_at = COALESCE(completed_at,mutation_at),
      completion_reason = 'Cancelled by project manager', updated_at = mutation_at
    WHERE id = p_plan_id AND instance_id = p_instance_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plan cancellation not confirmed' USING ERRCODE = 'PT409'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.instance_plans WHERE id = p_plan_id
    AND instance_id = p_instance_id AND site_id = instance.site_id AND status = 'cancelled'
    AND completion_reason = 'Cancelled by project manager' AND steps IS NOT DISTINCT FROM next_steps) THEN
    RAISE EXCEPTION 'Plan cancellation receipt mismatch' USING ERRCODE = 'PT409';
  END IF;
  RETURN jsonb_build_object('plan_id',p_plan_id,'instance_id',p_instance_id,
    'status','cancelled','steps_cancelled',changed);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_quiescent_instance_plan(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cancel_quiescent_instance_plan(uuid,uuid) TO authenticated;

-- Prevent late workers or legacy writers from reviving an explicitly cancelled plan.
CREATE OR REPLACE FUNCTION public.guard_cancelled_instance_plan()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status = 'cancelled' AND OLD.completion_reason = 'Cancelled by project manager'
    AND (NEW.status IS DISTINCT FROM 'cancelled'
      OR NEW.completion_reason IS DISTINCT FROM OLD.completion_reason) THEN
    RAISE EXCEPTION 'Cancelled plans cannot be resumed' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'cancelled' AND OLD.completion_reason = 'Cancelled by project manager'
    AND NEW.steps IS DISTINCT FROM OLD.steps THEN
    RAISE EXCEPTION 'Cancelled plan step evidence is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'cancelled' AND NEW.completion_reason = 'Cancelled by project manager' AND (
    (NEW.steps IS NOT NULL AND jsonb_typeof(NEW.steps) IS DISTINCT FROM 'array')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.steps) = 'array'
      THEN NEW.steps ELSE '[]'::jsonb END) s WHERE jsonb_typeof(s) IS DISTINCT FROM 'object'
      OR s->>'status' IS NULL OR s->>'status' NOT IN ('completed','failed','cancelled','canceled','skipped'))
  ) THEN RAISE EXCEPTION 'Cancelled plans must have terminal steps' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_cancelled_instance_plan() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS cancelled_instance_plan_guard ON public.instance_plans;
CREATE TRIGGER cancelled_instance_plan_guard BEFORE UPDATE OF status,steps,completion_reason ON public.instance_plans
  FOR EACH ROW EXECUTE FUNCTION public.guard_cancelled_instance_plan();
COMMIT;