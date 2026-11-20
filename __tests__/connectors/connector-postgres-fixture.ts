import { readFileSync } from 'node:fs'
import path from 'node:path'
import { uuid } from '../security/isolated-postgres'

export const root = path.resolve(__dirname, '../..')
export const codeRoot = path.resolve(root, '..')
export const workspaceAccessMigration = '20261119223011_connector_workspace_access.sql'
export const toolAccessMigration = '20261120030000_connector_tool_access_mode.sql'
export const migrationNames = [
  '20261119220100_connector_resources.sql',
  '20261119220101_connector_access_boundary.sql',
  '20261119220102_connector_access_mutations.sql',
  '20261119220103_connector_auth_finalization.sql',
  '20261119220104_connector_provider_state.sql',
  '20261119223001_connector_manager_serialization.sql',
  '20261119223010_connector_revocation_dispatch.sql',
  workspaceAccessMigration,
  toolAccessMigration,
]
export const sqlSource = (name: string, repo = 'market-fit') =>
  readFileSync(path.join(codeRoot, repo, 'supabase/migrations', name), 'utf8')

export const id = {
  site: uuid(1), otherSite: uuid(2), owner: uuid(10), admin: uuid(11), member: uuid(12),
  viewer: uuid(13), foreign: uuid(14), coowner: uuid(15), pending: uuid(16), blocked: uuid(17),
  restricted: uuid(18), disabled: uuid(19), agent: uuid(20), otherAgent: uuid(21), inactiveAgent: uuid(22),
  provider: uuid(30), otherProvider: uuid(31), connector: uuid(40), hidden: uuid(41), foreignConnector: uuid(42),
  attempt: uuid(50),
}
export const memberRow = (user: string) => uuid(Number(user.slice(-12)) + 100)
export const jsonSql = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
export const accessSql = (members: unknown[], agents: unknown[] = [], revision = 1,
  actor = id.owner, connector = id.connector, site = id.site) =>
  `SELECT public.connector_update_access('${site}','${connector}','${actor}',${revision},${jsonSql(members)},${jsonSql(agents)})`
export const policySql = (revision = 1, tools = "ARRAY['GMAIL_LIST_EMAILS']", hosts = "ARRAY['assistant']",
  enabled = 'NULL') => `SELECT public.connector_update_policy('${id.site}','${id.connector}','${id.owner}',
    ${revision},${tools},${hosts},false,${enabled})`
export const finalizeSql = (overrides: Partial<Record<'attempt'|'actor'|'nonce'|'account'|'toolkit'|'config', string>> = {}) =>
  `SELECT public.connector_finalize_auth('${overrides.attempt ?? id.attempt}','${overrides.actor ?? id.owner}',
    '${overrides.nonce ?? 'a'.repeat(64)}','${overrides.account ?? 'new-account'}',
    '${overrides.toolkit ?? 'gmail'}','${overrides.config ?? 'auth-config'}','Synthetic account',ARRAY['mail.read'])`

