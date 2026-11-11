BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.trash_record_category(p_category_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE root public.record_categories; batch uuid := gen_random_uuid(); ids uuid[];
  record_count integer; category_count integer;
BEGIN
  SELECT * INTO root FROM public.record_categories WHERE id = p_category_id;
  PERFORM public.assert_record_trash_admin(root.site_id, 'delete');
  PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || root.site_id::text, 0));
  SELECT * INTO root FROM public.record_categories WHERE id = p_category_id FOR UPDATE;
  IF to_jsonb(root)->>'system_key' IS NOT NULL THEN
    RAISE EXCEPTION 'System record categories cannot be trashed' USING ERRCODE = '23514';
  END IF;
  IF root.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('id', root.id, 'site_id', root.site_id,
      'deletion_batch_id', root.deletion_batch_id, 'affected_records', 0, 'affected_categories', 0);
  END IF;
  WITH RECURSIVE subtree AS (
    SELECT id FROM public.record_categories WHERE id = root.id AND deleted_at IS NULL
    UNION
    SELECT c.id FROM public.record_categories c JOIN subtree s ON c.parent_category_id = s.id
      WHERE c.site_id = root.site_id AND c.deleted_at IS NULL
  ) SELECT array_agg(id) INTO ids FROM subtree;
  IF EXISTS (SELECT 1 FROM public.record_categories c WHERE c.id = ANY(ids)
    AND to_jsonb(c)->>'system_key' IS NOT NULL) THEN
    RAISE EXCEPTION 'System record categories cannot be trashed' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.record_categories WHERE id = ANY(ids) ORDER BY id FOR UPDATE;
  UPDATE public.records SET deleted_at = transaction_timestamp(), deletion_batch_id = batch,
    deletion_root_category_id = root.id
    WHERE site_id = root.site_id AND category_id = ANY(ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS record_count = ROW_COUNT;
  UPDATE public.record_categories SET deleted_at = transaction_timestamp(), deletion_batch_id = batch,
    deletion_root_category_id = root.id WHERE id = ANY(ids);
  GET DIAGNOSTICS category_count = ROW_COUNT;
  RETURN jsonb_build_object('id', root.id, 'site_id', root.site_id, 'deletion_batch_id', batch,
    'affected_records', record_count, 'affected_categories', category_count);
END;
$$;

CREATE FUNCTION public.restore_record_category(p_category_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE root public.record_categories; batch uuid; record_count integer; category_count integer;
BEGIN
  SELECT * INTO root FROM public.record_categories WHERE id = p_category_id;
  PERFORM public.assert_record_trash_admin(root.site_id, 'update');
  PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || root.site_id::text, 0));
  SELECT * INTO root FROM public.record_categories WHERE id = p_category_id FOR UPDATE;
  batch := root.deletion_batch_id;
  IF batch IS NULL THEN
    RETURN jsonb_build_object('id', root.id, 'site_id', root.site_id,
      'deletion_batch_id', NULL, 'affected_records', 0, 'affected_categories', 0);
  END IF;
  IF root.deletion_root_category_id IS DISTINCT FROM root.id THEN
    RAISE EXCEPTION 'Restore the deleted root category first' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.record_categories WHERE site_id = root.site_id
    AND (deletion_batch_id = batch OR id = root.parent_category_id) ORDER BY id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.record_categories c JOIN public.record_categories p ON p.id = c.parent_category_id
    WHERE c.site_id = root.site_id AND c.deletion_batch_id = batch
      AND p.deleted_at IS NOT NULL AND p.deletion_batch_id IS DISTINCT FROM batch
  ) THEN
    RAISE EXCEPTION 'Restore the parent category first' USING ERRCODE = '23514';
  END IF;
  UPDATE public.record_categories SET deleted_at = NULL, deletion_batch_id = NULL,
    deletion_root_category_id = NULL WHERE site_id = root.site_id AND deletion_batch_id = batch;
  GET DIAGNOSTICS category_count = ROW_COUNT;
  UPDATE public.records SET deleted_at = NULL, deletion_batch_id = NULL,
    deletion_root_category_id = NULL WHERE site_id = root.site_id AND deletion_batch_id = batch;
  GET DIAGNOSTICS record_count = ROW_COUNT;
  RETURN jsonb_build_object('id', root.id, 'site_id', root.site_id, 'deletion_batch_id', batch,
    'affected_records', record_count, 'affected_categories', category_count);
END;
$$;

