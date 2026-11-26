BEGIN;

ALTER TABLE public.record_categories
  ADD COLUMN primary_date_field_id text,
  ADD CONSTRAINT record_categories_primary_date_field_check CHECK (
    primary_date_field_id IS NULL OR (
      char_length(primary_date_field_id) BETWEEN 1 AND 240
      AND btrim(primary_date_field_id) <> ''
      AND COALESCE(template_fields @> jsonb_build_array(
        jsonb_build_object('id', primary_date_field_id, 'type', 'date')
      ), false)
    )
  );

GRANT INSERT (primary_date_field_id), UPDATE (primary_date_field_id)
  ON public.record_categories TO authenticated;

COMMIT;