export function installConnectorFixture(db: (sql: string) => string, stopBefore?: string) {
  db(`DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public; CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA public, auth TO postgres, anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.sites(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users,
      archived_at timestamptz, plan text NOT NULL DEFAULT 'enterprise');
    CREATE TABLE public.site_ownership(site_id uuid REFERENCES public.sites, user_id uuid REFERENCES auth.users,
      PRIMARY KEY(site_id,user_id));
    CREATE TABLE public.site_members(id uuid PRIMARY KEY, site_id uuid REFERENCES public.sites,
      user_id uuid REFERENCES auth.users, role text, status text, blocked_screens text[] NOT NULL DEFAULT '{}',
      manually_disabled boolean NOT NULL DEFAULT false, license_suspended boolean NOT NULL DEFAULT false,
      created_at timestamptz DEFAULT now());
    CREATE TABLE public.agents(id uuid PRIMARY KEY, site_id uuid NOT NULL REFERENCES public.sites, status text);
    CREATE TABLE public.site_member_location_restrictions(site_id uuid, site_member_id uuid, location_id uuid);
    -- License plan resolution is a fixture input; the real ranking/license helper below is unmodified.
    CREATE FUNCTION public.effective_site_plan(p_site_id uuid) RETURNS text LANGUAGE sql STABLE AS
      $$ SELECT plan FROM public.sites WHERE id=p_site_id $$;
    INSERT INTO auth.users SELECT value::uuid FROM unnest(ARRAY[${Object.values(id).map(value => `'${value}'`).join(',')}]) value;
    INSERT INTO public.sites(id,user_id) VALUES ('${id.site}','${id.owner}'),('${id.otherSite}','${id.foreign}');
    INSERT INTO public.site_ownership VALUES ('${id.site}','${id.coowner}');
    INSERT INTO public.site_members(id,site_id,user_id,role,status) VALUES
      ${[id.admin, id.member, id.viewer, id.pending, id.blocked, id.restricted, id.disabled].map(user =>
        `('${memberRow(user)}','${id.site}','${user}','${user === id.admin ? 'admin' : 'collaborator'}',
          '${user === id.pending ? 'pending' : 'active'}')`).join(',')};
    UPDATE public.site_members SET blocked_screens=ARRAY['connectors'] WHERE user_id='${id.blocked}';
    UPDATE public.site_members SET manually_disabled=true WHERE user_id='${id.disabled}';
    INSERT INTO public.site_member_location_restrictions VALUES ('${id.site}','${memberRow(id.restricted)}','${uuid(90)}');
    INSERT INTO public.agents VALUES ('${id.agent}','${id.site}','active'),
      ('${id.otherAgent}','${id.otherSite}','active'),('${id.inactiveAgent}','${id.site}','inactive');
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgres, service_role;
    GRANT SELECT ON auth.users TO postgres, service_role;`)
  const baseline = readFileSync(path.join(codeRoot, 'makinari-db-scheme/bootstrap/supabase/migrations',
    '20261027000104_qa_baseline_064.sql'), 'utf8')
  const marker = 'CREATE FUNCTION public.site_member_has_effective_license('
  db(baseline.slice(baseline.indexOf(marker)).split('$$;')[0] + '$$;')
  for (const name of migrationNames) {
    if (name === stopBefore) break
    db(sqlSource(name))
  }
  db(`INSERT INTO public.site_connector_providers(id,site_id,project_id,provider_user_id,credential_revision,status)
      VALUES ('${id.provider}','${id.site}','project-a','site-a','rev-1','active'),
        ('${id.otherProvider}','${id.otherSite}','project-a','site-b','rev-1','active');
    INSERT INTO public.connectors(id,site_id,provider_id,toolkit_slug,provider_account_id,auth_config_id,
      display_name,provider_status,created_by,verified_at) VALUES
      ('${id.connector}','${id.site}','${id.provider}','gmail','account-a','auth-config','Visible account','ACTIVE','${id.owner}',now()),
      ('${id.hidden}','${id.site}','${id.provider}','gmail','account-hidden','auth-config','Hidden account','ACTIVE','${id.owner}',now()),
      ('${id.foreignConnector}','${id.otherSite}','${id.otherProvider}','gmail','account-b','auth-config','Foreign account','ACTIVE','${id.foreign}',now());`)
}

export function insertAttempt(db: (sql: string) => string, status = 'completing', account = 'new-account', toolkit = 'gmail') {
  db(`INSERT INTO public.site_connector_auth_attempts(id,site_id,provider_id,user_id,toolkit_slug,
    auth_config_id,provider_account_id,nonce_hash,credential_revision,status,expires_at)
    VALUES ('${id.attempt}','${id.site}','${id.provider}','${id.owner}','${toolkit}',
      'auth-config','${account}','${'a'.repeat(64)}','rev-1','${status}',now()+interval '5 minutes')`)
}