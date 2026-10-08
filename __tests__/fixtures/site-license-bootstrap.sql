DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid;
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claims',true)::jsonb;
$$;
CREATE TABLE public.sites(id uuid PRIMARY KEY,user_id uuid,archived_at timestamptz);
CREATE TABLE public.site_ownership(site_id uuid PRIMARY KEY REFERENCES sites,user_id uuid,created_at timestamptz DEFAULT now());
CREATE TABLE public.site_members(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid REFERENCES sites,user_id uuid,
  role text CHECK(role IN ('owner','admin','marketing','collaborator')) NOT NULL,
  status text DEFAULT 'pending' CHECK(status IN ('pending','active','rejected')),
  email text,added_by uuid,name text,position text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
  blocked_screens text[] DEFAULT '{}',restrict_to_assigned_only boolean DEFAULT false,
  UNIQUE(site_id,email),UNIQUE(site_id,user_id)
);
CREATE TABLE public.settings(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid UNIQUE REFERENCES sites,
  social_media jsonb DEFAULT '[]',channels jsonb DEFAULT '[]',team_members jsonb DEFAULT '[]',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.partner_licenses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),license_key uuid UNIQUE DEFAULT gen_random_uuid(),
  user_id uuid,status text,site_id uuid REFERENCES sites,plan_name text);
GRANT ALL ON public.partner_licenses TO anon,authenticated,service_role;
ALTER TABLE public.partner_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage all partner licenses" ON public.partner_licenses FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY own_partner_license ON public.partner_licenses FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.billing(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid UNIQUE REFERENCES sites,
  plan text DEFAULT 'commission',addons_count integer DEFAULT 0,credits_available numeric DEFAULT 0,updated_at timestamptz DEFAULT now(),
  stripe_subscription_id text,subscription_status text,auto_renew boolean DEFAULT true
);
GRANT ALL ON public.sites,public.site_ownership,public.site_members,public.settings,public.billing TO authenticated,service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY existing_sites ON public.sites TO authenticated USING(true) WITH CHECK(true);
CREATE FUNCTION public.user_can(p_site_id uuid,p_command text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r text; cmd text;
BEGIN
  r:=public.current_user_site_role(p_site_id); cmd:=lower(coalesce(p_command,''));
  IF r IS NULL THEN RETURN false; END IF;
  IF cmd='select' THEN RETURN true; END IF;
  IF r IN ('owner','admin') THEN RETURN cmd IN ('insert','update','delete'); END IF;
  IF r='collaborator' THEN RETURN cmd IN ('insert','update'); END IF;
  RETURN false;
END; $$;
-- Existing financial guard must remain installed: licenses do not replace it.
CREATE FUNCTION public.guard_billing_credit_buckets() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND (NEW.plan IS DISTINCT FROM OLD.plan
    OR NEW.credits_available IS DISTINCT FROM OLD.credits_available OR NEW.addons_count IS DISTINCT FROM OLD.addons_count) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Protected billing fields';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_billing_credit_buckets BEFORE UPDATE ON billing FOR EACH ROW EXECUTE FUNCTION guard_billing_credit_buckets();
ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_site_access ON public.site_members TO authenticated USING (public.user_can(site_id,'select'))
  WITH CHECK (public.user_can(site_id,'update'));
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_site_access ON public.settings TO authenticated USING (public.user_can(site_id,'select'))
  WITH CHECK (public.user_can(site_id,'update'));