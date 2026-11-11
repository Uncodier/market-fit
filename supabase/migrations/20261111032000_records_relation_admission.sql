-- Admission guard only: existing RLS, assignment and location semantics are unchanged.
-- Uses the caller's SELECT policies for foreign targets, never a definer lookup.
-- This does NOT implement JSON foreign keys: target deletes/reclassification,
-- membership disablement, company association removal and concurrent target changes
-- still require a reviewed reverse-integrity design before relational pack rollout.
-- FOR SHARE here would require foreign UPDATE privileges and deny legitimate readers.
-- Existing rows are not rewritten or retroactively scanned.
BEGIN;

CREATE OR REPLACE FUNCTION public.validate_records_relation_admission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  fields jsonb;
  field jsonb;
  entry record;
  target_kind text;
  target_table text;
  target_id uuid;
  target_category uuid;
  readable boolean;
  previous_relations jsonb := '{}'::jsonb;
BEGIN
  IF NEW.relations IS NOT NULL AND jsonb_typeof(NEW.relations) NOT IN ('object', 'null') THEN
    RAISE EXCEPTION 'Record relations must be an object' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(NULLIF(c.template_fields, 'null'::jsonb), '[]'::jsonb) INTO fields
  FROM public.record_categories c
  WHERE c.id = NEW.category_id AND c.site_id = NEW.site_id;
  IF fields IS NULL OR jsonb_typeof(fields) <> 'array' THEN
    RAISE EXCEPTION 'Record category not found or access denied' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.site_id = NEW.site_id AND OLD.category_id = NEW.category_id THEN
      previous_relations := OLD.relations;
    END IF;
  END IF;
  FOR entry IN SELECT key, value FROM jsonb_each(COALESCE(NULLIF(NEW.relations, 'null'::jsonb), '{}'::jsonb)) LOOP
    IF entry.value = 'null'::jsonb OR entry.value = '""'::jsonb THEN CONTINUE; END IF;
    SELECT f INTO field FROM jsonb_array_elements(fields) f
      WHERE f->>'name' = entry.key AND f->>'type' = 'relation' LIMIT 1;
    IF field IS NULL THEN
      IF jsonb_typeof(entry.value) = 'string' AND previous_relations->entry.key = entry.value THEN CONTINUE; END IF;
      RAISE EXCEPTION 'Unknown record relation field' USING ERRCODE = '23514';
    END IF;
    IF jsonb_typeof(entry.value) <> 'string'
      OR (entry.value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Record relation must be a single entity ID' USING ERRCODE = '23514';
    END IF;
    target_id := (entry.value #>> '{}')::uuid;
    -- Unchanged historical links are not new assignments. Source RLS still applies;
    -- preview/read paths must independently authorize the target on every read.
    IF previous_relations->entry.key = entry.value THEN CONTINUE; END IF;
    target_kind := COALESCE(field->>'relationTarget', 'lead');
    -- Also reject invalid legacy targeting metadata rather than silently ignoring it.
    IF field ? 'targetCategoryId' AND (target_kind <> 'record'
      OR jsonb_typeof(field->'targetCategoryId') <> 'string'
      OR field->>'targetCategoryId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
      RAISE EXCEPTION 'Invalid target category' USING ERRCODE = '23514';
    END IF;
    IF target_kind = 'person' THEN
      IF previous_relations->entry.key = entry.value THEN CONTINUE; END IF;
      RAISE EXCEPTION 'New person links are unsupported' USING ERRCODE = '23514';
    END IF;
    readable := false;
    IF target_kind = 'company' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.companies c WHERE c.id = target_id AND (
          EXISTS (SELECT 1 FROM public.leads l WHERE l.site_id = NEW.site_id AND l.company_id = c.id)
          OR EXISTS (SELECT 1 FROM public.deals d WHERE d.site_id = NEW.site_id AND d.company_id = c.id)
          OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.site_id = NEW.site_id AND s.company_id = c.id)
        )
      ) INTO readable;
    ELSIF target_kind = 'team_member' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.site_members m
        WHERE m.site_id = NEW.site_id AND m.user_id = target_id
          AND m.status = 'active' AND NOT COALESCE(m.license_suspended, false)
          AND NOT COALESCE(m.manually_disabled, false)
      ) INTO readable;
    ELSE
      target_table := CASE target_kind
        WHEN 'lead' THEN 'leads' WHEN 'supplier' THEN 'suppliers'
        WHEN 'sales_order' THEN 'sale_orders' WHEN 'deal' THEN 'deals'
        WHEN 'campaign' THEN 'campaigns' WHEN 'catalog_item' THEN 'catalog_items'
        WHEN 'content' THEN 'content' WHEN 'task' THEN 'tasks'
        WHEN 'sale' THEN 'sales' WHEN 'purchase' THEN 'purchases'
        WHEN 'quotation' THEN 'quotations' WHEN 'record' THEN 'records'
        WHEN 'record_category' THEN 'record_categories' ELSE NULL END;
      IF target_table IS NULL THEN
        RAISE EXCEPTION 'Unsupported record relation target' USING ERRCODE = '23514';
      END IF;
      IF target_kind = 'record' AND field->>'targetCategoryId' IS NOT NULL THEN
        target_category := (field->>'targetCategoryId')::uuid;
        SELECT EXISTS (SELECT 1 FROM public.records r WHERE r.id = target_id
          AND r.site_id = NEW.site_id AND r.category_id = target_category) INTO readable;
      ELSE
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id::text = $1::text AND site_id = $2)', target_table)
          INTO readable USING target_id, NEW.site_id;
      END IF;
    END IF;
    IF NOT readable THEN
      RAISE EXCEPTION 'Record relation target not found or access denied' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_records_relation_admission() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS records_relation_admission ON public.records;
