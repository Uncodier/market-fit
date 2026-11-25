BEGIN;

-- A draft reference, separate from editable step JSON and all execution grants.
ALTER TABLE public.instance_nodes ADD COLUMN task_connector_id uuid
  REFERENCES public.connectors(id) ON DELETE SET NULL;
CREATE INDEX instance_nodes_task_connector_idx ON public.instance_nodes(task_connector_id)
  WHERE task_connector_id IS NOT NULL;

CREATE FUNCTION public.check_task_connector_reference() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.task_connector_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.task_connector_id IS NOT DISTINCT FROM OLD.task_connector_id
      AND NEW.site_id IS NOT DISTINCT FROM OLD.site_id AND NEW.type IS NOT DISTINCT FROM OLD.type
      AND NEW.instance_id IS NOT DISTINCT FROM OLD.instance_id THEN RETURN NEW; END IF;
  IF NEW.type IS DISTINCT FROM 'wf-step' OR auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.connectors c WHERE c.id = NEW.task_connector_id AND c.site_id = NEW.site_id
      AND public.connector_visible(c.site_id, c.id)
  ) THEN RAISE EXCEPTION 'Task connector not available' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.check_task_connector_reference() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER check_task_connector_reference BEFORE INSERT OR UPDATE OF task_connector_id, site_id, type, instance_id
  ON public.instance_nodes FOR EACH ROW EXECUTE FUNCTION public.check_task_connector_reference();

COMMIT;