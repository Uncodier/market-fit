-- Default site language for outbound documents (quotes, emails, PDFs)

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS default_locale text NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'settings_default_locale_check'
  ) THEN
    ALTER TABLE public.settings
      ADD CONSTRAINT settings_default_locale_check
      CHECK (default_locale IN ('en', 'es', 'fr', 'de', 'ja'));
  END IF;
END $$;
