BEGIN;

-- Category editor saves compare the version loaded by the browser, not a fresh
-- version fetched when saving. Stamp every write monotonically, after existing
-- category triggers (including any generic modification-time trigger).
CREATE OR REPLACE FUNCTION public.advance_record_category_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.updated_at := GREATEST(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_record_category_version() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER zz_records_category_version
BEFORE UPDATE ON public.record_categories FOR EACH ROW
EXECUTE FUNCTION public.advance_record_category_version();

-- The payload has the same write surface as the authenticated table grants.
-- RLS and all existing record triggers apply; no elevated client or claim.
CREATE OR REPLACE FUNCTION public.save_record_at_template(
  p_record_id uuid, p_updated_at timestamptz, p_site_id uuid, p_category_id uuid,
  p_template_fields jsonb, p_changes jsonb
) RETURNS SETOF public.records
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  live_fields jsonb;
  changes public.records;
  assignments text;
BEGIN
  IF auth.uid() IS NULL OR jsonb_typeof(p_changes) IS DISTINCT FROM 'object'
    OR p_changes - ARRAY['title','description','data','relations','status'] <> '{}'::jsonb
    OR p_site_id IS NULL OR p_category_id IS NULL
    OR (p_record_id IS NULL) <> (p_updated_at IS NULL) THEN
    RAISE EXCEPTION 'Invalid record save' USING ERRCODE = '22023';
  END IF;
  -- Reject unauthorized calls before taking a tenant-wide lock. Recheck the
  -- template under the lock; row-level write policies still apply to the DML.
  IF NOT COALESCE(public.user_can(p_site_id, CASE WHEN p_record_id IS NULL THEN 'insert' ELSE 'update' END), false)
    OR NOT EXISTS (SELECT 1 FROM public.record_categories c
      WHERE c.id = p_category_id AND c.site_id = p_site_id AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Record category not found or access denied' USING ERRCODE = '42501';
  END IF;

  -- Use the category/trash writer's existing site fence. Do not wait while
  -- another transaction may hold a tuple lock and be about to take the fence.
  IF current_setting('transaction_isolation') NOT IN ('read committed', 'read uncommitted') THEN
    RAISE EXCEPTION 'Record saves require READ COMMITTED' USING ERRCODE = '0A000';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('records-trash:' || p_site_id::text, 0)) THEN
    RAISE EXCEPTION 'Another Records change is in progress. Try saving again.' USING ERRCODE = '55P03';
  END IF;

  SELECT COALESCE(NULLIF(c.template_fields, 'null'::jsonb), '[]'::jsonb) INTO live_fields
  FROM public.record_categories c WHERE c.id = p_category_id AND c.site_id = p_site_id AND c.deleted_at IS NULL;
  IF NOT FOUND OR live_fields IS DISTINCT FROM p_template_fields THEN
    RAISE EXCEPTION 'The field template changed or is unavailable. Reload before saving again.' USING ERRCODE = '40001';
  END IF;

  changes := jsonb_populate_record(NULL::public.records, p_changes);
  IF p_record_id IS NULL THEN
    RETURN QUERY INSERT INTO public.records (site_id, category_id, title, description, data, relations, status)
      VALUES (p_site_id, p_category_id, changes.title, changes.description, changes.data, changes.relations, changes.status) RETURNING *;
  ELSE
    -- A regular Data API update may already have locked this row before its
    -- trigger tries the site fence. Do not wait in the opposite lock order.
    PERFORM 1 FROM public.records r WHERE r.id = p_record_id AND r.site_id = p_site_id
      AND r.updated_at = p_updated_at AND r.deleted_at IS NULL FOR NO KEY UPDATE NOWAIT;
    IF NOT FOUND THEN RETURN; END IF;

    -- Build only from a constant allowlist, never from request-provided SQL.
    -- Preserve column-specific trigger behavior for an omitted patch property.
    SELECT string_agg(format('%I = ($1).%I', k.name, k.name), ', ') INTO assignments
    FROM unnest(ARRAY['title','description','data','relations','status']) AS k(name)
    WHERE p_changes ? k.name;
    IF EXISTS (SELECT 1 FROM public.records r WHERE r.id = p_record_id AND r.category_id IS DISTINCT FROM p_category_id) THEN
      assignments := concat_ws(', ', assignments, 'category_id = $5');
    END IF;
    IF assignments IS NULL THEN
      RETURN QUERY SELECT r.* FROM public.records r WHERE r.id = p_record_id AND r.site_id = p_site_id;
    ELSE
      RETURN QUERY EXECUTE 'UPDATE public.records r SET ' || assignments ||
        ' WHERE r.id = $2 AND r.site_id = $3 AND r.updated_at = $4 AND r.deleted_at IS NULL RETURNING r.*'
      USING changes, p_record_id, p_site_id, p_updated_at, p_category_id;
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_record_at_template(uuid,timestamptz,uuid,uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_record_at_template(uuid,timestamptz,uuid,uuid,jsonb,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;