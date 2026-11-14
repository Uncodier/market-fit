import { readFileSync } from "node:fs"
import path from "node:path"

export { disposablePostgres, postgresAvailable } from "../requirements/retirement-postgres"

export const migration = () => readFileSync(path.join(process.cwd(),
  "supabase/migrations/20261113160000_instance_ownership_rls.sql"), "utf8")
export const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
export const ids = {
  owner: uuid(1), coowner: uuid(2), member: uuid(3), unrestricted: uuid(4),
  nullable: uuid(5), inactive: uuid(6), viewer: uuid(7), foreign: uuid(8), admin: uuid(9),
  site: uuid(10), otherSite: uuid(11), own: uuid(20), created: uuid(21),
  hidden: uuid(22), crossSite: uuid(23), blocked: uuid(24), viewerInstance: uuid(25),
}
export const coreChildren = [
  "instance_logs", "instance_artifacts", "instance_context_memories", "instance_context_state",
  "instance_nodes", "instance_pending_work", "instance_plans",
] as const
export const optionalChildren = [
  "assets", "workflow_runs", "workflow_triggers", "cloud_files", "cloud_file_operations",
  "requirement_status", "remote_sessions", "automation_auth_sessions", "site_secrets",
] as const

export const actor = (userId: string | null, sql: string, role = "authenticated") => `
  SET ROLE ${role};
  SET request.jwt.claim.sub = '${userId || ""}';
  SET request.jwt.claim.role = '${role}';
  SET request.jwt.claims = '${JSON.stringify({ sub: userId, role })}';
  ${sql}`

// Deliberately permissive legacy access makes each new restrictive guard observable.
// No composite FK masks forged site/instance pairs: the policies must reject them.
export const legacyPolicies = (table: string) => `
  ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, anon, service_role;
  CREATE POLICY legacy_allow ON public.${table} USING (true) WITH CHECK (true);
  CREATE POLICY legacy_guard ON public.${table} AS RESTRICTIVE
    USING (NOT blocked) WITH CHECK (NOT blocked);`

export const childSchema = (tables: readonly string[]) => tables.map(table => `
  CREATE TABLE public.${table} (
    id uuid PRIMARY KEY, site_id uuid NOT NULL, instance_id uuid,
    payload text DEFAULT 'original', blocked boolean NOT NULL DEFAULT false
  );
  ${legacyPolicies(table)}
`).join("\n")

export const childSeed = (table: string) => `
  INSERT INTO public.${table} (id, site_id, instance_id, blocked) VALUES
    ('${uuid(100)}', '${ids.site}', '${ids.own}', false),
    ('${uuid(101)}', '${ids.site}', '${ids.created}', false),
    ('${uuid(102)}', '${ids.site}', '${ids.hidden}', false),
    ('${uuid(103)}', '${ids.site}', '${ids.crossSite}', false),
    ('${uuid(104)}', '${ids.otherSite}', '${ids.own}', false),
    ('${uuid(105)}', '${ids.site}', NULL, false),
    ('${uuid(106)}', '${ids.site}', '${ids.blocked}', false),
    ('${uuid(107)}', '${ids.site}', '${ids.own}', true);`

export const bootstrap = `
  DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
  CREATE SCHEMA public; CREATE SCHEMA auth;
  GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.role', true), '');
  $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  $$;
  CREATE TABLE public.sites (id uuid PRIMARY KEY, user_id uuid NOT NULL);
  CREATE TABLE public.site_ownership (site_id uuid, user_id uuid);
  CREATE TABLE public.site_members (
    site_id uuid, user_id uuid, role text, status text, restrict_to_assigned_only boolean,
    PRIMARY KEY (site_id, user_id)
  );
  CREATE FUNCTION public.user_can(p_site uuid, operation text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = p_site AND (
      s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.site_ownership o
        WHERE o.site_id = s.id AND o.user_id = auth.uid()) OR EXISTS (
        SELECT 1 FROM public.site_members m WHERE m.site_id = s.id AND m.user_id = auth.uid()
          AND m.status = 'active' AND (m.role = 'admin'
            OR (m.role = 'collaborator' AND operation IN ('select', 'insert', 'update'))
            OR (m.role = 'marketing' AND operation = 'select'))
      )));
  $$;
  CREATE TABLE public.remote_instances (
    id uuid PRIMARY KEY, site_id uuid NOT NULL, user_id uuid, created_by uuid,
    payload text DEFAULT 'original', blocked boolean NOT NULL DEFAULT false
  );
  ${legacyPolicies("remote_instances")}
  ${childSchema(coreChildren)}
  INSERT INTO public.sites VALUES ('${ids.site}', '${ids.owner}'), ('${ids.otherSite}', '${ids.foreign}');
  INSERT INTO public.site_ownership VALUES ('${ids.site}', '${ids.coowner}');
  INSERT INTO public.site_members VALUES
    ('${ids.site}', '${ids.member}', 'collaborator', 'active', true),
    ('${ids.site}', '${ids.unrestricted}', 'collaborator', 'active', false),
    ('${ids.site}', '${ids.nullable}', 'collaborator', 'active', NULL),
    ('${ids.site}', '${ids.inactive}', 'collaborator', 'inactive', false),
    ('${ids.site}', '${ids.viewer}', 'marketing', 'active', true),
    ('${ids.site}', '${ids.admin}', 'admin', 'active', false);
  INSERT INTO public.remote_instances (id, site_id, user_id, created_by, blocked) VALUES
    ('${ids.own}', '${ids.site}', '${ids.member}', '${ids.owner}', false),
    ('${ids.created}', '${ids.site}', '${ids.owner}', '${ids.member}', false),
    ('${ids.hidden}', '${ids.site}', '${ids.owner}', '${ids.owner}', false),
    ('${ids.crossSite}', '${ids.otherSite}', '${ids.member}', '${ids.member}', false),
    ('${ids.blocked}', '${ids.site}', '${ids.member}', '${ids.member}', true),
    ('${ids.viewerInstance}', '${ids.site}', '${ids.viewer}', '${ids.viewer}', false);
  ${coreChildren.map(childSeed).join("\n")}
`