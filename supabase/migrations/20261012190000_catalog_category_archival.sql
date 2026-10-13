BEGIN;

ALTER TABLE public.catalog_categories
  ADD COLUMN status text NOT NULL DEFAULT 'active'
  CONSTRAINT catalog_categories_status_check CHECK (status IN ('active', 'archived'));

-- Every membership/status writer uses this transaction-scoped site gate. Row
-- triggers already hold their target row, so waiting here could invert the RPC's
-- category -> items lock order. Fail fast instead; retry the whole transaction.
-- READ COMMITTED is required for fresh recursive membership after taking the gate.
CREATE FUNCTION public.catalog_archive_lock_site(p_site_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Catalog archival writes require READ COMMITTED'
      USING ERRCODE = '25001';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('catalog-category-archive:' || p_site_id::text, 0)) THEN
    RAISE EXCEPTION 'Concurrent catalog change; retry the transaction'
      USING ERRCODE = '55P03';
  END IF;
END;
$$;

-- UNION (not UNION ALL) terminates even for legacy cyclic variant graphs.
CREATE FUNCTION public.catalog_category_archive_item_ids(p_site_id uuid, p_category_id uuid)
RETURNS uuid[] LANGUAGE sql SET search_path = public, pg_temp AS $$
  WITH RECURSIVE affected(id) AS (
    SELECT i.id FROM public.catalog_items i
      WHERE i.site_id = p_site_id AND i.category_id = p_category_id
    UNION
    SELECT i.id FROM public.catalog_items i JOIN affected a ON i.parent_id = a.id
      WHERE i.site_id = p_site_id
  )
  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::uuid[]) FROM affected;
$$;

CREATE FUNCTION public.guard_catalog_category_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.site_id IS DISTINCT FROM OLD.site_id THEN
      RAISE EXCEPTION 'Catalog category identity and site are immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.status = 'active' THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.status = 'active' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR coalesce(public.current_user_site_role(NEW.site_id), '') NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only site owners and admins can change category archive state' USING ERRCODE = '42501';
  END IF;
  PERFORM public.catalog_archive_lock_site(NEW.site_id);
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.updated_at := statement_timestamp();
  END IF;
  -- Restoring a category is manager-only and never restores its items.
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.cascade_catalog_category_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  affected_ids uuid[];
BEGIN
  IF NEW.status <> 'archived' THEN RETURN NEW; END IF;
  affected_ids := public.catalog_category_archive_item_ids(NEW.site_id, NEW.id);
  PERFORM i.id FROM public.catalog_items i
    WHERE i.site_id = NEW.site_id AND i.id = ANY(affected_ids)
    ORDER BY i.id FOR UPDATE NOWAIT;
  UPDATE public.catalog_items SET status = 'archived', updated_at = statement_timestamp()
    WHERE site_id = NEW.site_id AND id = ANY(affected_ids) AND status IS DISTINCT FROM 'archived';
  -- Only eligibility links are removed, not pass history or accounting/promotions.
  PERFORM r.id FROM public.pass_redeemable_items r
    WHERE r.site_id = NEW.site_id AND r.reservable_catalog_item_id = ANY(affected_ids)
    ORDER BY r.id FOR UPDATE NOWAIT;
  DELETE FROM public.pass_redeemable_items
    WHERE site_id = NEW.site_id AND reservable_catalog_item_id = ANY(affected_ids);
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_catalog_category_archive
  BEFORE INSERT OR UPDATE OF status, id, site_id ON public.catalog_categories
  FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_category_archive();
CREATE TRIGGER cascade_catalog_category_archive
  AFTER INSERT OR UPDATE OF status ON public.catalog_categories
  FOR EACH ROW EXECUTE FUNCTION public.cascade_catalog_category_archive();

