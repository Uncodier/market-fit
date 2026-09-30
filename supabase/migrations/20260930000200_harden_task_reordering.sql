BEGIN;
SET LOCAL lock_timeout = '5s';

-- Preserve the deployed signature and caller-scoped RLS/permission triggers.
CREATE OR REPLACE FUNCTION public.reorder_task_priorities(
  p_task_id uuid,
  p_new_position integer,
  p_status text,
  p_site_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_old_status text;
  v_destination_count bigint;
  v_position bigint := 1;
  v_task record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_task_id IS NULL OR p_site_id IS NULL THEN
    RAISE EXCEPTION 'Task and site IDs are required' USING ERRCODE = '22023';
  END IF;
  -- Matches the deployed public.tasks tasks_status_check constraint.
  IF p_status IS NULL OR p_status NOT IN (
    'pending', 'in_progress', 'completed', 'failed', 'canceled'
  ) THEN
    RAISE EXCEPTION 'Invalid task status' USING ERRCODE = '22023';
  END IF;
  IF p_new_position IS NULL OR p_new_position < 1 THEN
    RAISE EXCEPTION 'Task position must be at least 1' USING ERRCODE = '22023';
  END IF;
  IF public.user_can(p_site_id, 'update') IS NOT TRUE THEN
    RAISE EXCEPTION 'Task update not authorized' USING ERRCODE = '42501';
  END IF;

  -- Acquire before ANY row lock. All reorders in a site share this transaction
  -- lock, including cross-column moves and moves into an empty column.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.reorder_task_priorities:' || p_site_id::text, 0)
  );

  SELECT t.status INTO v_old_status
  FROM public.tasks t
  WHERE t.id = p_task_id AND t.site_id = p_site_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found in the requested site' USING ERRCODE = 'P0002';
  END IF;

  -- Only the caller's RLS-visible rows participate. Assigned-only members must
  -- never renumber hidden tasks; priorities need not be globally unique across
  -- different visibility scopes. Other direct task writers do not take this lock.
  PERFORM t.id FROM public.tasks t
  WHERE t.site_id = p_site_id AND t.status IN (v_old_status, p_status)
  ORDER BY t.id
  FOR UPDATE;

  SELECT count(*) INTO v_destination_count
  FROM public.tasks t
  WHERE t.site_id = p_site_id AND t.status = p_status AND t.id <> p_task_id;
  IF p_new_position > v_destination_count + 1 THEN
    RAISE EXCEPTION 'Task position exceeds destination size' USING ERRCODE = '22023';
  END IF;

  -- No writes (or update-trigger side effects) occur until every input and the
  -- actual visible task/site pair have been validated.
  IF v_old_status <> p_status THEN
    FOR v_task IN
      SELECT t.id FROM public.tasks t
      WHERE t.site_id = p_site_id AND t.status = v_old_status AND t.id <> p_task_id
      ORDER BY t.priority DESC, t.id
    LOOP
      UPDATE public.tasks
      SET priority = 1000 - v_position * 10
      WHERE id = v_task.id AND site_id = p_site_id
        AND priority IS DISTINCT FROM 1000 - v_position * 10;
      v_position := v_position + 1;
    END LOOP;
  END IF;

  v_position := 1;
  FOR v_task IN
    SELECT t.id FROM public.tasks t
    WHERE t.site_id = p_site_id AND t.status = p_status AND t.id <> p_task_id
    ORDER BY t.priority DESC, t.id
  LOOP
    IF v_position = p_new_position THEN
      v_position := v_position + 1;
    END IF;
    UPDATE public.tasks
    SET priority = 1000 - v_position * 10
    WHERE id = v_task.id AND site_id = p_site_id
      AND priority IS DISTINCT FROM 1000 - v_position * 10;
    v_position := v_position + 1;
  END LOOP;

  UPDATE public.tasks
  SET priority = 1000 - p_new_position::bigint * 10, status = p_status
  WHERE id = p_task_id AND site_id = p_site_id
    AND (priority IS DISTINCT FROM 1000 - p_new_position::bigint * 10
      OR status IS DISTINCT FROM p_status);
END;
$function$;

-- Both repository consumers are authenticated browser clients. No actorless
-- service contract is required, and service_role would bypass assigned-only RLS.
REVOKE ALL ON FUNCTION public.reorder_task_priorities(uuid, integer, text, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reorder_task_priorities(uuid, integer, text, uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;