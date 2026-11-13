import { readFileSync } from "node:fs"
import path from "node:path"

export { disposablePostgres, postgresAvailable } from "../requirements/retirement-postgres"
export const migration = () => readFileSync(path.join(process.cwd(),
  "supabase/migrations/20261113170000_inventory_movements.sql"), "utf8")
export const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
export const ids = {
  owner: uuid(1), restricted: uuid(2), foreign: uuid(3), viewer: uuid(4),
  site: uuid(10), otherSite: uuid(11), source: uuid(20), target: uuid(21),
  hidden: uuid(22), foreignLocation: uuid(23), inactive: uuid(24),
  product: uuid(30), secondProduct: uuid(31), service: uuid(32), foreignProduct: uuid(33),
  bill: uuid(40), cancelled: uuid(41), foreignBill: uuid(42),
}
export const actor = (sql: string, user: string | null = ids.owner, role = "authenticated") => `
  SET ROLE ${role}; SET request.jwt.claim.sub = '${user || ""}'; ${sql}`
export const call = (operations: unknown, request = uuid(100), site = ids.site) =>
  `SELECT public.apply_inventory_operations('${site}', '${request}', '${JSON.stringify(operations).replace(/'/g, "''")}'::jsonb);`
export const transfer = (quantity = 3, overrides = {}) => ({
  kind: "transfer", catalogItemId: ids.product, fromLocationId: ids.source,
  toLocationId: ids.target, quantity, notes: "Move stock", ...overrides,
})
export const adjustment = (quantity = 3, overrides = {}) => ({
  kind: "adjustment", catalogItemId: ids.product, toLocationId: ids.target, quantity, ...overrides,
})
export const receipt = (overrides = {}) => ({
  kind: "receipt", purchaseId: ids.bill, toLocationId: ids.target, ...overrides,
})

// Deliberately separate tenant FKs: forged tenant pairs must be rejected by the RPC.
// Permission fixtures model full access, read-only access, and assigned locations.
export const bootstrap = `
  DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
  CREATE SCHEMA public; CREATE SCHEMA auth;
  GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  CREATE TABLE public.sites (id uuid PRIMARY KEY, user_id uuid);
  CREATE TABLE public.catalog_items (id uuid PRIMARY KEY, site_id uuid REFERENCES public.sites,
    kind text, name text);
  CREATE TABLE public.locations (id uuid PRIMARY KEY, site_id uuid REFERENCES public.sites,
    name text, is_active boolean DEFAULT true);
  CREATE TABLE public.purchases (id uuid PRIMARY KEY, site_id uuid REFERENCES public.sites,
    location_id uuid REFERENCES public.locations, status text, stock_received boolean DEFAULT false,
    updated_at timestamptz DEFAULT now());
  CREATE TABLE public.purchase_items (id uuid PRIMARY KEY, purchase_id uuid REFERENCES public.purchases,
    site_id uuid REFERENCES public.sites, catalog_item_id uuid REFERENCES public.catalog_items, quantity numeric);
  CREATE TABLE public.inventory_levels (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid REFERENCES public.sites, catalog_item_id uuid REFERENCES public.catalog_items,
    location_id uuid REFERENCES public.locations, quantity numeric DEFAULT 0,
    updated_at timestamptz DEFAULT now(), UNIQUE(catalog_item_id,location_id));
  CREATE FUNCTION public.user_can(site uuid, command text) RETURNS boolean
    LANGUAGE sql STABLE AS $$ SELECT
      (site='${ids.site}' AND (auth.uid() IN ('${ids.owner}','${ids.restricted}')
        OR (auth.uid()='${ids.viewer}' AND command='select')))
      OR (site='${ids.otherSite}' AND auth.uid()='${ids.foreign}'); $$;
  CREATE FUNCTION public.user_can_access_location(site uuid, location uuid) RETURNS boolean
    LANGUAGE sql STABLE AS $$ SELECT public.user_can(site,'select') AND
      (auth.uid()<>'${ids.restricted}' OR coalesce(location IN ('${ids.source}','${ids.target}'),false)); $$;
  CREATE FUNCTION public.lock_site_license(site uuid) RETURNS void LANGUAGE plpgsql AS $$
    BEGIN RETURN; END; $$;
  INSERT INTO public.sites VALUES ('${ids.site}','${ids.owner}'), ('${ids.otherSite}','${ids.foreign}');
  INSERT INTO public.catalog_items VALUES
    ('${ids.product}','${ids.site}','product','Widget'),
    ('${ids.secondProduct}','${ids.site}','product','Gadget'),
    ('${ids.service}','${ids.site}','service','Delivery'),
    ('${ids.foreignProduct}','${ids.otherSite}','product','Foreign widget');
  INSERT INTO public.locations (id,site_id,name,is_active) VALUES
    ('${ids.source}','${ids.site}','Warehouse',true),
    ('${ids.target}','${ids.site}','Shop',true),
    ('${ids.hidden}','${ids.site}','Restricted warehouse',true),
    ('${ids.foreignLocation}','${ids.otherSite}','Other shop',true),
    ('${ids.inactive}','${ids.site}','Closed shop',false);
  INSERT INTO public.purchases (id,site_id,location_id,status) VALUES
    ('${ids.bill}','${ids.site}',NULL,'pending'),
    ('${ids.cancelled}','${ids.site}','${ids.source}','cancelled'),
    ('${ids.foreignBill}','${ids.otherSite}','${ids.foreignLocation}','pending');
  INSERT INTO public.purchase_items VALUES
    ('${uuid(50)}','${ids.bill}','${ids.site}','${ids.product}',4),
    ('${uuid(51)}','${ids.bill}','${ids.site}','${ids.product}',2.5),
    ('${uuid(52)}','${ids.bill}','${ids.site}','${ids.secondProduct}',3),
    ('${uuid(53)}','${ids.bill}','${ids.site}','${ids.service}',99),
    ('${uuid(54)}','${ids.cancelled}','${ids.site}','${ids.product}',2),
    ('${uuid(55)}','${ids.foreignBill}','${ids.otherSite}','${ids.foreignProduct}',2);
  INSERT INTO public.inventory_levels (site_id,catalog_item_id,location_id,quantity) VALUES
    ('${ids.site}','${ids.product}','${ids.source}',10),
    ('${ids.site}','${ids.product}','${ids.target}',2);
`