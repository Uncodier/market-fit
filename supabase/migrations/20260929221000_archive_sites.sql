BEGIN;

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_snapshot jsonb;

COMMENT ON COLUMN public.sites.archive_snapshot IS
  'Original URL, tracking settings and allowed-domain rows retained when the site is archived.';

CREATE INDEX IF NOT EXISTS sites_active_owner_idx
  ON public.sites (user_id) WHERE archived_at IS NULL;

-- Lifecycle fields cannot be forged or cleared through the Data API, even by
-- the owner. Only the password-verified server operation may archive a site.
CREATE OR REPLACE FUNCTION public.guard_site_archive_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL
         OR NEW.archive_snapshot IS NOT NULL THEN
        RAISE EXCEPTION 'Site archival requires password verification' USING ERRCODE = '42501';
      END IF;
    ELSIF OLD.archived_at IS NOT NULL
       OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
       OR NEW.archived_by IS DISTINCT FROM OLD.archived_by
       OR NEW.archive_snapshot IS DISTINCT FROM OLD.archive_snapshot THEN
      RAISE EXCEPTION 'Site archival requires password verification' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_site_archive_state() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_site_archive_state ON public.sites;
CREATE TRIGGER guard_site_archive_state
  BEFORE INSERT OR UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.guard_site_archive_state();

DROP POLICY IF EXISTS sites_active_only ON public.sites;
CREATE POLICY sites_active_only ON public.sites AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (archived_at IS NULL) WITH CHECK (archived_at IS NULL);

-- Lock the parent during domain writes so a concurrent registration cannot
-- survive the archive transaction or reclaim an archived site's domain mapping.
CREATE OR REPLACE FUNCTION public.guard_archived_site_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM 1 FROM public.sites
    WHERE id = NEW.site_id AND archived_at IS NULL FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active site is required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_archived_site_domain() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_archived_site_domain ON public.allowed_domains;
CREATE TRIGGER guard_archived_site_domain
  BEFORE INSERT OR UPDATE ON public.allowed_domains
  FOR EACH ROW EXECUTE FUNCTION public.guard_archived_site_domain();

CREATE OR REPLACE FUNCTION public.archive_site(p_site_id uuid, p_actor_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  site_row public.sites%ROWTYPE;
  domain_snapshot jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Password-verified server access is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO site_row FROM public.sites WHERE id = p_site_id FOR UPDATE;
  IF NOT FOUND OR site_row.user_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Only the site owner can archive this site' USING ERRCODE = '42501';
  END IF;
  IF site_row.archived_at IS NOT NULL THEN
    RETURN true;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO domain_snapshot
    FROM public.allowed_domains d WHERE d.site_id = p_site_id;

  UPDATE public.sites SET
    archived_at = now(),
    archived_by = p_actor_id,
    archive_snapshot = jsonb_build_object(
      'url', site_row.url,
      'tracking', site_row.tracking,
      'allowed_domains', domain_snapshot
    ),
    url = NULL,
    tracking = coalesce(site_row.tracking, '{}'::jsonb) || jsonb_build_object(
      'track_visitors', false, 'track_actions', false,
      'record_screen', false, 'enable_chat', false
    ),
    updated_at = now()
  WHERE id = p_site_id;

  -- Only routing associations are removed; original rows remain in the snapshot.
  -- Business data, ownership, settings, orders and billing history are retained.
  DELETE FROM public.allowed_domains WHERE site_id = p_site_id;
  UPDATE public.api_keys SET status = 'revoked', updated_at = now()
    WHERE site_id = p_site_id AND status = 'active';
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_site(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_site(uuid, uuid) TO service_role;

-- Retire both the destructive RPC and direct client DELETE. Leaving either
-- available would bypass the archive/password boundary from older clients.
CREATE OR REPLACE FUNCTION public.delete_site_safely(site_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Site deletion is disabled. Archive the site from Settings with password verification.'
    USING ERRCODE = '0A000';
END;
$$;
REVOKE ALL ON FUNCTION public.delete_site_safely(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE DELETE ON public.sites FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_site_role(p_site_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  r text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND archived_at IS NULL) THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.site_ownership WHERE site_id = p_site_id AND user_id = auth.uid()) THEN
    RETURN 'owner';
  END IF;
  SELECT sm.role::text INTO r FROM public.site_members sm
    WHERE sm.site_id = p_site_id AND sm.user_id = auth.uid() AND sm.status = 'active'
    LIMIT 1;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.current_user_site_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_site_role(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_accessible_sites()
RETURNS SETOF public.sites
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT s.* FROM public.sites s
  WHERE s.archived_at IS NULL AND (
    s.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.site_ownership so WHERE so.site_id = s.id AND so.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active')
  );
$$;
REVOKE ALL ON FUNCTION public.get_my_accessible_sites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_accessible_sites() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;