import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"

const pgBin = process.env.REQUIREMENT_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
export const postgresAvailable = ["initdb", "pg_ctl", "psql"].every(file => existsSync(path.join(pgBin, file)))
const env = { ...process.env, LC_ALL: "C", LANG: "C" }
export const original = readFileSync(path.join(__dirname, "fixtures/legacy-migration-retirements.sql"), "utf8")
export const repair = readFileSync(path.join(process.cwd(),
  "supabase/migrations/20261012200000_preserve_retirement_audit_on_requirement_delete.sql"), "utf8")
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
export const ids = { owner: uuid(1), admin: uuid(2), member: uuid(3), outsider: uuid(4),
  site: uuid(10), otherSite: uuid(11), instance: uuid(20), requirement: uuid(30), receipt: uuid(40) }

export function disposablePostgres() {
  let directory = ""
  const db = (sql: string) => execFileSync(path.join(pgBin, "psql"), [
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", directory,
    "-p", "55443", "-U", "postgres", "-d", "postgres",
  ], { input: sql, encoding: "utf8", stdio: "pipe", timeout: 20000, env }).trim()
  return {
    db,
    start() {
      // A fresh socket-only cluster, never a configured local/remote database URL.
      directory = mkdtempSync("/tmp/requirement-pg-")
      execFileSync(path.join(pgBin, "initdb"), [
        "-D", path.join(directory, "data"), "-U", "postgres", "-A", "trust", "--no-locale",
      ], { stdio: "pipe", timeout: 20000, env })
      execFileSync(path.join(pgBin, "pg_ctl"), [
        "-D", path.join(directory, "data"), "-l", path.join(directory, "server.log"),
        "-o", `-F -p 55443 -k ${directory} -c listen_addresses='' -c lc_messages=C`, "-w", "start",
      ], { stdio: "pipe", timeout: 20000, env })
      db("CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;")
    },
    stop() {
      if (!directory) return
      if (existsSync(path.join(directory, "data/postmaster.pid"))) {
        execFileSync(path.join(pgBin, "pg_ctl"), [
          "-D", path.join(directory, "data"), "-m", "fast", "-w", "stop",
        ], { stdio: "pipe", timeout: 20000, env })
      }
      rmSync(directory, { recursive: true, force: true })
    },
  }
}

// Minimal pre-existing schema. The historical retirement migration below is an
// exact fixture from API/20261005010000_retire_legacy_migration_holds.sql.
export const bootstrap = `
DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public; CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE public.sites (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.site_members (site_id uuid, user_id uuid, role text, can_delete boolean);
CREATE TABLE public.requirements (
  id uuid PRIMARY KEY, site_id uuid NOT NULL REFERENCES public.sites, user_id uuid NOT NULL,
  status text, metadata jsonb, cron_lock_active boolean DEFAULT false, cron_lock_expires_at timestamptz
);
CREATE TABLE public.remote_instances (id uuid PRIMARY KEY, site_id uuid, user_id uuid);
CREATE TABLE public.requirement_segments (requirement_id uuid REFERENCES public.requirements ON DELETE CASCADE);
CREATE TABLE public.campaign_requirements (requirement_id uuid REFERENCES public.requirements ON DELETE CASCADE);
CREATE TABLE public.requirement_migration_lifecycle (
  requirement_id uuid REFERENCES public.requirements ON DELETE CASCADE, file text,
  state text, version integer, updated_at timestamptz, PRIMARY KEY (requirement_id, file)
);
CREATE TABLE public.requirement_migration_execution_handoffs (
  requirement_id uuid REFERENCES public.requirements ON DELETE CASCADE, file text, site_id uuid,
  transferred_version integer, prior_lifecycle jsonb, created_at timestamptz
);
CREATE TABLE public.requirement_migration_diagnostics (requirement_id uuid, file text, state text,
  FOREIGN KEY (requirement_id, file) REFERENCES public.requirement_migration_lifecycle ON DELETE CASCADE);
CREATE TABLE public.requirement_migration_reconciliations (id uuid, requirement_id uuid);
CREATE TABLE public.requirement_migration_reconciliation_resumes (receipt_id uuid);
CREATE TABLE public.instance_logs (instance_id uuid, site_id uuid, log_type text, level text, message text, details jsonb);

CREATE FUNCTION public.current_user_site_role(p_site_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN s.user_id = auth.uid() THEN 'owner' ELSE
    (SELECT role FROM public.site_members WHERE site_id = s.id AND user_id = auth.uid()) END
  FROM public.sites s WHERE s.id = p_site_id;
$$;
CREATE FUNCTION public.user_can(p_site_id uuid, capability text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT capability = 'delete' AND (s.user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.site_members WHERE site_id = s.id AND user_id = auth.uid() AND can_delete
  )) FROM public.sites s WHERE s.id = p_site_id;
$$;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_access ON public.requirements TO authenticated
  USING (public.current_user_site_role(site_id) IS NOT NULL);
GRANT SELECT, DELETE ON public.requirements TO authenticated;
CREATE FUNCTION public.guard_requirement_deletion_authority() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = OLD.site_id)
    OR (auth.uid() IS NULL AND current_setting('role', true) = 'service_role') THEN
    RETURN OLD;
  END IF;
  IF auth.uid() IS NULL
    OR public.current_user_site_role(OLD.site_id) IS NULL
    OR public.current_user_site_role(OLD.site_id) NOT IN ('owner', 'admin')
    OR public.user_can(OLD.site_id, 'delete') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Requirement deletion requires site owner or administrator permission' USING ERRCODE = 'PT403';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER requirement_deletion_authority BEFORE DELETE ON public.requirements
  FOR EACH ROW EXECUTE FUNCTION public.guard_requirement_deletion_authority();
${original}
CREATE TRIGGER requirement_migration_execution_handoff_guard
  AFTER INSERT OR UPDATE OR DELETE ON public.requirement_migration_lifecycle
  FOR EACH ROW EXECUTE FUNCTION public.guard_migration_execution_handoff();
INSERT INTO public.sites VALUES ('${ids.site}', '${ids.owner}'), ('${ids.otherSite}', '${ids.outsider}');
INSERT INTO public.site_members VALUES ('${ids.site}', '${ids.admin}', 'admin', true),
  ('${ids.site}', '${ids.member}', 'member', true);
INSERT INTO public.remote_instances VALUES ('${ids.instance}', '${ids.site}', '${ids.owner}');
INSERT INTO public.requirements (id, site_id, user_id, status, metadata) VALUES
  ('${ids.requirement}', '${ids.site}', '${ids.owner}', 'blocked',
  '{"runner_instance_id":"${ids.instance}","execution_hold":{"kind":"migration_platform_review","file":"migrations/legacy.sql"}}');
INSERT INTO public.requirement_migration_lifecycle VALUES
  ('${ids.requirement}', 'migrations/legacy.sql', 'platform_review', 1, clock_timestamp());
INSERT INTO public.requirement_segments VALUES ('${ids.requirement}');
INSERT INTO public.campaign_requirements VALUES ('${ids.requirement}');
`

export const retire = `SET ROLE service_role;
SELECT public.retire_requirement_migration_hold('${ids.requirement}', 'migrations/legacy.sql',
  1, 0, '${ids.instance}', '${ids.receipt}', 'test-operator', 'Retire obsolete authority');`
export const actor = (userId: string, sql: string) =>
  `SET ROLE authenticated; SET request.jwt.claim.sub = '${userId}'; ${sql}`
export const deleteRequirement = `DELETE FROM public.requirements WHERE id = '${ids.requirement}' RETURNING id;`