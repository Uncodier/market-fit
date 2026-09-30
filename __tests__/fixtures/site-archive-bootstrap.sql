-- Minimal isolated fixture, not a replacement for the production schema.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claim.role', true);
$$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.sites (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  url text,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tracking jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.site_ownership (site_id uuid REFERENCES public.sites(id), user_id uuid);
CREATE TABLE public.site_members (site_id uuid REFERENCES public.sites(id), user_id uuid, role text, status text);
CREATE TABLE public.allowed_domains (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  domain text NOT NULL,
  UNIQUE (site_id, domain)
);
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY,
  site_id uuid REFERENCES public.sites(id),
  status text,
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.site_business_records (id integer PRIMARY KEY, site_id uuid REFERENCES public.sites(id), payload text);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON public.sites TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;

INSERT INTO auth.users VALUES
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
INSERT INTO public.sites(id, name, url, user_id, tracking) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Reusable Shop', 'https://reusable.example', '00000000-0000-4000-8000-000000000001', '{"enable_chat":true,"track_visitors":true}'),
  ('10000000-0000-4000-8000-000000000002', 'Other Shop', 'https://other.example', '00000000-0000-4000-8000-000000000002', '{}');
INSERT INTO public.site_ownership VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
INSERT INTO public.site_members VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'admin', 'active');
INSERT INTO public.allowed_domains VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'reusable.example');
INSERT INTO public.api_keys VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'active', now());
INSERT INTO public.site_business_records VALUES (1, '10000000-0000-4000-8000-000000000001', 'retained history');