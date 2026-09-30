import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

const pgBin = process.env.REORDER_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin'
export const postgresAvailable = ['initdb', 'pg_ctl', 'psql'].every(file => existsSync(path.join(pgBin, file)))
const pgEnv: NodeJS.ProcessEnv = { ...process.env, LC_ALL: 'C', LANG: 'C' }
for (const key of Object.keys(pgEnv)) {
  if (key.startsWith('PG')) delete pgEnv[key]
}
export const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
export const site = uuid(1)
export const otherSite = uuid(2)
export const owner = uuid(10)
export const collaborator = uuid(11)
export const marketing = uuid(12)
export const foreign = uuid(13)
export const inactive = uuid(14)
export const assigned = uuid(15)
export const coOwner = uuid(16)
export const migration = readFileSync(path.join(process.cwd(),
  'supabase/migrations/20260930000200_harden_task_reordering.sql'), 'utf8')

const literal = (value: string | number | null) => value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`
export const reorder = (id: string | null = uuid(103), position: number | null = 1,
  status: string | null = 'pending', siteId: string | null = site) =>
  `SELECT public.reorder_task_priorities(${literal(id)}, ${literal(position)}, ${literal(status)}, ${literal(siteId)});`
export const actor = (sql: string, user: string | null = owner, role = 'authenticated') =>
  `SET ROLE ${role}; SET request.jwt.claims = '${JSON.stringify({ sub: user, role })}'; ${sql}`

export class ReorderPostgres {
  private directory = ''
  private running = false
  private args() {
    return ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', this.directory,
      '-p', '55468', '-U', 'auditor', '-d', 'postgres']
  }

  db(sql: string) {
    return execFileSync(path.join(pgBin, 'psql'), this.args(), {
      input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000, env: pgEnv,
    }).trim()
  }

  call(sql: string, user: string | null = owner, role = 'authenticated') {
    return this.db(actor(sql, user, role))
  }

  concurrent(sql: string) {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(path.join(pgBin, 'psql'), this.args(), { env: pgEnv, stdio: ['pipe', 'pipe', 'pipe'] })
      let output = ''
      let errors = ''
      const timer = setTimeout(() => child.kill('SIGKILL'), 20000)
      child.stdout.on('data', chunk => { output += chunk })
      child.stderr.on('data', chunk => { errors += chunk })
      child.on('error', error => { clearTimeout(timer); reject(error) })
      child.on('close', code => {
        clearTimeout(timer)
        if (code === 0) resolve(output.trim())
        else reject(new Error(errors || `psql exited ${code}`))
      })
      child.stdin.end(sql)
    })
  }

  start() {
    // Unique short socket directory; never connect to DATABASE_URL or a remote host.
    this.directory = mkdtempSync('/tmp/reorder-pg-')
    try {
      execFileSync(path.join(pgBin, 'initdb'), ['-D', path.join(this.directory, 'data'),
        '-U', 'auditor', '-A', 'trust', '--no-locale'], { stdio: 'pipe', env: pgEnv, timeout: 20000 })
      execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(this.directory, 'data'),
        '-l', path.join(this.directory, 'server.log'), '-o',
        `-F -p 55468 -k ${this.directory} -c listen_addresses='' -c lc_messages=C`, '-w', 'start'],
      { stdio: 'pipe', env: pgEnv, timeout: 20000 })
      this.running = true
      this.db(schema)
      // Use the repository's actual deployed capability functions, not an allow-all stub.
      const permissions = readFileSync(path.join(process.cwd(),
        'supabase/migrations/20260825160000_fix_site_role_and_delete_caps.sql'), 'utf8')
      this.db(permissions.split('CREATE OR REPLACE FUNCTION public.get_my_site_capabilities')[0])
      const archive = readFileSync(path.join(process.cwd(),
        'supabase/migrations/20260929221000_archive_sites.sql'), 'utf8')
      this.db('ALTER TABLE public.sites ADD COLUMN archived_at timestamptz;')
      this.db(archive.slice(archive.indexOf('CREATE OR REPLACE FUNCTION public.current_user_site_role(')).split('$$;')[0] + '$$;')
      this.db(permissionTrigger)
      this.db(`INSERT INTO public.sites(id,user_id) VALUES ('${site}', '${owner}'), ('${otherSite}', '${foreign}');
        INSERT INTO public.site_ownership VALUES ('${site}', '${owner}'), ('${site}', '${coOwner}');
        INSERT INTO public.site_members VALUES
        ('${site}', '${collaborator}', 'collaborator', 'active', false),
        ('${site}', '${marketing}', 'marketing', 'active', false),
        ('${site}', '${inactive}', 'admin', 'inactive', false),
        ('${site}', '${assigned}', 'collaborator', 'active', true),
        ('${otherSite}', '${foreign}', 'admin', 'active', false);`)
    } catch (error) {
      this.stop()
      throw error
    }
  }

  stop() {
    if (this.running) {
      execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(this.directory, 'data'), '-m', 'fast', '-w', 'stop'],
        { stdio: 'pipe', env: pgEnv, timeout: 20000 })
      this.running = false
    }
    if (this.directory) rmSync(this.directory, { recursive: true, force: true })
  }

  seed() {
    this.db(`TRUNCATE public.tasks, public.task_update_audit;
      UPDATE public.sites SET archived_at=NULL;
      ALTER SEQUENCE public.task_write_attempts RESTART WITH 1;
      INSERT INTO public.tasks(id, site_id, user_id, assignee, status, priority) VALUES
      ('${uuid(101)}', '${site}', '${owner}', NULL, 'pending', 100),
      ('${uuid(102)}', '${site}', '${owner}', '${assigned}', 'pending', 100),
      ('${uuid(103)}', '${site}', '${assigned}', NULL, 'pending', 80),
      ('${uuid(104)}', '${site}', '${owner}', NULL, 'completed', 70),
      ('${uuid(105)}', '${site}', '${owner}', '${assigned}', 'completed', 60),
      ('${uuid(201)}', '${otherSite}', '${foreign}', NULL, 'pending', 100);`)
  }

  snapshot() {
    return this.db('SELECT json_agg(t ORDER BY id) FROM public.tasks t;')
  }

  ordering(status = 'pending', siteId = site) {
    return JSON.parse(this.db(`SELECT coalesce(json_agg(json_build_object('id', id, 'priority', priority)
      ORDER BY priority DESC, id), '[]') FROM public.tasks WHERE site_id='${siteId}' AND status='${status}';`))
  }

  writes() {
    // Sequences do not roll back: this detects even writes attempted by a failed RPC.
    return this.db('SELECT CASE WHEN is_called THEN last_value ELSE 0 END FROM public.task_write_attempts;')
  }
}

const schema = `
CREATE ROLE postgres NOSUPERUSER BYPASSRLS;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
CREATE TABLE public.sites(id uuid PRIMARY KEY, user_id uuid);
CREATE TABLE public.site_ownership(site_id uuid, user_id uuid);
CREATE TABLE public.site_members(site_id uuid, user_id uuid, role text, status text, restrict_to_assigned_only boolean);
CREATE TABLE public.tasks(
  id uuid PRIMARY KEY, site_id uuid NOT NULL, user_id uuid NOT NULL, assignee uuid,
  status text NOT NULL, priority integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT '2026-01-01T00:00:00Z',
  CONSTRAINT tasks_status_check CHECK(status IN ('pending','in_progress','completed','failed','canceled'))
);
CREATE TABLE public.task_update_audit(task_id uuid, actor_id uuid);
CREATE SEQUENCE public.task_write_attempts;
GRANT USAGE ON SCHEMA public, auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT SELECT ON public.sites, public.site_ownership, public.site_members TO authenticated;
GRANT SELECT, UPDATE ON public.tasks TO authenticated;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
-- Exact deployed ALL/PUBLIC policy, including assignment restrictions.
CREATE POLICY tasks_unified ON public.tasks FOR ALL TO PUBLIC USING (
  EXISTS(SELECT 1 FROM public.sites s WHERE s.id=tasks.site_id AND (
    s.user_id=auth.uid()
    OR EXISTS(SELECT 1 FROM public.site_ownership so WHERE so.site_id=s.id AND so.user_id=auth.uid())
    OR EXISTS(SELECT 1 FROM public.site_members sm WHERE sm.site_id=s.id AND sm.user_id=auth.uid()
      AND sm.status='active' AND (sm.restrict_to_assigned_only=false
        OR tasks.user_id=auth.uid() OR tasks.assignee=auth.uid()))
  ))
);
CREATE FUNCTION public.reorder_task_priorities(p_task_id uuid, p_new_position integer, p_status text, p_site_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$ BEGIN RETURN; END; $$;
ALTER FUNCTION public.reorder_task_priorities(uuid, integer, text, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.reorder_task_priorities(uuid, integer, text, uuid) TO anon, authenticated, service_role;
CREATE FUNCTION public.task_update_probe() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM nextval('public.task_write_attempts');
  IF NEW.id::text = current_setting('reorder.fail_task', true) THEN
    RAISE EXCEPTION 'Injected task trigger failure';
  END IF;
  INSERT INTO public.task_update_audit VALUES (NEW.id, auth.uid());
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END; $$;
-- Local transactional probe stands in for updated_at/audit side effects, never outbound network triggers.
CREATE TRIGGER z_task_update_probe BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.task_update_probe();
`

// Tasks-only deployed permission-trigger branch from the read-only RPC audit.
// Its owner is NOT superuser, matching managed postgres and avoiding a false bypass.
const permissionTrigger = `
CREATE FUNCTION public.check_create_update_permission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE target_site_id uuid; current_user_id uuid; user_role text; is_owner boolean; is_superuser boolean;
BEGIN
  SELECT rolsuper INTO is_superuser FROM pg_roles WHERE rolname=current_user;
  IF is_superuser THEN RETURN NEW; END IF;
  IF (current_setting('request.jwt.claims',true)::json->>'role')='service_role' THEN RETURN NEW; END IF;
  current_user_id:=auth.uid();
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  target_site_id:=NEW.site_id;
  SELECT EXISTS(SELECT 1 FROM public.site_ownership WHERE site_id=target_site_id AND user_id=current_user_id) INTO is_owner;
  IF is_owner THEN RETURN NEW; END IF;
  SELECT role INTO user_role FROM public.site_members WHERE site_id=target_site_id AND user_id=current_user_id AND status='active';
  IF user_role='admin' OR user_role='collaborator' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'CREATE_UPDATE_PERMISSION_DENIED: role %',user_role;
END; $$;
ALTER FUNCTION public.check_create_update_permission() OWNER TO postgres;
CREATE TRIGGER trigger_update_permission_tasks BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.check_create_update_permission();
`