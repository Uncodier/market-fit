-- Optional visit ID document capture (require_id setting + id_url)

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS id_url text;

-- Merge require_id into existing visits settings bags (default off)
UPDATE public.settings
SET visits = COALESCE(visits, '{}'::jsonb) || '{"require_id": false}'::jsonb
WHERE visits IS NULL OR NOT (visits ? 'require_id');

ALTER TABLE public.settings
  ALTER COLUMN visits SET DEFAULT '{
    "enabled_physical": true,
    "enabled_online": true,
    "require_signature": true,
    "require_photo": true,
    "require_id": false,
    "terms_text": "",
    "default_duration_minutes": 60
  }'::jsonb;