-- The actual DELETE is evaluated by all existing RLS DELETE policies as caller.
-- Only its authorized BEFORE DELETE row trigger elevates to write trash markers.
-- RETURN NULL suppresses the physical DELETE and all referential cascades.
CREATE FUNCTION public.convert_record_delete_to_trash() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE batch uuid := gen_random_uuid();
BEGIN
  -- Preserve only the existing backend-owned AI-feedback unlike lifecycle.
  -- The database role setting is protected by SET ROLE privileges; never trust
  -- a JWT role claim or any user-settable application setting for this exception.
  IF to_jsonb(OLD)->>'source_type' IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.record_categories c WHERE c.id = OLD.category_id
      AND c.site_id = OLD.site_id AND to_jsonb(c)->>'system_key' = 'ai-feedback'
  ) THEN
    IF current_setting('role', true) = 'service_role' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Manage system feedback from its source UI' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated record deletion required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || OLD.site_id::text, 0));
  IF OLD.deleted_at IS NULL THEN
    UPDATE public.records SET deleted_at = transaction_timestamp(), deletion_batch_id = batch,
      deletion_root_category_id = NULL WHERE id = OLD.id AND deleted_at IS NULL;
    PERFORM set_config('records.trash_receipt', jsonb_build_object('id', OLD.id,
      'site_id', OLD.site_id, 'deletion_batch_id', batch,
      'affected_records', 1, 'affected_categories', 0)::text, true);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.convert_record_delete_to_trash() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER record_delete_to_trash BEFORE DELETE ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.convert_record_delete_to_trash();
GRANT DELETE ON public.records TO authenticated;

CREATE FUNCTION public.trash_record(p_record_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE receipt jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_record_id IS NULL THEN
    RAISE EXCEPTION 'Record not found or access denied' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('records.trash_receipt', '', true);
  DELETE FROM public.records WHERE id = p_record_id;
  receipt := NULLIF(current_setting('records.trash_receipt', true), '')::jsonb;
  IF receipt IS NULL THEN
    RAISE EXCEPTION 'Record not found or access denied' USING ERRCODE = '42501';
  END IF;
  RETURN receipt;
END;
$$;

-- Restoration/listing intentionally require owner/admin, not assignment-only access.
CREATE FUNCTION public.restore_record(p_record_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target public.records; batch uuid;
BEGIN
  SELECT * INTO target FROM public.records WHERE id = p_record_id;
  PERFORM public.assert_record_trash_admin(target.site_id, 'update');
  PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || target.site_id::text, 0));
  SELECT * INTO target FROM public.records WHERE id = p_record_id FOR UPDATE;
  batch := target.deletion_batch_id;
  IF target.deletion_root_category_id IS NOT NULL THEN
    RAISE EXCEPTION 'Restore the deleted root category first' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.record_categories c WHERE c.id = target.category_id
    AND c.site_id = target.site_id AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Restore the parent category first' USING ERRCODE = '23514';
  END IF;
  UPDATE public.records SET deleted_at = NULL, deletion_batch_id = NULL,
    deletion_root_category_id = NULL WHERE id = target.id AND deleted_at IS NOT NULL;
  RETURN jsonb_build_object('id', target.id, 'site_id', target.site_id, 'deletion_batch_id', batch,
    'affected_records', CASE WHEN batch IS NULL THEN 0 ELSE 1 END, 'affected_categories', 0);
END;
$$;

CREATE FUNCTION public.list_record_trash(p_site_id uuid)
RETURNS TABLE(kind text, id uuid, title text, category_id uuid, parent_category_id uuid,
  deleted_at timestamptz, deletion_batch_id uuid, deletion_root_category_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.assert_record_trash_admin(p_site_id, 'select');
  RETURN QUERY
    SELECT 'category'::text, c.id, c.name::text, NULL::uuid, c.parent_category_id,
      c.deleted_at, c.deletion_batch_id, c.deletion_root_category_id
      FROM public.record_categories c WHERE c.site_id = p_site_id AND c.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'record'::text, r.id, r.title::text, r.category_id, NULL::uuid,
      r.deleted_at, r.deletion_batch_id, r.deletion_root_category_id
      FROM public.records r WHERE r.site_id = p_site_id AND r.deleted_at IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trash_record_category(uuid), public.restore_record_category(uuid),
  public.trash_record(uuid), public.restore_record(uuid), public.list_record_trash(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trash_record_category(uuid), public.restore_record_category(uuid),
  public.trash_record(uuid), public.restore_record(uuid), public.list_record_trash(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;