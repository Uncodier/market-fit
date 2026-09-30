import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

const pgBin = process.env.SECURITY_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin'
export const postgresAvailable = ['initdb', 'pg_ctl', 'psql'].every(file => existsSync(path.join(pgBin, file)))
const env: NodeJS.ProcessEnv = { ...process.env, LC_ALL: 'C', LANG: 'C' }
for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key]
export const migration = (file: string) => readFileSync(path.join(process.cwd(), 'supabase/migrations', file), 'utf8')
export const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`
export const ids = { site: uuid(1), otherSite: uuid(2), owner: uuid(10), admin: uuid(11),
  collaborator: uuid(12), marketing: uuid(13), inactive: uuid(14), foreign: uuid(15), coOwner: uuid(16),
  purchase: uuid(20), otherPurchase: uuid(21), item: uuid(30) }
export const actorSql = (sql: string, user = ids.owner, role = 'authenticated') =>
  `SET ROLE ${role}; SET request.jwt.claims = '${JSON.stringify({ sub: user, role })}'; ${sql}`

export function isolatedPostgres() {
  let directory = ''
  const args = () => ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', directory,
    '-p', '55469', '-U', 'auditor', '-d', 'postgres']
  const db = (sql: string) => execFileSync(path.join(pgBin, 'psql'), args(), {
    input: sql, encoding: 'utf8', stdio: 'pipe', timeout: 20000, env,
  }).trim()
  const call = (sql: string, user = ids.owner, role = 'authenticated') => db(actorSql(sql, user, role))
  const stop = () => {
    if (!directory) return
    if (existsSync(path.join(directory, 'data/postmaster.pid'))) {
      execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(directory, 'data'), '-m', 'fast', '-w', 'stop'],
        { stdio: 'pipe', timeout: 20000, env })
    }
    rmSync(directory, { recursive: true, force: true })
    directory = ''
  }
  const start = () => {
    // Socket-only synthetic cluster. Never connect to DATABASE_URL or a remote host.
    directory = mkdtempSync('/tmp/security-pg-')
    try {
      execFileSync(path.join(pgBin, 'initdb'), ['-D', path.join(directory, 'data'), '-U', 'auditor', '-A', 'trust', '--no-locale'],
        { stdio: 'pipe', timeout: 20000, env })
      execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(directory, 'data'), '-l', path.join(directory, 'server.log'),
        '-o', `-F -p 55469 -k ${directory} -c listen_addresses='' -c lc_messages=C`, '-w', 'start'],
      { stdio: 'pipe', timeout: 20000, env })
      db(`CREATE ROLE postgres NOSUPERUSER BYPASSRLS; CREATE ROLE anon;
        CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;`)
    } catch (error) { stop(); throw error }
  }
  const concurrent = (sql: string) => new Promise<string>((resolve, reject) => {
    const child = spawn(path.join(pgBin, 'psql'), args(), { stdio: ['pipe', 'pipe', 'pipe'], env })
    let output = ''; let error = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), 20000)
    child.stdout.on('data', data => { output += data })
    child.stderr.on('data', data => { error += data })
    child.on('error', reason => { clearTimeout(timer); reject(reason) })
    child.on('close', code => {
      clearTimeout(timer)
      if (code === 0) resolve(output.trim())
      else reject(new Error(error))
    })
    child.stdin.end(sql)
  })
  return { db, call, start, stop, concurrent }
}

export function installSiteFixture(db: (sql: string) => string) {
  db(`DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public; CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA public, auth TO postgres, anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role' $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
    CREATE TABLE sites (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE site_ownership (site_id uuid REFERENCES sites, user_id uuid);
    CREATE TABLE site_members (site_id uuid REFERENCES sites, user_id uuid, role text, status text);
    GRANT SELECT ON sites, site_members, site_ownership TO postgres, anon, authenticated, service_role;
    INSERT INTO sites VALUES ('${ids.site}', '${ids.owner}'), ('${ids.otherSite}', '${ids.foreign}');
    INSERT INTO site_ownership VALUES ('${ids.site}', '${ids.coOwner}');
    INSERT INTO site_members VALUES ('${ids.site}', '${ids.admin}', 'admin', 'active'),
      ('${ids.site}', '${ids.collaborator}', 'collaborator', 'active'),
      ('${ids.site}', '${ids.marketing}', 'marketing', 'active'),
      ('${ids.site}', '${ids.inactive}', 'admin', 'inactive');`)
  // Exact repository capability functions, excluding unrelated remote_instances DDL.
  db(migration('20260825160000_fix_site_role_and_delete_caps.sql').split('DROP POLICY IF EXISTS')[0])
  db('ALTER TABLE sites ADD COLUMN archived_at timestamptz;')
  const archive = migration('20260929221000_archive_sites.sql')
  db(archive.slice(archive.indexOf('CREATE OR REPLACE FUNCTION public.current_user_site_role(')).split('$$;')[0] + '$$;')
  db(`ALTER FUNCTION public.current_user_site_role(uuid) OWNER TO postgres;
    ALTER FUNCTION public.user_can(uuid,text) OWNER TO postgres;`)
}

export function installPurchaseFixture(db: (sql: string) => string) {
  installSiteFixture(db)
  db(`CREATE TABLE companies (id uuid PRIMARY KEY);
    CREATE TABLE locations (id uuid PRIMARY KEY, site_id uuid REFERENCES sites);
    CREATE TABLE catalog_items (id uuid PRIMARY KEY, site_id uuid REFERENCES sites);
    CREATE TABLE purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES sites,
      user_id uuid, title text NOT NULL DEFAULT 'Test bill', amount numeric NOT NULL DEFAULT 10,
      amount_due numeric NOT NULL DEFAULT 10, currency text NOT NULL DEFAULT 'USD', payments jsonb NOT NULL DEFAULT '[]',
      purchase_date date NOT NULL DEFAULT '2026-09-29', status text NOT NULL DEFAULT 'pending',
      accounting_state text NOT NULL DEFAULT 'pending', vendor_company_id uuid REFERENCES companies,
      location_id uuid REFERENCES locations, notes text, updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE purchase_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL REFERENCES purchases ON DELETE CASCADE,
      site_id uuid NOT NULL REFERENCES sites, catalog_item_id uuid REFERENCES catalog_items, name text NOT NULL DEFAULT 'Item',
      quantity numeric NOT NULL DEFAULT 1, unit_cost numeric NOT NULL DEFAULT 10, subtotal numeric NOT NULL DEFAULT 10);
    GRANT ALL ON purchases, purchase_items TO postgres, anon, authenticated, service_role;
    GRANT SELECT ON companies, locations, catalog_items TO postgres, authenticated, service_role;
    ALTER TABLE purchases ENABLE ROW LEVEL SECURITY; ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
    ${['purchases', 'purchase_items'].map(table => `CREATE POLICY ${table}_unified ON ${table} FOR ALL USING (
      current_setting('role',true)='service_role' OR auth.jwt()->>'role'='service_role' OR EXISTS (
        SELECT 1 FROM sites s WHERE s.id=${table}.site_id AND (s.user_id=auth.uid() OR EXISTS (
          SELECT 1 FROM site_members sm WHERE sm.site_id=s.id AND sm.user_id=auth.uid()))));`).join('\n')}
    INSERT INTO purchases(id,site_id,user_id) VALUES ('${ids.purchase}','${ids.site}','${ids.owner}'),
      ('${ids.otherPurchase}','${ids.otherSite}','${ids.foreign}');
    INSERT INTO purchase_items(id,purchase_id,site_id) VALUES ('${ids.item}','${ids.purchase}','${ids.site}');`)
  // Install the actual deployed accounting bodies, not simplified permission mocks.
  const lifecycle = migration('20260929223200_accounting_source_lifecycle.sql')
  for (const name of ['accounting_touch_source', 'accounting_touch_source_from_child', 'accounting_preserve_legacy_receipt']) {
    const body = lifecycle.slice(lifecycle.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`)).split('$$;')[0] + '$$;'
    db(`${body} ALTER FUNCTION public.${name}() OWNER TO postgres;`)
  }
  db(`CREATE TRIGGER accounting_purchases_freshness BEFORE UPDATE ON purchases
      FOR EACH ROW EXECUTE FUNCTION accounting_touch_source();
    CREATE TRIGGER accounting_purchase_item_freshness AFTER INSERT OR UPDATE OR DELETE ON purchase_items
      FOR EACH ROW EXECUTE FUNCTION accounting_touch_source_from_child();
    CREATE TRIGGER accounting_00_purchases_legacy_receipt BEFORE UPDATE OF payments ON purchases
      FOR EACH ROW EXECUTE FUNCTION accounting_preserve_legacy_receipt();`)
  db(migration('20260929220500_accounting_purchase_items.sql'))
  db('ALTER FUNCTION public.accounting_update_purchase_items(uuid,uuid,timestamptz,jsonb,jsonb) OWNER TO postgres;')
}