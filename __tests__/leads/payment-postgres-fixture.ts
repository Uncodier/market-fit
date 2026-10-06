import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

const pgBin = '/opt/homebrew/opt/postgresql@17/bin'
export const postgresAvailable = ['initdb', 'pg_ctl', 'psql'].every(file => existsSync(path.join(pgBin, file)))
// Do not inherit PGHOST, PGSERVICE, database URLs, or credentials from Next's env loader.
const pgEnv = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: process.env.NODE_ENV, LC_ALL: 'C', LANG: 'C' }
export const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`
export const ids = {
  owner: uuid(1), admin: uuid(2), collaborator: uuid(3), restricted: uuid(4),
  marketing: uuid(5), inactive: uuid(6), foreign: uuid(7), coOwner: uuid(8), ownerMember: uuid(9),
  site: uuid(10), otherSite: uuid(11), lead: uuid(20), hiddenLead: uuid(21), otherLead: uuid(22),
}
export const quote = (value: string | null) => value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`
export const json = (value: unknown) => `${quote(JSON.stringify(value))}::jsonb`
export const actorSql = (sql: string, user: string | null = ids.owner, role = 'authenticated') =>
  `SET ROLE ${role}; SET request.jwt.claim.sub = ${quote(user ?? '')}; ${sql};`
const migration = (name: string) => readFileSync(path.join(__dirname, '../../supabase/migrations', name), 'utf8')
const functionSql = (source: string, name: string) => {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  if (start < 0) throw new Error(`Missing fixture function: ${name}`)
  return source.slice(start).split('$$;')[0] + '$$;'
}