CREATE TRIGGER records_relation_admission
  BEFORE INSERT OR UPDATE OF relations, category_id, site_id ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.validate_records_relation_admission();

-- This narrow definer guard inspects only whether a category has any records,
-- including RLS-hidden records. It grants no lookup access and returns no row data.
-- It protects schema edits, not concurrent first-insert/category-edit races.
CREATE OR REPLACE FUNCTION public.preserve_populated_record_field_contracts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  old_field jsonb;
  next_field jsonb;
  previous_fields jsonb := '[]'::jsonb;
  populated boolean := false;
  key text;
  target_kind text;
  ids text[] := ARRAY[]::text[];
  names text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.template_fields IS NOT DISTINCT FROM OLD.template_fields THEN RETURN NEW; END IF;
    previous_fields := COALESCE(NULLIF(OLD.template_fields, 'null'::jsonb), '[]'::jsonb);
    SELECT EXISTS (SELECT 1 FROM public.records r WHERE r.category_id = OLD.id) INTO populated;
  END IF;
  -- Nullable legacy templates are empty. Removing populated fields is still checked below.
  IF NEW.template_fields IS NULL OR NEW.template_fields = 'null'::jsonb THEN
    IF populated AND previous_fields <> '[]'::jsonb THEN
      RAISE EXCEPTION 'Populated field changes require a data migration' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF jsonb_typeof(NEW.template_fields) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Template fields must be an array' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(NEW.template_fields) > 200 THEN
    RAISE EXCEPTION 'Too many template fields' USING ERRCODE = '23514';
  END IF;
  FOR next_field IN SELECT value FROM jsonb_array_elements(NEW.template_fields) LOOP
    IF jsonb_typeof(next_field) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid template field' USING ERRCODE = '23514';
    END IF;
    FOREACH key IN ARRAY ARRAY['id', 'name'] LOOP
      IF jsonb_typeof(next_field->key) IS DISTINCT FROM 'string'
        OR next_field->>key !~ '[^[:space:]]' OR length(next_field->>key) > 240
        OR next_field->>key IN ('__proto__', 'prototype', 'constructor') THEN
        RAISE EXCEPTION 'Invalid template field ID or storage name' USING ERRCODE = '23514';
      END IF;
    END LOOP;
    IF next_field->>'id' = ANY(ids) OR next_field->>'name' = ANY(names) THEN
      RAISE EXCEPTION 'Field IDs and storage names must be unique' USING ERRCODE = '23514';
    END IF;
    ids := array_append(ids, next_field->>'id');
    names := array_append(names, next_field->>'name');
    IF next_field->>'type' IS NULL OR next_field->>'type' NOT IN
      ('text', 'description', 'number', 'date', 'select', 'boolean', 'location', 'relation', 'file', 'table') THEN
      RAISE EXCEPTION 'Unsupported field type' USING ERRCODE = '23514';
    END IF;
    IF next_field ? 'required' AND jsonb_typeof(next_field->'required') <> 'boolean' THEN
      RAISE EXCEPTION 'Required must be a boolean' USING ERRCODE = '23514';
    END IF;
    IF next_field ? 'label' AND (jsonb_typeof(next_field->'label') <> 'string'
      OR next_field->>'label' !~ '[^[:space:]]' OR length(next_field->>'label') > 240) THEN
      RAISE EXCEPTION 'Invalid display label' USING ERRCODE = '23514';
    END IF;
    FOREACH key IN ARRAY ARRAY['min', 'max', 'minLength', 'maxLength'] LOOP
      IF NOT next_field ? key THEN CONTINUE; END IF;
      IF jsonb_typeof(next_field->key) <> 'number' THEN
        RAISE EXCEPTION 'Invalid field bound' USING ERRCODE = '23514';
      END IF;
      IF (key IN ('min', 'max') AND next_field->>'type' <> 'number')
        OR (key IN ('minLength', 'maxLength') AND (next_field->>'type' NOT IN ('text', 'description', 'location', 'file')
          OR (next_field->>key)::numeric < 0 OR mod((next_field->>key)::numeric, 1) <> 0)) THEN
        RAISE EXCEPTION 'Invalid field bound' USING ERRCODE = '23514';
      END IF;
    END LOOP;
    IF (next_field->>'min')::numeric > (next_field->>'max')::numeric
      OR (next_field->>'minLength')::numeric > (next_field->>'maxLength')::numeric THEN
      RAISE EXCEPTION 'Invalid field bounds' USING ERRCODE = '23514';
    END IF;
    IF next_field->>'type' = 'select' THEN
      IF jsonb_typeof(next_field->'options') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid select options' USING ERRCODE = '23514';
      END IF;
      IF jsonb_array_length(next_field->'options') NOT BETWEEN 1 AND 200
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(next_field->'options') o
          WHERE jsonb_typeof(o) <> 'string' OR o #>> '{}' !~ '[^[:space:]]' OR length(o #>> '{}') > 1000)
        OR (SELECT count(*) <> count(DISTINCT o) FROM jsonb_array_elements(next_field->'options') o) THEN
        RAISE EXCEPTION 'Invalid select options' USING ERRCODE = '23514';
      END IF;
    END IF;
    target_kind := COALESCE(next_field->>'relationTarget', 'lead');
    IF next_field->>'type' = 'relation' THEN
      IF target_kind NOT IN ('lead', 'person', 'company', 'deal', 'task', 'record', 'team_member', 'supplier', 'sales_order',
        'campaign', 'catalog_item', 'content', 'sale', 'purchase', 'quotation', 'record_category') THEN
        RAISE EXCEPTION 'Unsupported relation target' USING ERRCODE = '23514';
      END IF;
      IF next_field ? 'targetCategoryId' AND (target_kind <> 'record'
        OR jsonb_typeof(next_field->'targetCategoryId') <> 'string'
        OR next_field->>'targetCategoryId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
        RAISE EXCEPTION 'Invalid target category' USING ERRCODE = '23514';
      END IF;
      IF target_kind = 'person' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(previous_fields) o
        WHERE o->>'id' = next_field->>'id' AND o->>'name' = next_field->>'name'
          AND o->>'type' = 'relation' AND o->>'relationTarget' = 'person') THEN
        RAISE EXCEPTION 'New person fields are unsupported' USING ERRCODE = '23514';
      END IF;
    ELSIF next_field ? 'relationTarget' OR next_field ? 'targetCategoryId' THEN
      RAISE EXCEPTION 'Relation configuration requires a relation field' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  FOR old_field IN SELECT value FROM jsonb_array_elements(previous_fields) LOOP
    SELECT f INTO next_field FROM jsonb_array_elements(NEW.template_fields) f
      WHERE f->>'id' = old_field->>'id' LIMIT 1;
    IF next_field IS NOT NULL AND next_field->>'name' IS DISTINCT FROM old_field->>'name' THEN
      RAISE EXCEPTION 'Existing field storage names are immutable' USING ERRCODE = '23514';
    END IF;
    IF populated AND (next_field IS NULL
      OR next_field->>'type' IS DISTINCT FROM old_field->>'type'
      OR COALESCE(next_field->>'relationTarget', 'lead') IS DISTINCT FROM COALESCE(old_field->>'relationTarget', 'lead')
      OR next_field->>'targetCategoryId' IS DISTINCT FROM old_field->>'targetCategoryId'
      OR (next_field->>'required' = 'true' AND COALESCE(old_field->>'required', 'false') <> 'true')
      OR (next_field ? 'min' AND (jsonb_typeof(old_field->'min') IS DISTINCT FROM 'number' OR (next_field->>'min')::numeric > (old_field->>'min')::numeric))
      OR (next_field ? 'max' AND (jsonb_typeof(old_field->'max') IS DISTINCT FROM 'number' OR (next_field->>'max')::numeric < (old_field->>'max')::numeric))
      OR (next_field ? 'minLength' AND (jsonb_typeof(old_field->'minLength') IS DISTINCT FROM 'number' OR (next_field->>'minLength')::numeric > (old_field->>'minLength')::numeric))
      OR (next_field ? 'maxLength' AND (jsonb_typeof(old_field->'maxLength') IS DISTINCT FROM 'number' OR (next_field->>'maxLength')::numeric < (old_field->>'maxLength')::numeric))
      OR (old_field->>'type' = 'select' AND NOT (COALESCE(next_field->'options', '[]'::jsonb) @> (old_field->'options')))) THEN
      RAISE EXCEPTION 'Populated field changes require a data migration' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  IF populated AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.template_fields) n
    WHERE n->>'required' = 'true' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(previous_fields) o WHERE o->>'id' = n->>'id'
    )
  ) THEN
    RAISE EXCEPTION 'Adding required fields requires a data migration' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.preserve_populated_record_field_contracts() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS record_category_field_contracts ON public.record_categories;
CREATE TRIGGER record_category_field_contracts
  BEFORE INSERT OR UPDATE OF template_fields ON public.record_categories
  FOR EACH ROW EXECUTE FUNCTION public.preserve_populated_record_field_contracts();

COMMIT;