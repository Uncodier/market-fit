-- Schema-only fixture based on native database types and historical migrations.
-- No network, credentials, provider customers, or production data.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE TABLE public.sites(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users,archived_at timestamptz);
CREATE TABLE public.site_members(site_id uuid REFERENCES public.sites,user_id uuid REFERENCES auth.users,
  role text,status text,license_suspended boolean DEFAULT false,restrict_to_assigned_only boolean DEFAULT false);
CREATE TABLE public.site_ownership(site_id uuid,user_id uuid);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users);
CREATE TABLE public.leads(id uuid PRIMARY KEY,site_id uuid);
CREATE TABLE public.locations(id uuid PRIMARY KEY,site_id uuid REFERENCES public.sites,is_active boolean DEFAULT true);
CREATE TABLE public.catalog_items(id uuid PRIMARY KEY,site_id uuid,sku text);
CREATE TABLE public.site_secrets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid NOT NULL REFERENCES public.sites,
  instance_id uuid,name text NOT NULL,provider text,use_case text,encrypted_value text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.sales(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid NOT NULL REFERENCES public.sites,
  user_id uuid NOT NULL REFERENCES auth.users,lead_id uuid REFERENCES public.leads,title text NOT NULL,product_name text,
  product_details jsonb,amount numeric NOT NULL,amount_due numeric DEFAULT 0,currency text DEFAULT 'USD',
  status text NOT NULL CHECK(status IN ('pending','completed','cancelled','refunded')),
  source text CHECK(source IN ('retail','online','quote','marketplace','pos')),payment_method text,payment_details jsonb,
  sale_date timestamptz NOT NULL DEFAULT now(),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.sale_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sale_id uuid NOT NULL REFERENCES public.sales,
  site_id uuid NOT NULL REFERENCES public.sites,user_id uuid NOT NULL REFERENCES auth.users,order_number text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',subtotal numeric NOT NULL DEFAULT 0,tax_total numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,total numeric NOT NULL DEFAULT 0,currency text DEFAULT 'USD',
  status text CHECK(status IN ('draft','pending','in_progress','completed','cancelled')),notes text,
  origin_location_id uuid REFERENCES public.locations,
  fulfillment_method text CHECK(fulfillment_method IN ('pickup','ship','dine_in','none')),shipping_address jsonb,
  shipping_cost numeric DEFAULT 0,scheduled_for timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.shipments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid NOT NULL REFERENCES public.sites,
  sale_order_id uuid REFERENCES public.sale_orders,sale_id uuid REFERENCES public.sales,lead_id uuid REFERENCES public.leads,
  origin_location_id uuid NOT NULL REFERENCES public.locations,status text DEFAULT 'pending'
    CHECK(status IN ('pending','preparing','shipped','in_transit','delivered','cancelled','failed')),
  carrier text,tracking_number text,shipping_address jsonb,stock_decremented boolean NOT NULL DEFAULT false,
  estimated_delivery_at timestamptz,shipped_at timestamptz,delivered_at timestamptz,notes text,
  user_id uuid NOT NULL REFERENCES auth.users,assigned_to uuid REFERENCES public.profiles,
  last_lat numeric,last_lng numeric,last_located_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.sale_order_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sale_order_id uuid NOT NULL REFERENCES public.sale_orders,
  site_id uuid NOT NULL REFERENCES public.sites,catalog_item_id uuid REFERENCES public.catalog_items,
  location_id uuid REFERENCES public.locations,name text NOT NULL,description text,quantity numeric NOT NULL,
  unit_price numeric NOT NULL,subtotal numeric NOT NULL,status text DEFAULT 'draft',metadata jsonb DEFAULT '{}',
  shipment_id uuid REFERENCES public.shipments,parent_sale_order_item_id uuid REFERENCES public.sale_order_items ON DELETE CASCADE,
  sent_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE public.shipment_location_pings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid,
  shipment_id uuid REFERENCES public.shipments,user_id uuid,lat numeric,lng numeric,recorded_at timestamptz DEFAULT now());

-- Intentionally permissive legacy grants/policies: new ownership triggers and
-- restrictive secret policy must still close direct and definer-RPC bypasses.
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
ALTER TABLE public.site_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy_native_secret ON public.site_secrets FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY legacy_anon_secret ON public.site_secrets FOR SELECT TO anon USING(true);

CREATE FUNCTION public.prevent_cancelled_order_reopen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN RAISE EXCEPTION 'Cannot reopen a cancelled order'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER prevent_cancelled_order_reopen BEFORE UPDATE ON public.sale_orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cancelled_order_reopen();
-- Native permission guard analogue: the database owns privileged execution, but
-- browser callers must have canonical command permission. Deliberately retain
-- the legacy definer/superuser bypass; new marketplace guard cannot depend on it.
CREATE FUNCTION public.check_create_update_permission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF current_setting('role',true) = 'service_role' OR current_user = 'postgres' THEN RETURN NEW; END IF;
  IF NOT public.user_can(NEW.site_id,CASE WHEN TG_OP = 'INSERT' THEN 'insert' ELSE 'update' END) THEN
    RAISE EXCEPTION 'Native command permission required' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER native_sales_permission BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.check_create_update_permission();
-- Keep an accounting-style child-change freshness guard active in every test.
CREATE FUNCTION public.test_accounting_freshness() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.sales WHERE id = NEW.sale_id AND status = 'completed') THEN
    RAISE EXCEPTION 'Posted sale source cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER test_accounting_freshness BEFORE UPDATE ON public.sale_orders
  FOR EACH ROW EXECUTE FUNCTION public.test_accounting_freshness();