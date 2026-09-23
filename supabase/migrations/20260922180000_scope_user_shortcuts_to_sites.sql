BEGIN;

ALTER TABLE public.user_shortcuts
  ADD COLUMN IF NOT EXISTS site_id uuid;

ALTER TABLE public.user_shortcuts REPLICA IDENTITY FULL;

ALTER TABLE public.user_shortcuts
  DROP CONSTRAINT IF EXISTS user_shortcuts_pkey;

WITH legacy_shortcuts AS MATERIALIZED (
  SELECT user_id, shortcuts, created_at, updated_at
  FROM public.user_shortcuts
  WHERE site_id IS NULL
),
accessible_sites AS (
  SELECT legacy.user_id, sites.id AS site_id
  FROM legacy_shortcuts legacy
  JOIN public.sites sites ON sites.user_id = legacy.user_id

  UNION

  SELECT legacy.user_id, ownership.site_id
  FROM legacy_shortcuts legacy
  JOIN public.site_ownership ownership ON ownership.user_id = legacy.user_id

  UNION

  SELECT legacy.user_id, members.site_id
  FROM legacy_shortcuts legacy
  JOIN public.site_members members ON members.user_id = legacy.user_id
  WHERE members.status = 'active'
)
INSERT INTO public.user_shortcuts (
  user_id,
  site_id,
  shortcuts,
  created_at,
  updated_at
)
SELECT
  legacy.user_id,
  accessible.site_id,
  legacy.shortcuts,
  legacy.created_at,
  legacy.updated_at
FROM legacy_shortcuts legacy
JOIN accessible_sites accessible ON accessible.user_id = legacy.user_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_shortcuts existing
  WHERE existing.user_id = legacy.user_id
    AND existing.site_id = accessible.site_id
);

DELETE FROM public.user_shortcuts
WHERE site_id IS NULL;

ALTER TABLE public.user_shortcuts
  ALTER COLUMN site_id SET NOT NULL;

ALTER TABLE public.user_shortcuts
  DROP CONSTRAINT IF EXISTS user_shortcuts_site_id_fkey;

ALTER TABLE public.user_shortcuts
  ADD CONSTRAINT user_shortcuts_site_id_fkey
  FOREIGN KEY (site_id)
  REFERENCES public.sites(id)
  ON DELETE CASCADE;

ALTER TABLE public.user_shortcuts
  ADD CONSTRAINT user_shortcuts_pkey
  PRIMARY KEY (user_id, site_id);

ALTER TABLE public.user_shortcuts REPLICA IDENTITY DEFAULT;

ALTER TABLE public.user_shortcuts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own shortcuts"
  ON public.user_shortcuts;
DROP POLICY IF EXISTS "Users can insert their own shortcuts"
  ON public.user_shortcuts;
DROP POLICY IF EXISTS "Users can update their own shortcuts"
  ON public.user_shortcuts;

CREATE POLICY "Users can view their site shortcuts"
ON public.user_shortcuts
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND public.current_user_site_role(site_id) IS NOT NULL
);

CREATE POLICY "Users can insert their site shortcuts"
ON public.user_shortcuts
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND public.current_user_site_role(site_id) IS NOT NULL
);

CREATE POLICY "Users can update their site shortcuts"
ON public.user_shortcuts
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND public.current_user_site_role(site_id) IS NOT NULL
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND public.current_user_site_role(site_id) IS NOT NULL
);

REVOKE ALL ON TABLE public.user_shortcuts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_shortcuts TO authenticated;

COMMENT ON COLUMN public.user_shortcuts.site_id IS
  'Site whose per-user navigation shortcut state is stored in this row.';

NOTIFY pgrst, 'reload schema';

COMMIT;
