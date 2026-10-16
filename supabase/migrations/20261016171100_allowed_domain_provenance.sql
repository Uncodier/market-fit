BEGIN;
SET LOCAL lock_timeout = '5s';

-- Hostnames (including Vercel previews) are not reliable evidence of who added
-- a domain. Preserve all historical rows as unknown; do not infer a backfill.
ALTER TABLE public.allowed_domains
  ADD COLUMN source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN requirement_id uuid,
  ADD CONSTRAINT allowed_domains_source_check CHECK (source IN ('unknown', 'user', 'harness'));

-- A composite foreign key also protects against concurrent requirement moves.
CREATE UNIQUE INDEX requirements_domain_provenance_id_site_idx
  ON public.requirements (id, site_id);
ALTER TABLE public.allowed_domains
  ADD CONSTRAINT allowed_domains_requirement_site_fkey
  FOREIGN KEY (requirement_id, site_id) REFERENCES public.requirements (id, site_id)
  ON UPDATE NO ACTION ON DELETE SET NULL (requirement_id);
CREATE INDEX allowed_domains_requirement_site_idx
  ON public.allowed_domains (requirement_id, site_id) WHERE requirement_id IS NOT NULL;

CREATE FUNCTION public.guard_allowed_domain_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  claim_role text := auth.role();
  database_role text := current_setting('role', true);
  service_writer boolean;
  deleted_requirement_cleanup boolean := false;
BEGIN
  -- Follow the existing JWT/SQL-role checks. SECURITY DEFINER's current_user
  -- is the function owner, not evidence that the caller is a trusted writer.
  service_writer := (coalesce(claim_role = 'service_role', false)
      OR coalesce(database_role = 'service_role', false))
    AND coalesce(claim_role, '') NOT IN ('anon', 'authenticated')
    AND coalesce(database_role, '') NOT IN ('anon', 'authenticated');

  IF NOT service_writer THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.source = 'harness' OR NEW.requirement_id IS NOT NULL THEN
        RAISE EXCEPTION 'Automatic domain provenance is server managed' USING ERRCODE = '42501';
      END IF;
    ELSE
      -- The browser may edit manual domains, but cannot rewrite their origin.
      -- ON DELETE SET NULL must not block an authorized requirement deletion.
      -- Only permit clearing a reference whose requirement really disappeared,
      -- without changing the domain identity or the recorded source.
      IF OLD.requirement_id IS NOT NULL AND NEW.requirement_id IS NULL
        AND NEW.site_id IS NOT DISTINCT FROM OLD.site_id
        AND NEW.domain IS NOT DISTINCT FROM OLD.domain
        AND NEW.source IS NOT DISTINCT FROM OLD.source THEN
        deleted_requirement_cleanup := NOT EXISTS (
          SELECT 1 FROM public.requirements WHERE id = OLD.requirement_id
        );
      END IF;
      IF NEW.source IS DISTINCT FROM OLD.source
        OR (NEW.requirement_id IS DISTINCT FROM OLD.requirement_id AND NOT deleted_requirement_cleanup)
        OR ((OLD.source = 'harness' OR OLD.requirement_id IS NOT NULL)
          AND (NEW.site_id IS DISTINCT FROM OLD.site_id OR NEW.domain IS DISTINCT FROM OLD.domain)) THEN
        RAISE EXCEPTION 'Automatic domain provenance is server managed' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_allowed_domain_provenance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_allowed_domain_provenance
  BEFORE INSERT OR UPDATE ON public.allowed_domains
  FOR EACH ROW EXECUTE FUNCTION public.guard_allowed_domain_provenance();

-- Existing domain RLS, table grants, uniqueness and archival guards stay intact.
COMMIT;