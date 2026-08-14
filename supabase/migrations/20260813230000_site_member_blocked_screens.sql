-- Per-member screen blocklist (nav keys from NAVIGATION_AREAS).
-- Empty array = no extra restrictions. Admins/owners ignore this column in app code.

ALTER TABLE public.site_members
  ADD COLUMN IF NOT EXISTS blocked_screens text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.site_members.blocked_screens IS
  'Navigation item keys the member cannot open. Empty means all screens. Ignored for owner/admin.';
