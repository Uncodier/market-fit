import { archiveMigration, CategoryArchivePostgres, ids, migration } from './category-archive-postgres'

// Focused bootstrap: core catalog tables predate the repository migrations.
// Relevant columns, nullable item status, foreign keys, and member-wide policies
// match read-only schema inspection of rnjgeloamtszdjplmqxy on 2026-10-13.
export function installFixture(pg: CategoryArchivePostgres) {
  pg.db(`DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public; CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA public, auth TO postgres, anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
    CREATE TABLE public.sites (id uuid PRIMARY KEY, user_id uuid, archived_at timestamptz);
    CREATE TABLE public.site_ownership (site_id uuid REFERENCES public.sites, user_id uuid);
    CREATE TABLE public.site_members (site_id uuid REFERENCES public.sites, user_id uuid, role text,
      status text, license_suspended boolean NOT NULL DEFAULT false);
    CREATE TABLE public.catalog_categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid NOT NULL REFERENCES public.sites ON DELETE CASCADE, name text NOT NULL DEFAULT 'Category',
      description text, income_account_key text, updated_at timestamptz NOT NULL DEFAULT '2020-01-01');
    CREATE TABLE public.catalog_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid NOT NULL REFERENCES public.sites ON DELETE CASCADE,
      category_id uuid REFERENCES public.catalog_categories, parent_id uuid REFERENCES public.catalog_items ON DELETE CASCADE,
      status text DEFAULT 'active' CHECK (status IN ('active', 'archived')), name text NOT NULL DEFAULT 'Item',
      is_marketplace_listed boolean DEFAULT false, updated_at timestamptz NOT NULL DEFAULT '2020-01-01');
    CREATE TABLE public.pass_redeemable_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid NOT NULL REFERENCES public.sites ON DELETE CASCADE,
      pass_catalog_item_id uuid NOT NULL REFERENCES public.catalog_items ON DELETE CASCADE,
      reservable_catalog_item_id uuid NOT NULL REFERENCES public.catalog_items ON DELETE CASCADE,
      sort_order integer NOT NULL DEFAULT 0,
      UNIQUE (pass_catalog_item_id, reservable_catalog_item_id));
    CREATE TABLE public.journal_lines (id integer PRIMARY KEY, catalog_category_id uuid REFERENCES public.catalog_categories ON DELETE SET NULL, amount numeric);
    CREATE TABLE public.transactions (id integer PRIMARY KEY, catalog_category_id uuid REFERENCES public.catalog_categories ON DELETE SET NULL, amount numeric);
    CREATE TABLE public.promotion_catalog_categories (id integer PRIMARY KEY, catalog_category_id uuid REFERENCES public.catalog_categories ON DELETE CASCADE);
    CREATE TABLE public.promotion_required_categories (id integer PRIMARY KEY, catalog_category_id uuid REFERENCES public.catalog_categories ON DELETE CASCADE);
    CREATE TABLE public.sale_order_items (id integer PRIMARY KEY, catalog_item_id uuid REFERENCES public.catalog_items, amount numeric);
    GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
    GRANT SELECT ON public.sites, public.site_members, public.site_ownership TO anon, authenticated;
    GRANT ALL ON public.catalog_categories, public.catalog_items, public.pass_redeemable_items TO anon, authenticated, service_role;
    ${['catalog_categories', 'catalog_items', 'pass_redeemable_items'].map(table => `
      ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY ${table}_unified ON public.${table} FOR ALL USING (
        current_setting('role',true)='service_role' OR auth.jwt()->>'role'='service_role' OR EXISTS (
          SELECT 1 FROM public.sites s WHERE s.id=${table}.site_id AND (s.user_id=auth.uid() OR EXISTS (
            SELECT 1 FROM public.site_members sm WHERE sm.site_id=s.id AND sm.user_id=auth.uid()))));`).join('\n')}
    CREATE POLICY catalog_items_marketplace_read ON public.catalog_items FOR SELECT
      USING (is_marketplace_listed = true AND status = 'active');
    INSERT INTO public.sites VALUES ('${ids.site}','${ids.owner}',NULL), ('${ids.otherSite}','${ids.foreign}',NULL);
    INSERT INTO public.site_ownership VALUES ('${ids.site}','${ids.coOwner}');
    INSERT INTO public.site_members VALUES
      ('${ids.site}','${ids.admin}','admin','active',false),
      ('${ids.site}','${ids.member}','collaborator','active',false),
      ('${ids.site}','${ids.marketing}','marketing','active',false),
      ('${ids.site}','${ids.inactive}','admin','inactive',false),
      ('${ids.site}','${ids.suspended}','admin','active',true),
      ('${ids.site}','${ids.coOwner}','collaborator','active',false);
    INSERT INTO public.catalog_categories(id,site_id) VALUES
      ('${ids.category}','${ids.site}'), ('${ids.otherCategory}','${ids.site}'),
      ('${ids.emptyCategory}','${ids.site}'), ('${ids.foreignCategory}','${ids.otherSite}');
    INSERT INTO public.catalog_items(id,site_id,category_id,parent_id,status) VALUES
      ('${ids.root}','${ids.site}','${ids.category}',NULL,'active'),
      ('${ids.child}','${ids.site}','${ids.otherCategory}','${ids.root}','active'),
      ('${ids.grandchild}','${ids.site}',NULL,'${ids.child}','active'),
      ('${ids.archived}','${ids.site}','${ids.category}',NULL,'archived'),
      ('${ids.nullStatus}','${ids.site}','${ids.category}',NULL,NULL),
      ('${ids.unrelated}','${ids.site}','${ids.otherCategory}',NULL,'active'),
      ('${ids.foreignItem}','${ids.otherSite}','${ids.foreignCategory}','${ids.root}','active'),
      ('${ids.pass}','${ids.site}',NULL,NULL,'active'),
      ('${ids.legacyChild}','${ids.site}',NULL,'${ids.archived}','active');
    INSERT INTO public.pass_redeemable_items(site_id,pass_catalog_item_id,reservable_catalog_item_id) VALUES
      ('${ids.site}','${ids.pass}','${ids.root}'), ('${ids.site}','${ids.pass}','${ids.grandchild}'),
      ('${ids.site}','${ids.pass}','${ids.archived}'), ('${ids.site}','${ids.root}','${ids.unrelated}'),
      ('${ids.otherSite}','${ids.foreignItem}','${ids.child}');
    INSERT INTO public.journal_lines VALUES (1,'${ids.category}',123);
    INSERT INTO public.transactions VALUES (1,'${ids.category}',456);
    INSERT INTO public.promotion_catalog_categories VALUES (1,'${ids.category}');
    INSERT INTO public.promotion_required_categories VALUES (1,'${ids.category}');
    INSERT INTO public.sale_order_items VALUES (1,'${ids.root}',789);`)
  const source = migration('20261007220000_site_license_enforcement.sql')
  pg.db(source.slice(source.indexOf('CREATE OR REPLACE FUNCTION public.current_user_site_role(')).split('$$;')[0] + '$$;')
  pg.db('ALTER FUNCTION public.current_user_site_role(uuid) OWNER TO postgres;')
  pg.db(archiveMigration())
  // Match the deployed non-superuser definer owner, not the test bootstrap owner.
  pg.db(`DO $$ DECLARE f record; BEGIN
    FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', f.signature);
    END LOOP;
  END $$;`)
}