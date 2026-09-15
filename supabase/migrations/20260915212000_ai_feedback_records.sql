ALTER TABLE public.record_categories
  ADD COLUMN IF NOT EXISTS system_key text;

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id text;

CREATE UNIQUE INDEX IF NOT EXISTS record_categories_site_system_key_uidx
  ON public.record_categories (site_id, system_key);

CREATE UNIQUE INDEX IF NOT EXISTS records_site_source_uidx
  ON public.records (site_id, source_type, source_id);
