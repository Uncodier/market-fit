BEGIN;

-- The editor uses updated_at for optimistic concurrency. Derived search data
-- must not invalidate an otherwise current document or advance its list date.
CREATE OR REPLACE FUNCTION public.update_record_document_modified_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  previous public.records%ROWTYPE := OLD;
  candidate public.records%ROWTYPE := NEW;
BEGIN
  -- Exclude only derived fields. Clear the vectors before JSON conversion so
  -- this comparison does not serialize a 1536-element embedding on every edit.
  previous.embedding := NULL;
  candidate.embedding := NULL;
  previous.summary := NULL;
  candidate.summary := NULL;
  previous.updated_at := NULL;
  candidate.updated_at := NULL;

  IF to_jsonb(previous) IS DISTINCT FROM to_jsonb(candidate) THEN
    NEW.updated_at := GREATEST(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_record_document_modified_at() FROM PUBLIC, anon, authenticated;

-- Keep the existing trigger name and order. Refuse an unexpected binding rather
-- than replacing a locally customized trigger with different responsibilities.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.records'::regclass
      AND tgname = 'update_records_modtime'
      AND tgtype = 19
      AND tgenabled = 'O'
      AND NOT tgisinternal
      AND tgqual IS NULL
      AND tgnargs = 0
      AND tgfoid IN ('public.update_modified_column()'::regprocedure,
                    'public.update_record_document_modified_at()'::regprocedure)
  ) THEN
    RAISE EXCEPTION 'Unexpected Records modification timestamp trigger';
  END IF;
END;
$$;

CREATE OR REPLACE TRIGGER update_records_modtime
BEFORE UPDATE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.update_record_document_modified_at();

COMMIT;