-- Validate schema edits against their actual values, without rewriting any records.
BEGIN;

CREATE OR REPLACE FUNCTION public.record_field_edit_conflicts(
  old_field jsonb, next_field jsonb, record_data jsonb, record_relations jsonb, is_draft boolean
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  old_type text := old_field->>'type';
  next_type text := next_field->>'type';
  field_name text := COALESCE(next_field->>'name', old_field->>'name');
  -- No cells are lost when a previously empty table changes type. Keep the
  -- historical JSON in place, including on read-only trashed records.
  value_data jsonb := NULLIF(NULLIF(NULLIF(record_data->field_name, 'null'::jsonb), '""'::jsonb), '[]'::jsonb);
  value_relation jsonb := NULLIF(NULLIF(record_relations->field_name, 'null'::jsonb), '""'::jsonb);
  stored_value jsonb;
  value_text text;
  text_length integer;
  table_row jsonb;
  needs_value boolean := NOT is_draft AND next_field->>'required' = 'true';
BEGIN
  IF next_field IS NULL THEN
    RETURN value_data IS NOT NULL OR value_relation IS NOT NULL;
  END IF;

  -- Never reinterpret legacy data in the other JSON store or change the target of a stored link.
  IF old_type IS DISTINCT FROM next_type AND
     ((next_type = 'relation' AND value_data IS NOT NULL) OR
      (next_type <> 'relation' AND value_relation IS NOT NULL)) THEN
    RETURN true;
  END IF;
  IF next_type = 'relation' AND value_relation IS NOT NULL AND (
    old_type IS DISTINCT FROM 'relation'
    OR COALESCE(old_field->>'relationTarget', 'lead') IS DISTINCT FROM COALESCE(next_field->>'relationTarget', 'lead')
    OR old_field->>'targetCategoryId' IS DISTINCT FROM next_field->>'targetCategoryId'
  ) THEN RETURN true; END IF;

  stored_value := CASE WHEN next_type = 'relation' THEN value_relation ELSE value_data END;
  IF stored_value IS NULL THEN RETURN COALESCE(needs_value, false); END IF;

  -- Only switch between text/description/select with existing scalar values. They
  -- share the same storage format; dates, files and locations have distinct semantics.
  IF old_type IS NOT NULL AND old_type <> next_type AND NOT (
    old_type IN ('text', 'description', 'select') AND next_type IN ('text', 'description', 'select')
  ) THEN RETURN true; END IF;

  value_text := stored_value #>> '{}';
  IF next_type IN ('text', 'description', 'location', 'file') THEN
    IF jsonb_typeof(stored_value) <> 'string' THEN RETURN true; END IF;
    -- Same whitespace set as JavaScript String.trim().
    IF needs_value AND value_text !~ U&'[^\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]' THEN RETURN true; END IF;
    IF next_field ? 'minLength' OR next_field ? 'maxLength' THEN
      -- Match JavaScript String.length (UTF-16 code units).
      text_length := length(value_text) + length(regexp_replace(value_text, U&'[^\+010000-\+10FFFF]', '', 'g'));
      RETURN COALESCE(text_length < (next_field->>'minLength')::numeric, false)
        OR COALESCE(text_length > (next_field->>'maxLength')::numeric, false);
    END IF;
  ELSIF next_type = 'number' THEN
    IF jsonb_typeof(stored_value) <> 'number' THEN RETURN true; END IF;
    RETURN COALESCE(value_text::numeric < (next_field->>'min')::numeric, false)
      OR COALESCE(value_text::numeric > (next_field->>'max')::numeric, false);
  ELSIF next_type = 'select' THEN
    RETURN jsonb_typeof(stored_value) <> 'string' OR NOT (next_field->'options' @> jsonb_build_array(stored_value));
  ELSIF next_type = 'boolean' THEN
    RETURN jsonb_typeof(stored_value) <> 'boolean';
  ELSIF next_type = 'relation' THEN
    RETURN jsonb_typeof(stored_value) <> 'string' OR value_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  ELSIF next_type = 'table' THEN
    IF jsonb_typeof(stored_value) <> 'array' THEN RETURN true; END IF;
    IF jsonb_array_length(stored_value) > 1000 THEN RETURN true; END IF;
    FOR table_row IN SELECT value FROM jsonb_array_elements(stored_value) LOOP
      IF jsonb_typeof(table_row) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(table_row)) > 200 THEN RETURN true; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_each(table_row) c
        WHERE c.key IN ('__proto__', 'prototype', 'constructor') OR jsonb_typeof(c.value) IN ('array', 'object')) THEN RETURN true; END IF;
    END LOOP;
    RETURN COALESCE(needs_value, false) AND jsonb_array_length(stored_value) = 0;
  ELSIF next_type = 'date' THEN
    IF old_type IS NULL OR jsonb_typeof(stored_value) <> 'string' OR value_text !~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}(T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9]))?$' THEN RETURN true; END IF;
    -- Use only the ISO date portion to validate the actual calendar day.
    BEGIN
      PERFORM left(value_text, 10)::date;
    EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN true;
    END;
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.record_field_edit_conflicts(jsonb, jsonb, jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;

-- Retain the installed trigger, owner and metadata checks. The existing earlier
-- category trash guard takes the Records write fence before the value checks.
CREATE OR REPLACE FUNCTION public.preserve_populated_record_field_contracts()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  old_field jsonb;
  next_field jsonb;
  previous_fields jsonb := '[]'::jsonb;
  next_fields jsonb := COALESCE(NULLIF(NEW.template_fields, 'null'::jsonb), '[]'::jsonb);
  key text;
  target_kind text;
  ids text[] := ARRAY[]::text[];
  names text[] := ARRAY[]::text[];
  can_manage_schema boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.template_fields IS NOT DISTINCT FROM OLD.template_fields THEN RETURN NEW; END IF;
    IF current_setting('transaction_isolation') NOT IN ('read committed', 'read uncommitted') THEN
      RAISE EXCEPTION 'Field template updates require READ COMMITTED' USING ERRCODE = '0A000';
    END IF;
    previous_fields := COALESCE(NULLIF(OLD.template_fields, 'null'::jsonb), '[]'::jsonb);
  END IF;
  IF jsonb_typeof(next_fields) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Template fields must be an array' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(next_fields) > 200 THEN
    RAISE EXCEPTION 'Too many template fields' USING ERRCODE = '23514';
  END IF;
  FOR next_field IN SELECT value FROM jsonb_array_elements(next_fields) LOOP
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

  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  FOR old_field, next_field IN
    SELECT o.value, n.value FROM jsonb_array_elements(previous_fields) o
    FULL JOIN jsonb_array_elements(next_fields) n ON o.value->>'id' = n.value->>'id'
  LOOP
    IF old_field IS NOT NULL AND next_field IS NOT NULL
      AND next_field->>'name' IS DISTINCT FROM old_field->>'name' THEN
      RAISE EXCEPTION 'Existing field storage names are immutable' USING ERRCODE = '23514';
    END IF;
    -- Presentation-only edits do not read records. Record data can be hidden by
    -- RLS or in the trash, but only a conflict (not row details) can be returned.
    IF old_field IS NOT NULL AND next_field IS NOT NULL
      AND old_field->>'type' = next_field->>'type'
      AND old_field->>'relationTarget' IS NOT DISTINCT FROM next_field->>'relationTarget'
      AND old_field->>'targetCategoryId' IS NOT DISTINCT FROM next_field->>'targetCategoryId'
      AND NOT (next_field @> '{"required":true}' AND NOT old_field @> '{"required":true}')
      AND NOT (next_field ? 'min' AND (jsonb_typeof(old_field->'min') IS DISTINCT FROM 'number'
        OR (next_field->>'min')::numeric > (old_field->>'min')::numeric))
      AND NOT (next_field ? 'max' AND (jsonb_typeof(old_field->'max') IS DISTINCT FROM 'number'
        OR (next_field->>'max')::numeric < (old_field->>'max')::numeric))
      AND NOT (next_field ? 'minLength' AND (jsonb_typeof(old_field->'minLength') IS DISTINCT FROM 'number'
        OR (next_field->>'minLength')::numeric > (old_field->>'minLength')::numeric))
      AND NOT (next_field ? 'maxLength' AND (jsonb_typeof(old_field->'maxLength') IS DISTINCT FROM 'number'
        OR (next_field->>'maxLength')::numeric < (old_field->>'maxLength')::numeric))
      AND (next_field->>'type' <> 'select' OR COALESCE(next_field->'options' @> (old_field->'options'), false))
    THEN CONTINUE; END IF;

    -- The outcome of a value-dependent check can reveal information about
    -- hidden rows. Authorize before reading any, independently of their contents.
    IF can_manage_schema IS NULL THEN
      can_manage_schema := auth.uid() IS NOT NULL
        AND COALESCE(public.current_user_site_role(OLD.site_id) IN ('owner', 'admin'), false)
        AND public.current_user_has_site_location_restrictions(OLD.site_id) IS FALSE
        AND public.record_row_access(OLD.site_id, NULL, '{}'::jsonb) IS TRUE;
    END IF;
    IF NOT can_manage_schema THEN
      RAISE EXCEPTION 'Only unrestricted workspace owners or admins can make this field change.' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.records r WHERE r.site_id = OLD.site_id AND r.category_id = OLD.id
      AND public.record_field_edit_conflicts(old_field, next_field, r.data, r.relations, r.status IS NOT DISTINCT FROM 'draft')
    ) THEN
      RAISE EXCEPTION 'Cannot change "%": existing records would lose values or no longer meet the field rules.',
        COALESCE(next_field->>'label', next_field->>'name', old_field->>'label', old_field->>'name') USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.preserve_populated_record_field_contracts() FROM PUBLIC, anon, authenticated;

COMMIT;