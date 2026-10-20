-- Makinari only. Forward correction; never rewrite the applied cancellation migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $migration$
DECLARE
  definition text;
  old_query text := $old$  SELECT * INTO plan FROM public.instance_plans WHERE id = p_plan_id AND instance_id = p_instance_id FOR UPDATE;$old$;
  new_query text := $new$  -- Lock every existing sibling before inspecting sandbox evidence. Updates that
  -- preserve bindings do not acquire the instance lock in the binding trigger.
  -- New inserts/binding changes still fence on the locked real parent instance.
  PERFORM 1 FROM public.instance_plans WHERE instance_id = p_instance_id ORDER BY id FOR UPDATE;
  SELECT * INTO plan FROM public.instance_plans WHERE id = p_plan_id AND instance_id = p_instance_id FOR UPDATE;$new$;
BEGIN
  definition := pg_catalog.pg_get_functiondef('public.cancel_quiescent_instance_plan(uuid,uuid)'::regprocedure);
  IF strpos(definition, new_query) > 0 THEN
    RETURN;
  ELSIF strpos(definition, old_query) > 0 THEN
    EXECUTE replace(definition, old_query, new_query);
  ELSE
    RAISE EXCEPTION 'Unexpected cancellation definition; review before migration';
  END IF;
END;
$migration$;
COMMIT;