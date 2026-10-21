BEGIN;
SET LOCAL lock_timeout = '5s';

-- Scope is actor-derived, never supplied by a screen, cache key, or client site.
-- Retained exclusions on disabled members still close unscoped/private paths.
CREATE FUNCTION public.current_user_has_site_location_restrictions(p_site_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(public.current_user_site_role(p_site_id), '') NOT IN ('owner','admin')
    AND EXISTS (
      SELECT 1 FROM public.site_members m
      JOIN public.site_member_location_restrictions r
        ON r.site_id = m.site_id AND r.site_member_id = m.id
      WHERE m.site_id = p_site_id AND m.user_id = auth.uid()
    );
$$;
CREATE FUNCTION public.current_user_has_location_restrictions()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.site_members m
    JOIN public.site_member_location_restrictions r
      ON r.site_id = m.site_id AND r.site_member_id = m.id
    WHERE m.user_id = auth.uid()
      AND coalesce(public.current_user_site_role(m.site_id), '') NOT IN ('owner','admin')
  );
$$;
REVOKE ALL ON FUNCTION public.current_user_has_site_location_restrictions(uuid),
  public.current_user_has_location_restrictions() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_has_site_location_restrictions(uuid),
  public.current_user_has_location_restrictions() TO authenticated;
-- Owner views may call this predicate for anon/service, where it must add no ACL
-- denial. Actor identity, not a caller-supplied tenant, remains authoritative.
GRANT EXECUTE ON FUNCTION public.current_user_has_location_restrictions() TO anon,service_role;

-- Fail on drift. Existing roots are deliberately not guessed/backfilled from
-- creators, JSON metadata, fulfillment origins, or a site's default location.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['deals','quotations','subscriptions','tasks',
    'conversations','records','sale_orders'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN location_id uuid', t);
    EXECUTE format('COMMENT ON COLUMN public.%I.location_id IS %L', t,
      'Canonical operating/commercial branch. NULL is unresolved, not shared.');
  END LOOP;
  ALTER TABLE public.reservations ADD COLUMN operating_location_id uuid;
END;
$$;

-- A reviewed registry is database-owner metadata, not a callable authorization
-- escape hatch. Later migrations compile its relations into restrictive policies.
CREATE SCHEMA location_acl_private;
REVOKE ALL ON SCHEMA location_acl_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE location_acl_private.roots (
  table_name text PRIMARY KEY,
  location_column text NOT NULL
);
CREATE TABLE location_acl_private.links (
  child_table text NOT NULL,
  child_column text NOT NULL,
  parent_table text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  same_location boolean NOT NULL DEFAULT false,
  PRIMARY KEY(child_table, child_column)
);
REVOKE ALL ON ALL TABLES IN SCHEMA location_acl_private FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO location_acl_private.roots VALUES
  ('locations','id'),('deals','location_id'),('quotations','location_id'),
  ('subscriptions','location_id'),('tasks','location_id'),('conversations','location_id'),
  ('records','location_id'),('sale_orders','location_id'),('reservations','operating_location_id'),
  ('sales','location_id'),('purchases','location_id'),('transactions','location_id'),
  ('inventory_levels','location_id'),('pos_register_sessions','location_id'),
  ('shipments','origin_location_id');

-- NOT VALID preserves unresolved/inconsistent historical rows without blessing
-- them: predicates reject those rows for restricted actors; all new writes and
-- key changes must satisfy tenant integrity. Never cascade-delete exclusions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM location_acl_private.roots WHERE table_name <> 'locations' LOOP
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT location_acl_scope_requires_site
      CHECK (%I IS NULL OR site_id IS NOT NULL) NOT VALID',r.table_name,r.location_column);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT location_acl_location_site_fk
      FOREIGN KEY(site_id,%I) REFERENCES public.locations(site_id,id) ON DELETE RESTRICT NOT VALID',
      r.table_name, r.location_column);
    EXECUTE format('CREATE INDEX location_acl_%I ON public.%I(site_id,%I)',
      r.table_name, r.table_name, r.location_column);
  END LOOP;
END;
$$;

-- Stock identity is tenant-owned too; an allowed warehouse cannot be used to
-- read or mutate another site's catalog item through a forged stock row.
CREATE UNIQUE INDEX location_acl_catalog_item_site_key ON public.catalog_items(site_id,id);
ALTER TABLE public.inventory_levels ADD CONSTRAINT location_acl_catalog_item_site_fk
  FOREIGN KEY(site_id,catalog_item_id) REFERENCES public.catalog_items(site_id,id) NOT VALID;
COMMIT;