CREATE FUNCTION public.guard_catalog_item_archive_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  site_key uuid;
  ancestor_ids uuid[];
  category_ids uuid[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Grandfather unrelated edits, including edits of archived or legacy items.
    IF (NEW.id, NEW.site_id, NEW.category_id, NEW.parent_id, NEW.status)
      IS NOT DISTINCT FROM (OLD.id, OLD.site_id, OLD.category_id, OLD.parent_id, OLD.status) THEN
      RETURN NEW;
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Catalog item identity is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  FOR site_key IN SELECT DISTINCT s FROM unnest(ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.site_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.site_id END
  ]) s WHERE s IS NOT NULL ORDER BY s LOOP
    PERFORM public.catalog_archive_lock_site(site_key);
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  -- Archived inserts/moves also take the gate so the recursive result is complete.
  IF NEW.status IS DISTINCT FROM 'active' THEN RETURN NEW; END IF;

  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.catalog_items WHERE id = NEW.parent_id AND site_id = NEW.site_id
  ) THEN
    RAISE EXCEPTION 'Catalog parent must belong to the item site' USING ERRCODE = '23514';
  END IF;
  WITH RECURSIVE ancestors(id, parent_id, category_id) AS (
    SELECT i.id, i.parent_id, i.category_id FROM public.catalog_items i
      WHERE i.site_id = NEW.site_id AND i.id = NEW.parent_id
    UNION
    SELECT i.id, i.parent_id, i.category_id FROM public.catalog_items i
      JOIN ancestors a ON i.id = a.parent_id WHERE i.site_id = NEW.site_id
  ) SELECT coalesce(array_agg(id), ARRAY[]::uuid[]),
      array_append(coalesce(array_agg(category_id), ARRAY[]::uuid[]), NEW.category_id)
    INTO ancestor_ids, category_ids FROM ancestors;

  -- Same gate excludes concurrent status/relationship changes. NOWAIT row locks
  -- also avoid inversions with unrelated edits that deliberately skip the gate.
  PERFORM c.id FROM public.catalog_categories c
    WHERE c.site_id = NEW.site_id AND c.id = ANY(category_ids)
    ORDER BY c.id FOR SHARE NOWAIT;
  IF NEW.category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.catalog_categories WHERE id = NEW.category_id AND site_id = NEW.site_id
  ) THEN
    RAISE EXCEPTION 'Catalog category must belong to the item site' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.catalog_categories
    WHERE site_id = NEW.site_id AND id = ANY(category_ids) AND status = 'archived') THEN
    RAISE EXCEPTION 'Active items cannot belong to an archived category' USING ERRCODE = '23514';
  END IF;
  PERFORM i.id FROM public.catalog_items i
    WHERE i.site_id = NEW.site_id AND i.id = ANY(ancestor_ids)
    ORDER BY i.id FOR SHARE NOWAIT;
  IF EXISTS (SELECT 1 FROM public.catalog_items
    WHERE site_id = NEW.site_id AND id = ANY(ancestor_ids) AND status = 'archived') THEN
    RAISE EXCEPTION 'Active variants cannot belong to an archived parent' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_catalog_item_archive_membership
  BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_item_archive_membership();

-- Do not let a concurrent eligibility insert recreate a link after cleanup.
CREATE FUNCTION public.guard_catalog_archive_redeemable_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.site_id, NEW.reservable_catalog_item_id, NEW.pass_catalog_item_id)
    IS NOT DISTINCT FROM (OLD.site_id, OLD.reservable_catalog_item_id, OLD.pass_catalog_item_id) THEN
    RETURN NEW;
  END IF;
  PERFORM public.catalog_archive_lock_site(NEW.site_id);
  PERFORM i.id FROM public.catalog_items i
    WHERE i.id = NEW.reservable_catalog_item_id AND i.site_id = NEW.site_id
      AND i.status IS DISTINCT FROM 'archived' FOR SHARE NOWAIT;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redeemable item must be unarchived and belong to the link site' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_catalog_archive_redeemable_link
  BEFORE INSERT OR UPDATE ON public.pass_redeemable_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_archive_redeemable_link();

CREATE FUNCTION public.archive_catalog_category(p_site_id uuid, p_category_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_site_id IS NULL OR p_category_id IS NULL THEN
    RAISE EXCEPTION 'Site and category IDs are required' USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NULL OR coalesce(public.current_user_site_role(p_site_id), '') NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only site owners and admins can archive categories' USING ERRCODE = '42501';
  END IF;
  PERFORM public.catalog_archive_lock_site(p_site_id);
  PERFORM c.id FROM public.catalog_categories c
    WHERE c.id = p_category_id AND c.site_id = p_site_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog category not found' USING ERRCODE = 'P0002';
  END IF;
  -- The trigger is the single cascade authority, including direct status writes
  -- and retries. No caller-controlled session flag or service-role bypass exists.
  UPDATE public.catalog_categories SET status = 'archived'
    WHERE id = p_category_id AND site_id = p_site_id;
  RETURN jsonb_build_object('item_ids', public.catalog_category_archive_item_ids(p_site_id, p_category_id));
END;
$$;

REVOKE ALL ON FUNCTION public.catalog_archive_lock_site(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.catalog_category_archive_item_ids(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_catalog_category_archive() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cascade_catalog_category_archive() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_catalog_item_archive_membership() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_catalog_archive_redeemable_link() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.archive_catalog_category(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_catalog_category(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;