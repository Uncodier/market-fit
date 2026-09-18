-- The composite tenant-aware FK supersedes the legacy category-only FK.
-- Keeping both makes PostgREST unable to infer record category embeds.

ALTER TABLE public.records
  DROP CONSTRAINT IF EXISTS records_category_id_fkey;

NOTIFY pgrst, 'reload schema';
