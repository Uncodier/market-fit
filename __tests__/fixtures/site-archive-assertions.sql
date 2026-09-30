SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
BEGIN
  BEGIN
    PERFORM public.archive_site('10000000-0000-4000-8000-000000000001', auth.uid());
    RAISE EXCEPTION 'Unexpected direct RPC access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.delete_site_safely('10000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Unexpected legacy delete access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.sites WHERE id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Unexpected direct DELETE access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.sites SET archived_at = now() WHERE id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Unexpected archive-state write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
SET ROLE service_role;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = '';
DO $$
DECLARE
  original_snapshot jsonb;
BEGIN
  BEGIN
    PERFORM public.archive_site('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Unexpected cross-tenant archive';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM public.archive_site('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = '10000000-0000-4000-8000-000000000001' AND archived_at IS NOT NULL AND url IS NULL) THEN
    RAISE EXCEPTION 'Site not archived or URL not released';
  END IF;
  SELECT archive_snapshot INTO original_snapshot FROM public.sites WHERE id = '10000000-0000-4000-8000-000000000001';
  IF original_snapshot->>'url' <> 'https://reusable.example'
    OR original_snapshot->'allowed_domains'->0->>'domain' <> 'reusable.example' THEN
    RAISE EXCEPTION 'Routing snapshot not retained';
  END IF;
  IF EXISTS (SELECT 1 FROM public.allowed_domains WHERE site_id = '10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Domain not released';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.api_keys WHERE id = '30000000-0000-4000-8000-000000000001' AND status = 'revoked') THEN
    RAISE EXCEPTION 'API key not revoked';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.site_business_records WHERE id = 1 AND payload = 'retained history') THEN
    RAISE EXCEPTION 'Business history lost';
  END IF;
  PERFORM public.archive_site('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
  IF original_snapshot IS DISTINCT FROM (SELECT archive_snapshot FROM public.sites WHERE id = '10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Retry overwrote snapshot';
  END IF;
  BEGIN
    INSERT INTO public.allowed_domains VALUES ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'reusable.example');
    RAISE EXCEPTION 'Archived site accepted new domain';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
-- A new site can reuse both its name/slug and URL/domain association.
INSERT INTO public.sites(id, name, url, user_id) VALUES
  ('10000000-0000-4000-8000-000000000003', 'Reusable Shop', 'https://reusable.example', '00000000-0000-4000-8000-000000000001');
INSERT INTO public.allowed_domains VALUES
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'reusable.example');
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sites WHERE id = '10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Archived site still visible through RLS';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_my_accessible_sites() WHERE id = '10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Archived site still listed';
  END IF;
  IF public.current_user_site_role('10000000-0000-4000-8000-000000000001') IS NOT NULL THEN
    RAISE EXCEPTION 'Archived site still grants a role';
  END IF;
END;
$$;
RESET ROLE;
-- A downstream failure must roll back the archive and all routing changes.
CREATE FUNCTION public.fail_fixture_key_revocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'fixture revocation failure' USING ERRCODE = 'P0001';
END;
$$;
CREATE TRIGGER fail_fixture_key_revocation BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.fail_fixture_key_revocation();
INSERT INTO public.api_keys VALUES
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'active', now());
SET ROLE service_role;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = '';
DO $$
BEGIN
  BEGIN
    PERFORM public.archive_site('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Expected atomic archive failure' USING ERRCODE = 'XX000';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = '10000000-0000-4000-8000-000000000002' AND archived_at IS NULL AND url = 'https://other.example' AND archive_snapshot IS NULL) THEN
    RAISE EXCEPTION 'Archive failed to roll back';
  END IF;
END;
$$;
RESET ROLE;
DROP TRIGGER fail_fixture_key_revocation ON public.api_keys;
DROP FUNCTION public.fail_fixture_key_revocation();
SELECT 'Site archive integration assertions passed' AS result;