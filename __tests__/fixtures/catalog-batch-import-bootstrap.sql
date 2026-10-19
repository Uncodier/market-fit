-- Disposable LOCAL PostgreSQL only. Core tables predate checked-in migrations.
-- Run with psql -X -v ON_ERROR_STOP=1, never against a configured database URL.
-- Roles are supplied by the existing CategoryArchivePostgres test harness.
DROP SCHEMA public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public, auth TO postgres, anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;
CREATE TABLE public.sites (id uuid PRIMARY KEY, user_id uuid, archived_at timestamptz);
CREATE TABLE public.site_ownership (site_id uuid REFERENCES public.sites, user_id uuid);
CREATE TABLE public.site_members (site_id uuid REFERENCES public.sites, user_id uuid,
  role text, status text, license_suspended boolean NOT NULL DEFAULT false);
CREATE TABLE public.remote_instances (id uuid PRIMARY KEY, site_id uuid REFERENCES public.sites);
CREATE TABLE public.catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites,
  name text NOT NULL, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites,
  kind text NOT NULL, name text NOT NULL, sku text, description text, image_url text, currency text,
  cost numeric, lowest_sale_price numeric, target_sale_price numeric,
  sort_order integer NOT NULL DEFAULT 0,
  category_id uuid REFERENCES public.catalog_categories,
  parent_id uuid REFERENCES public.catalog_items, status text DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  availability_status text NOT NULL DEFAULT 'available', is_purchasable boolean DEFAULT true,
  is_marketplace_listed boolean DEFAULT false, is_pos_available boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_catalog_items_site_sku ON public.catalog_items(site_id, sku) WHERE sku IS NOT NULL;
CREATE TABLE public.pass_redeemable_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites,
  pass_catalog_item_id uuid NOT NULL REFERENCES public.catalog_items,
  reservable_catalog_item_id uuid NOT NULL REFERENCES public.catalog_items, sort_order integer DEFAULT 0
);
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT SELECT ON public.sites, public.site_ownership, public.site_members TO anon, authenticated, service_role;
GRANT ALL ON public.catalog_items, public.catalog_categories, public.pass_redeemable_items
  TO anon, authenticated, service_role;
-- Preserve the deployed permissive catalog policy instead of strengthening the
-- fixture to hide a missing explicit RPC capability check.
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_items_unified ON public.catalog_items FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.jwt()->>'role' = 'service_role'
  OR EXISTS (SELECT 1 FROM public.sites s WHERE s.id = catalog_items.site_id
    AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.site_members sm
      WHERE sm.site_id = s.id AND sm.user_id = auth.uid())))
);
CREATE POLICY catalog_categories_unified ON public.catalog_categories FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.jwt()->>'role' = 'service_role'
  OR EXISTS (SELECT 1 FROM public.sites s WHERE s.id = catalog_categories.site_id
    AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.site_members sm
      WHERE sm.site_id = s.id AND sm.user_id = auth.uid())))
);
\ir ../../supabase/migrations/20260825160000_fix_site_role_and_delete_caps.sql
-- Exact suspension-aware role body from 20261007220000_site_license_enforcement.sql.
CREATE OR REPLACE FUNCTION public.current_user_site_role(p_site_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE member_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND archived_at IS NULL) THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND user_id = auth.uid()) THEN RETURN 'owner'; END IF;
  SELECT sm.role::text INTO member_role FROM public.site_members sm
    WHERE sm.site_id = p_site_id AND sm.user_id = auth.uid() AND sm.status = 'active' AND NOT sm.license_suspended LIMIT 1;
  IF member_role IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.site_ownership WHERE site_id = p_site_id AND user_id = auth.uid()) THEN RETURN 'owner'; END IF;
  RETURN member_role;
END;
$$;
\ir ../../supabase/migrations/20261012190000_catalog_category_archival.sql
INSERT INTO public.sites VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', NULL),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000016', NULL),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000010', now());
INSERT INTO public.site_members VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'admin', 'active', false),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'collaborator', 'active', false),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000013', 'marketing', 'active', false),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000014', 'admin', 'inactive', false),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000015', 'admin', 'active', true);
INSERT INTO public.catalog_categories(id, site_id, name) VALUES
  ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001', 'Existing'),
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001', 'Ambiguous'),
  ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001', 'Ambiguous'),
  ('00000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000002', 'ForeignOnly'),
  ('00000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000001', 'Archived');
SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000010","role":"authenticated"}';
UPDATE public.catalog_categories SET status = 'archived' WHERE name = 'Archived';
INSERT INTO public.catalog_items(id, site_id, sku, kind, name, description, currency, cost,
  lowest_sale_price, target_sale_price, image_url, category_id, status,
  availability_status, is_purchasable, is_marketplace_listed, is_pos_available) VALUES
  ('00000000-0000-4000-8000-000000000030', '00000000-0000-4000-8000-000000000001', 'OLD',
    'product', 'Original', 'Keep description', 'EUR', 1, 2, 3, 'https://images.example.test/keep.png',
    '00000000-0000-4000-8000-000000000020', 'archived', 'unavailable', false, true, true),
  ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000002', 'FOREIGN',
    'product', 'Foreign original', NULL, 'USD', NULL, NULL, NULL, NULL, NULL, 'active', 'available', true, false, false);
INSERT INTO public.catalog_items(site_id, sku, kind, name, parent_id, status) VALUES
  ('00000000-0000-4000-8000-000000000001', 'SERVICE', 'service', 'Keep service', NULL, 'active'),
  ('00000000-0000-4000-8000-000000000001', 'VARIANT', 'product', 'Keep variant', '00000000-0000-4000-8000-000000000030', 'archived');
\ir ../../supabase/migrations/20261019230000_catalog_batch_import.sql
-- Match deployed non-superuser definer owner instead of running as test superuser.
ALTER TABLE public.catalog_import_batches OWNER TO postgres;
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', f.signature);
  END LOOP;
END $$;
RESET request.jwt.claims;