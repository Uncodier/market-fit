-- Restore the feedback record keys from 20260915212000_ai_feedback_records
-- in environments where that migration is present in the repository but the
-- columns or unique indexes were not installed. Robots and Chat can save a
-- rating without a reference record when these keys are missing.
BEGIN;

ALTER TABLE public.record_categories
  ADD COLUMN IF NOT EXISTS system_key text;

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id text;

CREATE UNIQUE INDEX IF NOT EXISTS record_categories_site_system_key_uidx
  ON public.record_categories (site_id, system_key);

CREATE UNIQUE INDEX IF NOT EXISTS records_site_source_uidx
  ON public.records (site_id, source_type, source_id);

COMMENT ON COLUMN public.record_categories.system_key IS
  'Stable per-site category key used to upsert the AI Feedback category.';
COMMENT ON COLUMN public.records.source_type IS
  'Origin of a rated AI response (robots or chat); paired with source_id for feedback record upserts.';
COMMENT ON COLUMN public.records.source_id IS
  'Originating log or command identifier; unique with site_id and source_type for feedback record upserts.';

COMMIT;