export class PaymentPostgres {
  private directory = ''
  private args() {
    return ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
      '-h', this.directory, '-p', '55442', '-U', 'postgres', '-d', 'postgres']
  }

  db(sql: string) {
    return execFileSync(path.join(pgBin, 'psql'), this.args(), {
      input: sql, encoding: 'utf8', stdio: 'pipe', timeout: 20000, env: pgEnv,
    }).trim()
  }

  call(sql: string, user: string | null = ids.owner, role = 'authenticated') {
    return this.db(actorSql(sql, user, role))
  }

  start(sql: string, name: string, hold = false) {
    const child = spawn(path.join(pgBin, 'psql'), this.args(), { stdio: 'pipe', env: pgEnv, timeout: 20000 })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', data => { stdout += data })
    child.stderr.on('data', data => { stderr += data })
    const result = new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', code => resolve({ code, stdout: stdout.trim(), stderr }))
    })
    child.stdin.write(`SET application_name = ${quote(name)}; ${sql}\n`)
    if (!hold) child.stdin.end()
    return { result, finish: (sql = 'COMMIT;') => child.stdin.end(`${sql}\n`), kill: () => child.kill() }
  }

  async waitFor(query: string) {
    const deadline = Date.now() + 10000
    while (Date.now() < deadline) {
      if (this.db(query) === 't') return
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    throw new Error(`PostgreSQL interleaving was not reached: ${query}`)
  }

  startCluster() {
    // Short /tmp paths avoid macOS Unix socket length limits. No TCP listener.
    this.directory = mkdtempSync('/tmp/lead-payment-pg-')
    execFileSync(path.join(pgBin, 'initdb'), ['-D', path.join(this.directory, 'data'), '-U', 'postgres',
      '-A', 'trust', '--no-locale'], { stdio: 'pipe', env: pgEnv, timeout: 20000 })
    execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(this.directory, 'data'),
      '-l', path.join(this.directory, 'server.log'), '-o',
      `-F -p 55442 -k ${this.directory} -c listen_addresses='' -c lc_messages=C`, '-w', 'start'],
    { stdio: 'pipe', env: pgEnv, timeout: 20000 })
    this.db('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE public_client;')
    this.install()
  }

  stopCluster() {
    if (!this.directory) return
    try {
      if (existsSync(path.join(this.directory, 'data/postmaster.pid'))) {
        execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(this.directory, 'data'), '-m', 'immediate', '-w', 'stop'],
          { stdio: 'pipe', env: pgEnv, timeout: 20000 })
      }
    } finally {
      rmSync(this.directory, { recursive: true, force: true })
    }
  }

  private install() {
    // Model only current columns used by the RPCs, capability helpers, RLS and legacy trigger.
    this.db(`
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role, public_client;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE public.sites(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users, archived_at timestamptz);
      CREATE TABLE public.site_ownership(site_id uuid REFERENCES public.sites, user_id uuid REFERENCES auth.users);
      CREATE TABLE public.site_members(site_id uuid REFERENCES public.sites, user_id uuid REFERENCES auth.users,
        role text, status text, restrict_to_assigned_only boolean DEFAULT false, PRIMARY KEY(site_id, user_id));
      CREATE TABLE public.leads(id uuid PRIMARY KEY, site_id uuid REFERENCES public.sites,
        user_id uuid REFERENCES auth.users, assignee_id uuid REFERENCES auth.users);
      CREATE TABLE public.sales(id uuid PRIMARY KEY, site_id uuid REFERENCES public.sites, lead_id uuid REFERENCES public.leads,
        user_id uuid REFERENCES auth.users, title text, invoice_number text, amount numeric, amount_due numeric,
        currency text, sale_date date, created_at timestamptz, updated_at timestamptz, status text,
        payments jsonb, payment_method text, accounting_state text);
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
      GRANT INSERT, UPDATE, DELETE ON public.sales, public.leads TO authenticated, service_role;
    `)
    // Load the real role/capability stubs rather than an always-true permission mock.
    const roles = migration('20260825160000_fix_site_role_and_delete_caps.sql')
    this.db(functionSql(roles, 'current_user_site_role') + functionSql(roles, 'user_can'))
    this.db(functionSql(migration('20260929221000_archive_sites.sql'), 'current_user_site_role'))
    this.db(`
      ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
      ${['leads', 'sales'].map(table => `CREATE POLICY fixture_${table}_read ON public.${table} FOR SELECT TO authenticated
        USING (public.user_can(site_id, 'select') AND (EXISTS (SELECT 1 FROM public.sites s
            WHERE s.id = ${table}.site_id AND s.user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.site_ownership so WHERE so.site_id = ${table}.site_id AND so.user_id = auth.uid())
          OR NOT EXISTS (SELECT 1 FROM public.site_members m WHERE m.site_id = ${table}.site_id
            AND m.user_id = auth.uid() AND m.status = 'active' AND m.restrict_to_assigned_only)
          OR user_id = auth.uid() ${table === 'leads' ? 'OR assignee_id = auth.uid()' : ''}));`).join('\n')}
    `)
    // Install only the first lifecycle function and its sales trigger, before the payment migration.
    const legacy = migration('20260929223200_accounting_source_lifecycle.sql')
    this.db(legacy.slice(legacy.indexOf('CREATE OR REPLACE FUNCTION'), legacy.indexOf('CREATE TRIGGER accounting_00_purchases')))
    this.db(migration('20261006220000_lead_invoice_payments.sql'))
  }

  reset() {
    const { owner, admin, collaborator, restricted, marketing, inactive, foreign, coOwner, ownerMember, site, otherSite,
      lead, hiddenLead, otherLead } = ids
    this.db(`TRUNCATE auth.users, public.sites CASCADE;
      INSERT INTO auth.users VALUES ${[owner, admin, collaborator, restricted, marketing, inactive, foreign, coOwner, ownerMember]
        .map(user => `('${user}')`).join(',')};
      INSERT INTO public.sites VALUES ('${site}', '${owner}', NULL), ('${otherSite}', '${foreign}', NULL);
      INSERT INTO public.site_ownership VALUES ('${site}', '${coOwner}');
      INSERT INTO public.site_members VALUES
        ('${site}', '${admin}', 'admin', 'active', false),
        ('${site}', '${collaborator}', 'collaborator', 'active', false),
        ('${site}', '${restricted}', 'collaborator', 'active', true),
        ('${site}', '${marketing}', 'marketing', 'active', false),
        ('${site}', '${inactive}', 'admin', 'inactive', false),
        ('${site}', '${coOwner}', 'marketing', 'active', true),
        ('${site}', '${ownerMember}', 'owner', 'active', true);
      INSERT INTO public.leads VALUES ('${lead}', '${site}', '${owner}', '${restricted}'),
        ('${hiddenLead}', '${site}', '${owner}', NULL), ('${otherLead}', '${otherSite}', '${foreign}', NULL);`)
  }
}