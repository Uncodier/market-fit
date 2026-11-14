-- One transaction owns the durable quotation triad. Invoker security preserves
-- all item, requirement, instance, location and procurement RLS restrictions.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.ensure_catalog_item_requirement(p_catalog_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  actor uuid := auth.uid();
  item public.catalog_items%ROWTYPE;
  link public.catalog_item_requirements%ROWTYPE;
  requirement_id uuid;
  instance_id uuid;
BEGIN
  IF actor IS NULL OR p_catalog_item_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Catalog quoting context unavailable');
  END IF;

  -- Serialize callers on the authoritative item, including when its existing
  -- link is RLS-hidden. Never use a service-role fallback or caller tenant IDs.
  SELECT * INTO item FROM public.catalog_items
    WHERE id = p_catalog_item_id FOR UPDATE;
  IF NOT FOUND OR public.user_can(item.site_id, 'select') IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Catalog quoting context unavailable');
  END IF;
  SELECT * INTO link FROM public.catalog_item_requirements
    WHERE catalog_item_id = item.id AND site_id = item.site_id;
  IF FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.remote_instances i
        WHERE i.id = link.instance_id AND i.site_id = item.site_id)
      OR NOT EXISTS (SELECT 1 FROM public.requirements r
        WHERE r.id = link.requirement_id AND r.site_id = item.site_id) THEN
      RETURN jsonb_build_object('error', 'Catalog quoting context unavailable');
    END IF;
    RETURN jsonb_build_object('data', to_jsonb(link));
  END IF;
  IF public.user_can(item.site_id, 'insert') IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Catalog quoting context unavailable');
  END IF;

  -- An RLS-hidden link still conflicts with the global unique item constraint.
  -- The exception block rolls back every insert, irrespective of DELETE rights.
  INSERT INTO public.requirements
    (title, description, type, priority, status, completion_status, source, site_id, user_id)
  VALUES (left('Dynamic quote: ' || item.name, 120),
    'Durable quoting requirement for catalog item ' || item.name || E'.\nKeep this requirement and its robot instance for all future quote requests so process context is preserved.',
    'task', 'medium', 'backlog', 'pending', 'dynamic_quote', item.site_id, actor)
  RETURNING id INTO requirement_id;

  INSERT INTO public.remote_instances
    (name, instance_type, status, site_id, user_id, created_by)
  VALUES (left('Quote: ' || item.name, 120), 'ubuntu', 'pending', item.site_id, actor, actor)
  RETURNING id INTO instance_id;

  INSERT INTO public.catalog_item_requirements
    (site_id, catalog_item_id, requirement_id, instance_id)
  VALUES (item.site_id, item.id, requirement_id, instance_id)
  RETURNING * INTO link;

  INSERT INTO public.requirement_status
    (site_id, instance_id, requirement_id, stage, message)
  VALUES (item.site_id, instance_id, requirement_id, 'dynamic_quote_ready',
    'Catalog item linked for dynamic quoting.');
  RETURN jsonb_build_object('data', to_jsonb(link));
EXCEPTION
  WHEN unique_violation OR insufficient_privilege OR foreign_key_violation
    OR check_violation OR not_null_violation OR lock_not_available THEN
    -- Do not disclose hidden link identities or raw constraint details.
    RETURN jsonb_build_object('error', 'Catalog quoting context unavailable');
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_catalog_item_requirement(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_catalog_item_requirement(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;