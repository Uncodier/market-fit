/** @jest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configuration, localOrigin, localFetch } from '../../scripts/e2e/provision-qa-policy.cjs';
import { plan, environment } from '../../scripts/e2e/provision-qa-plan.cjs';
import { provision, loadEnvironment } from '../../scripts/e2e/provision-qa.cjs';
import { openStore, assertRow } from '../../scripts/e2e/provision-qa-store.cjs';
import { schemaPreflight } from '../../scripts/e2e/provision-qa-schema.cjs';

const jwt = role => `x.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.x`;
const env = { TEST_TARGET: 'local', QA_ENVIRONMENT_ID: 'qa-unit', QA_EXPIRES_AT: '2099-01-01T00:00:00Z',
  TEST_BASE_URL: 'http://localhost:3000', TEST_COMMERCE_BASE_URL: 'http://localhost:3000',
  TEST_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  TEST_SUPABASE_ANON_KEY: jwt('anon'), QA_SUPABASE_SERVICE_ROLE_KEY: jwt('service_role'),
  TEST_ALLOW_MUTATIONS: '1', TEST_DISPOSABLE_ENVIRONMENT: '1' };

// In-memory SDK contract, never a database connection. Deliberately implements
// public isolation/permissions separately from privileged setup.
function database() {
  const tables = {}, authUsers = [], passwords = {}, buckets = [];
  const calls = [], clients = [];
  let failures = {};
  const createClient = jest.fn((url, key, options) => {
    const privileged = key === env.QA_SUPABASE_SERVICE_ROLE_KEY;
    let user;
    const role = site => {
      if (!user) return null;
      if (tables.sites?.some(row => row.id === site && row.user_id === user.id)) return 'admin';
      return tables.site_members?.find(row => row.site_id === site && row.user_id === user.id)?.role || null;
    };
    const client = {
      auth: {
        admin: {
          listUsers: jest.fn(async () => ({ data: { users: authUsers } })),
          getUserById: jest.fn(async id => ({ data: { user: authUsers.find(row => row.id === id) } })),
          createUser: jest.fn(async attributes => {
            if (!privileged) throw new Error('setup key only');
            const actual = { ...attributes, email_confirmed_at: '2026-01-01' };
            authUsers.push(actual); passwords[attributes.id] = attributes.password;
            (tables.profiles ||= []).push({ id: attributes.id, email: attributes.email });
            return { data: { user: actual } };
          }),
        },
        signInWithPassword: jest.fn(async credentials => {
          if (privileged) throw new Error('never sign in privileged client');
          user = authUsers.find(row => row.email === credentials.email && passwords[row.id] === credentials.password);
          return user ? { data: { user } } : { error: { message: 'wrong credentials' } };
        }),
        signOut: jest.fn(async () => ({ error: null })),
      },
      from(table) {
        let filters = [], insertion, columns;
        const query = {
          select(value) { columns = value; return query; },
          eq(field, value) { filters.push([field, value]); return query; },
          insert(row) { insertion = row; return query; },
          then(resolve, reject) {
            return Promise.resolve().then(() => {
              calls.push({ table, insertion, privileged });
              if (failures[table]) return { error: { message: 'sensitive-provider-payload' } };
              if (insertion) {
                if (!privileged) throw new Error('No verification writes');
                (tables[table] ||= []).push(JSON.parse(JSON.stringify(insertion)));
                return { error: null };
              }
              let data = (tables[table] || []).filter(row => filters.every(([field, value]) => row[field] === value));
              if (!privileged) data = data.filter(row => {
                if (table === 'profiles') return row.id === user?.id;
                if (table === 'sites') return !!role(row.id);
                if (table === 'catalog_items' && row.is_marketplace_listed) return true;
                if (table === 'companies') return !!user;
                return !!role(row.site_id);
              });
              return { data: data.map(row => Object.fromEntries(columns.split(',').map(field => [field, row[field]]))) };
            }).then(resolve, reject);
          },
        };
        return query;
      },
      rpc: jest.fn(async (fn, args) => {
        if (privileged || fn !== 'user_can') throw new Error('public permission only');
        const r = role(args.p_site_id), cmd = args.p_command;
        return { data: failures.permissions ? true : !!r && (cmd === 'select' || r === 'admin' || (r === 'collaborator' && cmd !== 'delete')) };
      }),
      storage: {
        listBuckets: jest.fn(async () => ({ data: buckets })),
        createBucket: jest.fn(async id => { buckets.push({ id, name: id, public: true }); return {}; }),
        getBucket: jest.fn(async id => ({ data: buckets.find(bucket => bucket.id === id) })),
      },
    };
    clients.push({ key, client, options });
    return client;
  });
  return { createClient, tables, authUsers, calls, clients, buckets, passwords, fail(value) { failures = value; } };
}

describe('local QA provisioning', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-provision-unit-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
  const fixtureDir = root => path.join(root, '.auth/qa-fixtures/qa-unit');
  const read = (root, name) => JSON.parse(fs.readFileSync(path.join(fixtureDir(root), name), 'utf8'));
  const dependencies = (root, db) => ({ root, createClient: db.createClient, schemaPreflight: jest.fn() });

  it.each(['production', 'staging', undefined])('refuses target %s before any client/files', async target => {
    const db = database();
    await expect(provision({ ...env, TEST_TARGET: target }, ['--apply'], dependencies(root, db))).rejects.toThrow('TEST_TARGET=local');
    expect(db.createClient).not.toHaveBeenCalled();
    expect(fs.readdirSync(root)).toEqual([]);
  });
  it.each(['https://project.supabase.co', 'http://localhost.evil:54321', 'http://localhost.:54321',
    'http://user:secret@localhost:54321', 'http://localhost:54321/api', 'http://localhost:54321/?x=1', 'file:///tmp'])('refuses unsafe origin %s', value => {
    expect(() => localOrigin(value)).toThrow();
  });
  it.each(['../qa-unit', 'qa-../escape', 'unit', 'qa-', 'qa-UPPER'])('refuses unsafe environment ID %s', value => {
    expect(() => configuration({ ...env, QA_ENVIRONMENT_ID: value })).toThrow('qa-*');
  });
  it('requires expiry, matching backend and separate keys', () => {
    expect(() => configuration({ ...env, QA_EXPIRES_AT: '2020-01-01T00:00:00Z' })).toThrow('future');
    expect(() => configuration({ ...env, QA_EXPIRES_AT: '' })).toThrow('required');
    expect(() => configuration({ ...env, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321' })).toThrow('match');
    expect(() => configuration({ ...env, TEST_SUPABASE_ANON_KEY: jwt('service_role') })).toThrow('public');
    expect(() => configuration({ ...env, QA_SUPABASE_SERVICE_ROLE_KEY: jwt('anon') })).toThrow('privileged');
  });
  it.each(['TEST_ALLOW_MUTATIONS', 'TEST_DISPOSABLE_ENVIRONMENT'])('requires mutation flag %s', async flag => {
    const db = database();
    await expect(provision({ ...env, [flag]: '0' }, ['--apply'], dependencies(root, db))).rejects.toThrow('Apply requires');
    expect(db.createClient).not.toHaveBeenCalled();
  });
  it('offline plan is not PASS and creates no clients or files', async () => {
    const db = database();
    const result = await provision(env, [], dependencies(root, db));
    expect(result.status).toBe('PLAN_ONLY');
    expect(result.authUsers).toBe(5);
    expect(db.createClient).not.toHaveBeenCalled();
    expect(fs.readdirSync(root)).toEqual([]);
    await expect(provision(env, ['--apply', '--plan'])).rejects.toThrow('Usage');
  });
  it('pins fetch origin and refuses redirects, preserving request data', async () => {
    const fetch = jest.fn(async () => 'ok');
    const pinned = localFetch(env.TEST_SUPABASE_URL, fetch);
    await expect(pinned(`${env.TEST_SUPABASE_URL}/auth/v1/user`, { headers: { apikey: 'key' } })).resolves.toBe('ok');
    expect(fetch).toHaveBeenCalledWith(expect.any(String), { headers: { apikey: 'key' }, redirect: 'error' });
    expect(() => pinned('https://prod.supabase.co/auth/v1')).toThrow('Off-origin');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('creates full dependency battery and verifies with five public sessions; repeat inserts nothing', async () => {
    const db = database(), deps = dependencies(root, db);
    const result = await provision(env, ['--apply'], deps);
    expect(result).toMatchObject({ status: 'VERIFIED', authUsers: 5, sites: 2, rolesAndRls: 'verified' });
    expect(deps.schemaPreflight).toHaveBeenCalledTimes(1);
    expect(deps.schemaPreflight.mock.invocationCallOrder[0]).toBeLessThan(db.createClient.mock.invocationCallOrder[0]);
    const inserts = db.calls.filter(call => call.insertion).length;
    expect(inserts).toBe(plan(configuration(env)).rows.length);
    expect(db.clients.filter(c => c.key === env.TEST_SUPABASE_ANON_KEY)).toHaveLength(5);
    expect(db.clients[0].client.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(db.calls.filter(call => call.insertion).every(call => call.privileged)).toBe(true);
    const values = read(root, 'env.json');
    expect(values.TEST_ADMIN_PASSWORD.length).toBeGreaterThan(24);
    expect(values.TEST_RESERVATION_CUSTOMER_ID).toBe(values.TEST_LEAD_ID);
    expect(values.TEST_ALLOW_MUTATIONS).toBe('0');
    expect(JSON.stringify(values)).not.toContain(env.QA_SUPABASE_SERVICE_ROLE_KEY);
    expect(JSON.stringify(result)).not.toContain(values.TEST_ADMIN_PASSWORD);
    expect(fs.statSync(path.join(fixtureDir(root), 'env.json')).mode & 0o777).toBe(0o600);
    expect(fs.statSync(fixtureDir(root)).mode & 0o777).toBe(0o700);
    await provision(env, ['--apply'], deps);
    expect(db.authUsers).toHaveLength(5);
    expect(db.calls.filter(call => call.insertion)).toHaveLength(inserts);
    expect(read(root, 'env.json').TEST_ADMIN_PASSWORD).toBe(values.TEST_ADMIN_PASSWORD);
  });
  it('refuses unowned exact ID/rows, and Auth email under a different ID', async () => {
    const db = database();
    db.tables.sites = [plan(configuration(env)).rows[0].row];
    await expect(provision(env, ['--apply'], dependencies(root, db))).rejects.toThrow('Unowned collision');
    expect(db.calls.filter(call => call.insertion)).toHaveLength(0);
    const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-collision-'));
    try {
      const auth = database();
      auth.authUsers.push({ id: 'foreign-id', email: 'admin@qa-unit.invalid' });
      await expect(provision(env, ['--apply'], dependencies(otherRoot, auth))).rejects.toThrow('Unowned Auth collision');
      expect(auth.clients[0].client.auth.admin.createUser).not.toHaveBeenCalled();
    } finally { fs.rmSync(otherRoot, { recursive: true, force: true }); }
  });
  it('refuses name collision and drift without overwrites', async () => {
    const db = database(), deps = dependencies(root, db);
    await provision(env, ['--apply'], deps);
    db.tables.catalog_items[0].metadata.qa_environment_id = 'qa-other';
    await expect(provision(env, ['--apply'], deps)).rejects.toThrow('drift');
    expect(read(root, 'env.json').QA_STATUS).toBe('INCOMPLETE');
    expect(read(root, 'summary.json').status).toBe('FAILED');
    db.tables.catalog_items[0].metadata.qa_environment_id = env.QA_ENVIRONMENT_ID;
    db.tables.catalog_items.push({ ...db.tables.catalog_items[0], id: 'not-owned' });
    await expect(provision(env, ['--apply'], deps)).rejects.toThrow('Identity collision');
  });
  it('permission failures retain private journal and invalidate success artifacts', async () => {
    const db = database(), deps = dependencies(root, db);
    await provision(env, ['--apply'], deps);
    db.fail({ permissions: true });
    await expect(provision(env, ['--apply'], deps)).rejects.toThrow('permission');
    expect(read(root, 'summary.json').status).toBe('FAILED');
    expect(read(root, 'env.json')).not.toHaveProperty('TEST_ADMIN_PASSWORD');
    expect(read(root, 'journal.json').events.at(-1).status).toBe('failed-partial-state-retained');
    expect(fs.existsSync(path.join(fixtureDir(root), 'lock'))).toBe(false);
  });
  it('rejects journal binding changes and symlink output directories', () => {
    const config = configuration(env), store = openStore(root, config);
    expect(() => openStore(root, config)).toThrow('locked');
    store.close();
    expect(() => openStore(root, { ...config, url: 'http://localhost:54321' })).toThrow('binding');
    fs.rmSync(path.join(root, '.auth'), { recursive: true });
    fs.symlinkSync(os.tmpdir(), path.join(root, '.auth'));
    expect(() => openStore(root, config)).toThrow('Unsafe');
  });
  it('compares all ownership metadata, numeric values and booleans strictly', () => {
    expect(() => assertRow({ cost: '0', metadata: { owner: 'qa-unit' } }, { cost: 0, metadata: { owner: 'qa-unit' } })).not.toThrow();
    expect(() => assertRow({ cost: null }, { cost: 0 })).toThrow('drift');
    expect(() => assertRow({ enabled: 1 }, { enabled: true })).toThrow('drift');
    expect(() => assertRow({ metadata: { owner: 'other' } }, { metadata: { owner: 'qa-unit' } })).toThrow('drift');
  });
  it('loads VM .env aliases without rewriting files or inferring target/flags', () => {
    fs.writeFileSync(path.join(root, '.env'), 'NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=public\nSUPABASE_SERVICE_ROLE_KEY=private\n');
    const loaded = loadEnvironment({ QA_ENVIRONMENT_ID: 'qa-explicit' }, root);
    expect(loaded).toMatchObject({ TEST_SUPABASE_URL: 'http://localhost:54321', QA_SUPABASE_SERVICE_ROLE_KEY: 'private' });
    expect(loaded.TEST_TARGET).toBeUndefined();
    expect(fs.readdirSync(root)).toEqual(['.env']);
    expect(environment(configuration(env), plan(configuration(env)), {})).not.toHaveProperty('QA_SUPABASE_SERVICE_ROLE_KEY');
  });
  it('requires read-only bootstrap guard inspection before clients and mutations', async () => {
    const db = database(), deps = dependencies(root, db);
    deps.schemaPreflight = () => { throw new Error('guard absent'); };
    await expect(provision(env, ['--apply'], deps)).rejects.toThrow('guard absent');
    expect(db.createClient).not.toHaveBeenCalled();
    expect(fs.readdirSync(root)).toEqual([]);
    const run = jest.fn(() => ({ status: 0, stdout: 'QA_RLS=9' }));
    expect(() => schemaPreflight({ QA_DATABASE_URL: 'postgres://user:password@remote/db' }, run)).toThrow('loopback');
    expect(run).not.toHaveBeenCalled();
    expect(() => schemaPreflight({ QA_DB_CONTAINER: 'local-db' }, run)).toThrow('guard absent');
    expect(run.mock.calls[0][1].slice(0, 3)).toEqual(['--host', 'unix:///var/run/docker.sock', 'exec']);
    expect(run.mock.calls[0][1].at(-1)).toContain('BEGIN READ ONLY');
    expect(() => schemaPreflight({}, run)).toThrow('Apply requires');
  });
});