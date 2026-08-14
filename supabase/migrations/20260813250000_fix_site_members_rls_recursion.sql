-- Re-run this whole file in the SQL editor. It drops every site_members
-- policy that calls current_user_site_role (those recurse and hang SELECT).

DROP POLICY IF EXISTS site_members_insert_owner_admin ON public.site_members;
DROP POLICY IF EXISTS site_members_update_owner_admin ON public.site_members;
DROP POLICY IF EXISTS site_members_delete_owner_admin ON public.site_members;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_members'
      AND (
        coalesce(qual, '') ILIKE '%current_user_site_role%'
        OR coalesce(with_check, '') ILIKE '%current_user_site_role%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.site_members', pol.policyname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.current_user_site_role(p_site_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  SELECT 'owner' INTO r
  FROM public.sites s
  WHERE s.id = p_site_id
    AND s.user_id = auth.uid();

  IF FOUND THEN
    RETURN r;
  END IF;

  SELECT sm.role::text INTO r
  FROM public.site_members sm
  WHERE sm.site_id = p_site_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  LIMIT 1;

  RETURN r;
END;
$$;

SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('site_members', 'sites')
ORDER BY tablename, policyname;
