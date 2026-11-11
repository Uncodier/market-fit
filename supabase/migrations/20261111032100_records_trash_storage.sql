-- Recoverable trash: no content, reference, diagram or embedding is destroyed.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.records
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deletion_batch_id uuid,
  ADD COLUMN deletion_root_category_id uuid,
  ADD CONSTRAINT records_trash_marker_check CHECK
    ((deleted_at IS NULL) = (deletion_batch_id IS NULL)
      AND (deleted_at IS NOT NULL OR deletion_root_category_id IS NULL));
ALTER TABLE public.record_categories
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deletion_batch_id uuid,
  ADD COLUMN deletion_root_category_id uuid,
  ADD CONSTRAINT record_categories_trash_marker_check CHECK
    ((deleted_at IS NULL) = (deletion_batch_id IS NULL)
      AND (deleted_at IS NOT NULL OR deletion_root_category_id IS NULL));
CREATE INDEX records_trash_site ON public.records(site_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX record_categories_trash_site ON public.record_categories(site_id, deleted_at)
  WHERE deleted_at IS NOT NULL;
CREATE INDEX record_categories_trash_parent ON public.record_categories(site_id, parent_category_id);

-- Supplemental AND policies leave every existing authorization predicate intact.
CREATE POLICY records_active_select ON public.records AS RESTRICTIVE FOR SELECT
  TO PUBLIC USING (deleted_at IS NULL);
CREATE POLICY record_categories_active_select ON public.record_categories AS RESTRICTIVE FOR SELECT
  TO PUBLIC USING (deleted_at IS NULL);
REVOKE DELETE ON public.records, public.record_categories FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE ON public.records, public.record_categories FROM PUBLIC, anon, authenticated;
GRANT INSERT (site_id, category_id, title, description, data, relations, status, location_id)
  ON public.records TO authenticated;
GRANT UPDATE (category_id, title, description, data, relations, status)
  ON public.records TO authenticated;
GRANT INSERT (site_id, name, description, icon, parent_category_id, template_fields)
  ON public.record_categories TO authenticated;
GRANT UPDATE (name, description, icon, parent_category_id, template_fields)
  ON public.record_categories TO authenticated;
REVOKE INSERT (deleted_at, deletion_batch_id, deletion_root_category_id),
  UPDATE (deleted_at, deletion_batch_id, deletion_root_category_id)
  ON public.records, public.record_categories FROM PUBLIC, anon, authenticated;

-- Invoker guard cannot be bypassed by setting a user-controlled request GUC.
CREATE FUNCTION public.guard_record_trash_writes() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE privileged boolean; parent_id uuid; parent_row record;
BEGIN
  SELECT current_user = pg_get_userbyid(c.relowner) INTO privileged
    FROM pg_class c WHERE c.oid = TG_RELID;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Use Records trash RPCs; physical deletion is unavailable' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.site_id IS DISTINCT FROM OLD.site_id) THEN
    RAISE EXCEPTION 'Record and category identity/site are immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT privileged AND (
    NEW.deleted_at IS NOT NULL OR NEW.deletion_batch_id IS NOT NULL
    OR NEW.deletion_root_category_id IS NOT NULL
    OR (TG_OP = 'UPDATE' AND OLD.deleted_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Trash metadata is managed by Records RPCs' USING ERRCODE = '42501';
  END IF;
  -- Even table-owner embedding/diagram RPCs cannot mutate trashed content.
  -- The sole permitted update is an exact metadata-only restore.
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NOT NULL AND (
    NEW.deleted_at IS NOT NULL OR
    (to_jsonb(NEW) - ARRAY['deleted_at','deletion_batch_id','deletion_root_category_id','updated_at'])
      IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['deleted_at','deletion_batch_id','deletion_root_category_id','updated_at'])
  ) THEN
    RAISE EXCEPTION 'Trashed content is read-only until restored' USING ERRCODE = '42501';
  END IF;
  -- Every child creation/move and trash operation serializes on this site key.
  -- Contention can yield a deadlock victim; callers may retry the whole transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || NEW.site_id::text, 0));
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'records' THEN parent_id := NEW.category_id;
  ELSE parent_id := NEW.parent_category_id; END IF;
  IF parent_id IS NOT NULL THEN
    SELECT c.site_id, c.deleted_at, c.deletion_batch_id INTO parent_row
      FROM public.record_categories c WHERE c.id = parent_id;
    IF NOT FOUND OR parent_row.site_id IS DISTINCT FROM NEW.site_id
      OR (parent_row.deleted_at IS NOT NULL AND NOT (
        privileged AND TG_OP = 'UPDATE' AND OLD.deleted_at IS NOT NULL
        AND parent_row.deletion_batch_id = OLD.deletion_batch_id
      )) THEN
      RAISE EXCEPTION 'An active same-site parent category is required' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_record_trash_writes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER record_trash_write_guard BEFORE INSERT OR UPDATE ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.guard_record_trash_writes();
CREATE TRIGGER category_trash_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.record_categories
  FOR EACH ROW EXECUTE FUNCTION public.guard_record_trash_writes();

CREATE FUNCTION public.assert_record_trash_admin(p_site_id uuid, p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_site_role(p_site_id) IS NULL
    OR public.current_user_site_role(p_site_id) NOT IN ('owner', 'admin')
    OR public.user_can(p_site_id, p_action) IS DISTINCT FROM true
    OR public.current_user_has_site_location_restrictions(p_site_id) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Records trash access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_record_trash_admin(uuid, text) FROM PUBLIC, anon, authenticated;
COMMIT;