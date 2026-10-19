CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_setting('request.jwt.claims',true)::jsonb->>'role');
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.role() TO PUBLIC;
CREATE TABLE public.sites(id uuid PRIMARY KEY, name text, user_id uuid, archived_at timestamptz);
CREATE TABLE public.site_ownership(site_id uuid, user_id uuid);
CREATE TABLE public.site_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid REFERENCES sites(id), user_id uuid,
  status text DEFAULT 'pending', role text, email text, name text, position text,created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid UNIQUE REFERENCES sites(id),social_media jsonb DEFAULT '[]',
  channels jsonb DEFAULT '{}',team_members jsonb DEFAULT '[]',updated_at timestamptz DEFAULT now());
CREATE TABLE public.partner_licenses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),license_key uuid UNIQUE DEFAULT gen_random_uuid(),user_id uuid,site_id uuid,status text,plan_name text);
ALTER TABLE public.partner_licenses ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.user_can(p_site_id uuid,p_command text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r text; BEGIN r:=public.current_user_site_role(p_site_id); RETURN r IS NOT NULL AND (p_command='select' OR r IN ('owner','admin')); END; $$;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY existing_sites ON public.sites TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY existing_members ON public.site_members TO authenticated USING(public.user_can(site_id,'select')) WITH CHECK(public.user_can(site_id,'update'));
CREATE POLICY existing_settings ON public.settings TO authenticated USING(public.user_can(site_id,'select')) WITH CHECK(public.user_can(site_id,'update'));

CREATE TABLE public.billing(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid REFERENCES sites(id),
  -- Match the legacy production typmods; unbounded fixtures hid fractional failures.
  plan varchar DEFAULT 'free', credits_available numeric(10,4) DEFAULT 0, credits_used numeric(10,4) DEFAULT 0,
  account_balance numeric DEFAULT 0, status varchar DEFAULT 'active', addons_count integer DEFAULT 0,
  subscription_status text, stripe_customer_id text, stripe_subscription_id text, auto_renew boolean DEFAULT true,
  subscription_current_period_end timestamptz, subscription_start_date timestamptz,subscription_end_date timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.payments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid REFERENCES sites(id),
  transaction_id varchar UNIQUE, transaction_type varchar, amount numeric(10,2), currency text,
  status varchar, payment_method varchar, credits integer, details jsonb,
  invoice_url text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.credit_transactions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid REFERENCES sites(id),
  amount numeric(10,4), transaction_type varchar, description text, metadata jsonb,created_at timestamptz DEFAULT now()
);
CREATE TABLE public.stripe_subscription_invoice_settlements(
  invoice_id text PRIMARY KEY, site_id uuid REFERENCES sites(id),payment_id uuid UNIQUE REFERENCES payments(id),
  customer_id text,subscription_id text,amount numeric,currency text,credits_granted integer,event_id text,settled_at timestamptz DEFAULT now()
);
GRANT ALL ON public.sites,public.site_members,public.settings,public.billing TO authenticated,service_role;
CREATE TABLE public.harness_sessions(id uuid PRIMARY KEY);
CREATE TABLE public.requirements(id uuid PRIMARY KEY,site_id uuid);
