/** @jest-environment node */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fixturePlan } from '../../scripts/e2e/smoke-fixtures.cjs';

const sql = readFileSync(path.join(process.cwd(), 'scripts/e2e/provision-smoke.sql'), 'utf8');
const site = 'dea92504-319d-4950-943f-503280f1727c';
const owner = 'db4ac8f4-0071-44de-b156-d422aca704f1';
const plan = JSON.parse(sql.split('$fixtures$')[1]);
const pgBin = process.env.ATTRIBUTION_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin';
const available = ['initdb', 'pg_ctl', 'psql'].every(file => existsSync(path.join(pgBin, file)));
const pgEnv = { ...process.env, LC_ALL: 'C', LANG: 'C' };

describe('SQL smoke fixture contract', () => {
  it('uses the same payloads and IDs as the Node provisioner', () => {
    expect(plan).toEqual(fixturePlan(site, owner));
  });
  it('has no destructive operations, trigger bypass or user impersonation', () => {
    const statements = sql.replace(/--[^\n]*/g, '');
    expect(statements).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|SET ROLE)\b/i);
    expect(statements).not.toMatch(/session_replication_role|request\.jwt|DISABLE TRIGGER/i);
    expect(statements).toMatch(/BEGIN;/);
    expect(statements).toMatch(/COMMIT;/);
    expect(statements).toContain('pg_advisory_xact_lock');
    expect(statements).toContain('Existing % fixture differs');
  });
});

(available ? describe : describe.skip)('SQL provisioning in disposable socket-only PostgreSQL', () => {
  let directory;
  const db = input => execFileSync(path.join(pgBin, 'psql'), [
    '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', directory,
    '-p', '55447', '-U', 'postgres', '-d', 'postgres',
  ], { input, encoding: 'utf8', stdio: 'pipe', timeout: 20000, env: pgEnv }).trim();

  beforeAll(() => {
    // No DATABASE_URL, production calls, network listener or real webhook dispatch.
    directory = mkdtempSync('/tmp/smoke-sql-');
    execFileSync(path.join(pgBin, 'initdb'), ['-D', path.join(directory, 'data'), '-A', 'trust', '-U', 'postgres'], { env: pgEnv, stdio: 'pipe' });
    execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(directory, 'data'), '-l', path.join(directory, 'log'),
      '-o', `-k ${directory} -p 55447 -c listen_addresses=''`, '-w', 'start'], { env: pgEnv, stdio: 'pipe' });
    db(`CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE TABLE public.sites (id uuid PRIMARY KEY, name text, user_id uuid REFERENCES auth.users, archived_at timestamptz);
      INSERT INTO auth.users VALUES ('${owner}');
      INSERT INTO public.sites VALUES ('${site}', 'Global Tech Innovations Ltd - Updated', '${owner}', NULL);`);
    for (const fixture of plan) {
      const fields = Object.entries(fixture.row).map(([key, value]) => {
        const type = key === 'id' || key.endsWith('_id') ? 'uuid' : typeof value === 'boolean' ? 'boolean'
          : typeof value === 'number' ? 'numeric' : value && typeof value === 'object' ? 'jsonb' : 'text';
        return `"${key}" ${type}${key === 'id' ? ' PRIMARY KEY' : ''}`;
      });
      db(`CREATE TABLE public.${fixture.table} (${fields.join(',')});`);
    }
  }, 30000);

  afterAll(() => {
    if (directory) {
      try { execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(directory, 'data'), '-m', 'immediate', '-w', 'stop'], { env: pgEnv, stdio: 'pipe' }); }
      finally { rmSync(directory, { recursive: true, force: true }); }
    }
  });
  beforeEach(() => {
    db(`TRUNCATE public.content, public.leads, public.catalog_items;
      UPDATE public.sites SET name = 'Global Tech Innovations Ltd - Updated', archived_at = NULL;`);
  });

  it('executes real SQL, returns three rows, and reruns without rewriting them', () => {
    expect(db(sql).split('\n')).toHaveLength(3);
    const versions = () => db('SELECT xmin FROM content UNION ALL SELECT xmin FROM leads UNION ALL SELECT xmin FROM catalog_items;');
    const before = versions();
    expect(db(sql).split('\n')).toHaveLength(3);
    expect(versions()).toBe(before);
    expect(db('SELECT is_purchasable FROM catalog_items;')).toBe('f');
    expect(db('SELECT email IS NULL AND phone IS NULL AND do_not_call FROM leads;')).toBe('t');
  });
  it('refuses an archived or renamed site', () => {
    db("UPDATE public.sites SET name = 'Wrong site';");
    expect(() => db(sql)).toThrow('site/owner mismatch');
    expect(db('SELECT count(*) FROM content;')).toBe('0');
  });
  it('rolls back preceding inserts when a later fixture name collides', () => {
    db(`INSERT INTO leads (id,site_id,name) VALUES ('33333333-3333-4333-8333-333333333333','${site}','QA Smoke Lead');`);
    expect(() => db(sql)).toThrow('name collision');
    expect(db('SELECT count(*) FROM content;')).toBe('0');
    expect(db('SELECT count(*) FROM leads;')).toBe('1');
  });
  it('refuses to reuse a fixture whose safety state changed', () => {
    db(sql);
    db('UPDATE catalog_items SET is_purchasable = true;');
    expect(() => db(sql)).toThrow('fixture differs');
    expect(db('SELECT is_purchasable FROM catalog_items;')).toBe('t');
  });
});