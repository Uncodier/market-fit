BEGIN;
SET LOCAL lock_timeout = '5s';

-- Preserve accents and punctuation; only case and ASCII whitespace are ignored.
CREATE FUNCTION public.catalog_import_category_key(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT lower(regexp_replace(btrim(p_name, E' \t\n\r\v\f'), E'[ \t\n\r\v\f]+', ' ', 'g'));
$$;
REVOKE ALL ON FUNCTION public.catalog_import_category_key(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.catalog_import_category_key(text) TO authenticated, service_role;

-- Non-unique by design: legacy duplicates remain intact and are reported as
-- ambiguous rather than merged or silently assigned to an arbitrary category.
CREATE INDEX catalog_categories_site_import_name_idx
  ON public.catalog_categories (site_id, public.catalog_import_category_key(name))
  WHERE status = 'active';

-- Include ordinary category creation/renaming/deletion in the import's site gate.
-- A row trigger must fail fast rather than invert the category/item lock order.
CREATE FUNCTION public.guard_catalog_import_category_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.catalog_archive_lock_site(OLD.site_id);
    RETURN OLD;
  END IF;
  PERFORM public.catalog_archive_lock_site(NEW.site_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_catalog_import_category_name() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_catalog_import_category_name
  BEFORE INSERT OR UPDATE OF name OR DELETE ON public.catalog_categories
  FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_import_category_name();

-- Read-only bounded lookup, sharing exactly the same normalization as execution.
CREATE FUNCTION public.preview_catalog_import_categories(p_site_id uuid, p_names jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  category_name jsonb;
  category_count integer;
  missing jsonb := '[]'::jsonb;
  ambiguous jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.user_can(p_site_id, 'select'), false)
    OR NOT coalesce(public.user_can(p_site_id, 'insert'), false) THEN
    RAISE EXCEPTION 'Catalog import is not permitted' USING ERRCODE = '42501';
  END IF;
  IF p_site_id IS NULL OR p_names IS NULL OR jsonb_typeof(p_names) <> 'array' THEN
    RAISE EXCEPTION 'Invalid category lookup' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_names) > 100 OR octet_length(p_names::text) > 100000 THEN
    RAISE EXCEPTION 'Invalid category lookup' USING ERRCODE = '22023';
  END IF;
  FOR category_name IN SELECT DISTINCT value FROM jsonb_array_elements(p_names) LOOP
    IF jsonb_typeof(category_name) <> 'string'
      OR length(btrim(category_name #>> '{}', E' \t\n\r\v\f')) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'Invalid category name' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO category_count FROM public.catalog_categories c
      WHERE c.site_id = p_site_id AND c.status = 'active'
        AND public.catalog_import_category_key(c.name) = public.catalog_import_category_key(category_name #>> '{}');
    IF category_count = 0 THEN missing := missing || jsonb_build_array(category_name);
    ELSIF category_count > 1 THEN ambiguous := ambiguous || jsonb_build_array(category_name);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('missingCategories', missing, 'ambiguousCategories', ambiguous);
END;
$$;
REVOKE ALL ON FUNCTION public.preview_catalog_import_categories(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_catalog_import_categories(uuid, jsonb) TO authenticated;
-- Replace only category resolution; retain batch validation, authorization,
-- receipts, exact-case SKUs, row rollback, and cache-facing result contracts.
CREATE OR REPLACE FUNCTION public.import_catalog_batch(
  p_site_id uuid, p_rows jsonb, p_mode text, p_request_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  input_payload jsonb;
  receipt public.catalog_import_batches%ROWTYPE;
  source_row jsonb;
  item jsonb;
  field text;
  amount numeric;
  sku_value text;
  row_number integer;
  seen_skus text[] := ARRAY[]::text[];
  seen_rows integer[] := ARRAY[]::integer[];
  category_ids uuid[];
  category_id_value uuid;
  category_name_value text;
  category_created boolean;
  item_id uuid;
  affected_id uuid;
  created_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
  row_errors jsonb := '[]'::jsonb;
  changed_ids uuid[] := ARRAY[]::uuid[];
  response jsonb;
BEGIN
  -- No service-role/JWT-role shortcut: every call needs a real authorized actor.
  IF actor IS NULL OR NOT coalesce(public.user_can(p_site_id, 'select'), false)
    OR NOT coalesce(public.user_can(p_site_id, 'insert'), false)
    OR (p_mode = 'update' AND NOT coalesce(public.user_can(p_site_id, 'update'), false)) THEN
    RAISE EXCEPTION 'Catalog import is not permitted' USING ERRCODE = '42501';
  END IF;
  IF p_site_id IS NULL OR p_request_id IS NULL OR p_mode IS NULL
    OR p_mode NOT IN ('skip', 'update') OR p_rows IS NULL THEN
    RAISE EXCEPTION 'Invalid catalog import batch' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Invalid catalog import batch' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 100
    OR octet_length(p_rows::text) > 400000 THEN
    RAISE EXCEPTION 'Invalid catalog import batch' USING ERRCODE = '22023';
  END IF;
  -- Reject malformed input before any writes. Optional nulls are not omissions.
  FOR source_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF jsonb_typeof(source_row) <> 'object' THEN
      RAISE EXCEPTION 'Invalid catalog import row' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(source_row) k
      WHERE k NOT IN ('rowNumber', 'item', 'category', 'defaultCurrency'))
      OR NOT source_row ?& ARRAY['rowNumber', 'item']
      OR jsonb_typeof(source_row->'rowNumber') <> 'number'
      OR jsonb_typeof(source_row->'item') <> 'object' THEN
      RAISE EXCEPTION 'Invalid catalog import row' USING ERRCODE = '22023';
    END IF;
    amount := (source_row->>'rowNumber')::numeric;
    IF amount <> trunc(amount) OR amount NOT BETWEEN 2 AND 100001 THEN
      RAISE EXCEPTION 'Invalid catalog import row number' USING ERRCODE = '22023';
    END IF;
    row_number := amount::integer;
    IF row_number = ANY(seen_rows) THEN
      RAISE EXCEPTION 'Duplicate catalog import row number' USING ERRCODE = '22023';
    END IF;
    seen_rows := array_append(seen_rows, row_number);
    item := source_row->'item';
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN (
      'sku', 'name', 'description', 'image_url', 'currency',
      'cost', 'lowest_sale_price', 'target_sale_price'))
      OR NOT item ?& ARRAY['sku', 'name'] THEN
      RAISE EXCEPTION 'Invalid catalog import item' USING ERRCODE = '22023';
    END IF;
    FOREACH field IN ARRAY ARRAY['sku', 'name'] LOOP
      IF jsonb_typeof(item->field) <> 'string'
        OR length(btrim(item->>field, E' \t\n\r\v\f')) NOT BETWEEN 1 AND
          (CASE WHEN field = 'sku' THEN 200 ELSE 500 END) THEN
        RAISE EXCEPTION 'Invalid catalog import item' USING ERRCODE = '22023';
      END IF;
    END LOOP;
    sku_value := btrim(item->>'sku', E' \t\n\r\v\f');
    IF sku_value = ANY(seen_skus) THEN
      RAISE EXCEPTION 'Duplicate SKU in catalog import batch' USING ERRCODE = '22023';
    END IF;
    seen_skus := array_append(seen_skus, sku_value);
    IF item ? 'description' AND (jsonb_typeof(item->'description') <> 'string'
      OR length(item->>'description') > 10000) THEN
      RAISE EXCEPTION 'Invalid catalog import description' USING ERRCODE = '22023';
    END IF;
    IF item ? 'currency' AND (jsonb_typeof(item->'currency') <> 'string'
      OR item->>'currency' !~ '^[A-Z]{3}$') THEN
      RAISE EXCEPTION 'Invalid catalog import currency' USING ERRCODE = '22023';
    END IF;
    IF source_row ? 'defaultCurrency' AND (jsonb_typeof(source_row->'defaultCurrency') <> 'string'
      OR source_row->>'defaultCurrency' !~ '^[A-Z]{3}$') THEN
      RAISE EXCEPTION 'Invalid catalog import currency' USING ERRCODE = '22023';
    END IF;
    IF source_row ? 'category' AND (jsonb_typeof(source_row->'category') <> 'string'
      OR length(btrim(source_row->>'category', E' \t\n\r\v\f')) NOT BETWEEN 1 AND 200) THEN
      RAISE EXCEPTION 'Invalid catalog import category' USING ERRCODE = '22023';
    END IF;
    IF item ? 'image_url' AND (jsonb_typeof(item->'image_url') <> 'string'
      OR length(item->>'image_url') > 2048
      OR item->>'image_url' ~ '[[:space:]\\]'
      OR item->>'image_url' !~* '^https://([a-z0-9][a-z0-9.-]*|\[[0-9a-f:]+\])(:443)?([/?#].*)?$') THEN
      RAISE EXCEPTION 'Invalid catalog import image URL' USING ERRCODE = '22023';
    END IF;
    FOREACH field IN ARRAY ARRAY['cost', 'lowest_sale_price', 'target_sale_price'] LOOP
      IF item ? field THEN
        IF jsonb_typeof(item->field) <> 'number' THEN
          RAISE EXCEPTION 'Invalid catalog import amount' USING ERRCODE = '22023';
        END IF;
        amount := (item->>field)::numeric;
        IF amount NOT BETWEEN 0 AND 1000000000000 OR amount <> trunc(amount, 4) THEN
          RAISE EXCEPTION 'Invalid catalog import amount' USING ERRCODE = '22023';
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Catalog imports require READ COMMITTED' USING ERRCODE = '25001';
  END IF;

  -- Serialize imports per site, including request replay. Fresh READ COMMITTED
  -- snapshots after waiting see the committed receipt and any winning SKU insert.
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-batch-import:' || p_site_id::text, 0));
  IF NOT coalesce(public.user_can(p_site_id, 'select'), false)
    OR NOT coalesce(public.user_can(p_site_id, 'insert'), false)
    OR (p_mode = 'update' AND NOT coalesce(public.user_can(p_site_id, 'update'), false)) THEN
    RAISE EXCEPTION 'Catalog import is not permitted' USING ERRCODE = '42501';
  END IF;
  input_payload := jsonb_build_object('mode', p_mode, 'rows', p_rows);
  SELECT * INTO receipt FROM public.catalog_import_batches
    WHERE site_id = p_site_id AND request_id = p_request_id;
  IF FOUND THEN
    IF receipt.actor_id IS DISTINCT FROM actor OR receipt.payload IS DISTINCT FROM input_payload THEN
      RAISE EXCEPTION 'Catalog import request does not match its receipt' USING ERRCODE = '22023';
    END IF;
    RETURN receipt.result;
  END IF;
  -- Integrate with existing category archival lock order. A competing external
  -- membership/status writer fails the whole call for a safe retry, not a receipt.
  PERFORM public.catalog_archive_lock_site(p_site_id);

  FOR source_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    item := source_row->'item';
    row_number := (source_row->>'rowNumber')::numeric::integer;
    sku_value := btrim(item->>'sku', E' \t\n\r\v\f');
    category_id_value := NULL;
    category_created := false;
    BEGIN
      SELECT i.id INTO item_id FROM public.catalog_items i
        WHERE i.site_id = p_site_id AND i.sku = sku_value FOR UPDATE;
      -- Skipped identities do not create unused categories or fail name matching.
      IF item_id IS NOT NULL AND p_mode = 'skip' THEN
        skipped_count := skipped_count + 1;
        CONTINUE;
      END IF;
      IF item_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.catalog_items i WHERE i.id = item_id
        AND i.site_id = p_site_id AND (i.kind <> 'product' OR i.parent_id IS NOT NULL)) THEN
        row_errors := row_errors || jsonb_build_array(jsonb_build_object(
          'rowNumber', row_number,
          'message', 'This SKU belongs to a non-product or variant. Edit it in its dedicated workflow.'));
        CONTINUE;
      END IF;
      IF source_row ? 'category' THEN
        category_name_value := regexp_replace(btrim(source_row->>'category', E' \t\n\r\v\f'), E'[ \t\n\r\v\f]+', ' ', 'g');
        SELECT array_agg(c.id ORDER BY c.id) INTO category_ids FROM public.catalog_categories c
          WHERE c.site_id = p_site_id AND c.status = 'active'
            AND public.catalog_import_category_key(c.name) = public.catalog_import_category_key(category_name_value);
        IF coalesce(cardinality(category_ids), 0) > 1 THEN
          row_errors := row_errors || jsonb_build_array(jsonb_build_object(
            'rowNumber', row_number, 'message', 'Category name matches multiple active categories in this site'));
          CONTINUE;
        END IF;
        IF coalesce(cardinality(category_ids), 0) = 0 THEN
          -- Creation and item assignment share this row subtransaction. A failed
          -- item write rolls back its new category; batch replay returns its receipt.
          INSERT INTO public.catalog_categories (site_id, name, status)
            VALUES (p_site_id, category_name_value, 'active') RETURNING id INTO category_id_value;
          category_created := true;
        ELSE
          category_id_value := category_ids[1];
        END IF;
        PERFORM c.id FROM public.catalog_categories c WHERE c.id = category_id_value
          AND c.site_id = p_site_id AND c.status = 'active'
          AND public.catalog_import_category_key(c.name) = public.catalog_import_category_key(category_name_value) FOR SHARE NOWAIT;
        IF NOT FOUND THEN RAISE EXCEPTION 'Category changed'; END IF;
      END IF;

      IF item_id IS NULL THEN
        INSERT INTO public.catalog_items (
          site_id, sku, kind, name, description, image_url, currency,
          cost, lowest_sale_price, target_sale_price, category_id, status,
          availability_status, is_purchasable, is_marketplace_listed, is_pos_available
        ) VALUES (
          p_site_id, sku_value, 'product', btrim(item->>'name', E' \t\n\r\v\f'),
          item->>'description', item->>'image_url', coalesce(item->>'currency', source_row->>'defaultCurrency', 'USD'),
          (item->>'cost')::numeric, (item->>'lowest_sale_price')::numeric,
          (item->>'target_sale_price')::numeric, category_id_value, 'active',
          'available', true, false, false
        ) ON CONFLICT (site_id, sku) WHERE sku IS NOT NULL DO NOTHING RETURNING id INTO item_id;
        IF item_id IS NOT NULL THEN
          created_count := created_count + 1;
          changed_ids := array_append(changed_ids, item_id);
          CONTINUE;
        END IF;
        -- A non-import SKU writer may win the unique index. Never count a lost
        -- insertion as created; reselect its same-site row in a fresh snapshot.
        SELECT i.id INTO item_id FROM public.catalog_items i
          WHERE i.site_id = p_site_id AND i.sku = sku_value FOR UPDATE;
        IF item_id IS NULL THEN RAISE EXCEPTION 'Concurrent catalog change'; END IF;
      END IF;
      IF p_mode = 'skip' THEN
        IF category_created THEN
          DELETE FROM public.catalog_categories WHERE id = category_id_value AND site_id = p_site_id;
        END IF;
        skipped_count := skipped_count + 1;
        CONTINUE;
      END IF;
      IF EXISTS (SELECT 1 FROM public.catalog_items i WHERE i.id = item_id
        AND i.site_id = p_site_id AND (i.kind <> 'product' OR i.parent_id IS NOT NULL)) THEN
        IF category_created THEN
          DELETE FROM public.catalog_categories WHERE id = category_id_value AND site_id = p_site_id;
        END IF;
        row_errors := row_errors || jsonb_build_array(jsonb_build_object(
          'rowNumber', row_number,
          'message', 'This SKU belongs to a non-product or variant. Edit it in its dedicated workflow.'));
        CONTINUE;
      END IF;
      UPDATE public.catalog_items i SET
        name = btrim(item->>'name', E' \t\n\r\v\f'),
        description = CASE WHEN item ? 'description' THEN item->>'description' ELSE i.description END,
        image_url = CASE WHEN item ? 'image_url' THEN item->>'image_url' ELSE i.image_url END,
        currency = CASE WHEN item ? 'currency' THEN item->>'currency' ELSE i.currency END,
        cost = CASE WHEN item ? 'cost' THEN (item->>'cost')::numeric ELSE i.cost END,
        lowest_sale_price = CASE WHEN item ? 'lowest_sale_price' THEN (item->>'lowest_sale_price')::numeric ELSE i.lowest_sale_price END,
        target_sale_price = CASE WHEN item ? 'target_sale_price' THEN (item->>'target_sale_price')::numeric ELSE i.target_sale_price END,
        category_id = CASE WHEN source_row ? 'category' THEN category_id_value ELSE i.category_id END,
        updated_at = statement_timestamp()
      WHERE i.id = item_id AND i.site_id = p_site_id AND i.sku = sku_value
      RETURNING i.id INTO affected_id;
      IF affected_id IS NULL THEN RAISE EXCEPTION 'Concurrent catalog change'; END IF;
      updated_count := updated_count + 1;
      changed_ids := array_append(changed_ids, affected_id);
    EXCEPTION
      -- Retryable infrastructure failures roll back the entire batch + receipt.
      WHEN lock_not_available OR deadlock_detected OR serialization_failure THEN RAISE;
      WHEN OTHERS THEN
        -- The row subtransaction rolls back; never expose SQLERRM or raw values.
        row_errors := row_errors || jsonb_build_array(jsonb_build_object(
          'rowNumber', row_number, 'message', 'Unable to import this row; check its catalog values'));
    END;
  END LOOP;
  response := jsonb_build_object('created', created_count, 'updated', updated_count,
    'skipped', skipped_count, 'errors', row_errors, 'item_ids', to_jsonb(changed_ids));
  INSERT INTO public.catalog_import_batches (site_id, request_id, actor_id, payload, result)
    VALUES (p_site_id, p_request_id, actor, input_payload, response);
  RETURN response;
END;
$$;
REVOKE ALL ON FUNCTION public.import_catalog_batch(uuid, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_catalog_batch(uuid, jsonb, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
