/** @jest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configuration, localOrigin, localFetch } from '../../scripts/e2e/provision-qa-policy.cjs';
import { plan, environment } from '../../scripts/e2e/provision-qa-plan.cjs';
import { provision, loadEnvironment } from '../../scripts/e2e/provision-qa.cjs';
import { openStore, assertRow, fingerprint } from '../../scripts/e2e/provision-qa-store.cjs';
import { seedRows } from '../../scripts/e2e/provision-qa-seed.cjs';
import { adjustImages } from '../../scripts/e2e/provision-qa-adjust.cjs';
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
            (tables.profiles ||= []).push({ id: attributes.id, email: attributes.email, language: 'es' });
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
        let filters = [], insertion, update, columns;
        const query = {
          select(value) { columns = value; return query; },
          eq(field, value) { filters.push([field, value]); return query; },
          is(field, value) { filters.push([field, value]); return query; },
          update(row) { update = row; return query; },
          insert(row) { insertion = row; return query; },
          then(resolve, reject) {
            return Promise.resolve().then(() => {
              calls.push({ table, insertion, update, privileged });
              if (failures[table]) return { error: { message: 'sensitive-provider-payload' } };
              if (insertion) {
                if (!privileged) throw new Error('No verification writes');
                if (table === 'accounting_accounts' && insertion.key !== null
                  && !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(insertion.key)) return { error: { code: '23514' } };
                (tables[table] ||= []).push(JSON.parse(JSON.stringify(insertion)));
                return { error: null };
              }
              let data = (tables[table] || []).filter(row => filters.every(([field, value]) => row[field] === value));
              if (update) {
                if (privileged || !user || (table === 'profiles' && data.some(row => row.id !== user.id))
                  || (table === 'catalog_items' && data.some(row => role(row.site_id) !== 'admin'))) throw new Error('User-scoped updates only');
                data.forEach(row => Object.assign(row, update));
                return { error: null };
              }
              if (!privileged) data = data.filter(row => {
                if (table === 'profiles') return row.id === user?.id;
                if (table === 'sites') return !!role(row.id);
                if (table === 'catalog_items' && row.is_marketplace_listed) return true;
                if (table === 'companies') return !!user;
                return !!role(row.site_id);
              });
              return { data: data.map(row => Object.fromEntries(columns.split(',').map(field => [field, row[field] === undefined && field === 'image_url' ? null : row[field]]))) };
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
    'http://user:secret@localhost:54321', 'http://localhost:54321/api', 'http://localhost:54321/?x=1',
    'http://127.1:54321', 'http://2130706433:54321', 'file:///tmp'])('refuses unsafe origin %s', value => {
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
  it('recovers partial exact-owned inserts without retrying failures or duplicating identities', async () => {
    const db = database(), deps = dependencies(root, db);
    db.fail({ agents: true });
    // Inspection fails before relational writes; Auth identities already owned.
    await expect(provision(env, ['--apply'], deps)).rejects.toThrow('Cannot inspect agents');
    expect(db.authUsers).toHaveLength(5);
    expect(db.calls.filter(call => call.insertion)).toHaveLength(0);
    db.fail({});
    await expect(provision(env, ['--apply'], deps)).resolves.toMatchObject({ status: 'VERIFIED' });
    expect(db.authUsers).toHaveLength(5);
    expect(db.tables.sites).toHaveLength(2);
    const store = openStore(root, configuration(env));
    const item = plan(configuration(env)).rows.find(row => row.kind === 'product');
    // Model an interrupted insert: durable intent and exact persisted row.
    store.intent(item.kind, item.row);
    store.close();
    await expect(provision(env, ['--apply'], deps)).resolves.toMatchObject({ status: 'VERIFIED' });
    expect(db.tables.catalog_items).toHaveLength(3);
  });
  it('never resets a changed password or overwrites an incompatible shared bucket', async () => {
    const db = database(), deps = dependencies(root, db);
    await provision(env, ['--apply'], deps);
    const admin = db.authUsers[0];
    db.passwords[admin.id] = 'changed-password';
    await expect(provision(env, ['--apply'], deps)).rejects.toThrow('login');
    db.passwords[admin.id] = read(root, 'journal.json').credentials.admin;
    db.buckets[0].public = false;
    await expect(provision(env, ['--apply'], deps)).rejects.toThrow('Incompatible');
    expect(db.buckets[0].public).toBe(false);
  });
  it('normalizes accounting keys to the bootstrap guard without changing code or deterministic ID', () => {
    for (const id of ['qa-unit', 'qa-1793126113145-a4b7d0d6', `qa-${'a'.repeat(60)}`]) {
      const row = plan(configuration({ ...env, QA_ENVIRONMENT_ID: id })).rows.find(item => item.kind === 'expense-account').row;
      expect(row.key).toMatch(/^[A-Za-z][A-Za-z0-9_]{0,63}$/);
      expect(row.code).toBe(id);
      expect(row.key).toBe(id.replace(/-/g, '_'));
    }
  });
  it('sets only owned QA profiles to English through public sessions and rejects later drift without consent', async () => {
    const db = database(), deps = dependencies(root, db);
    db.tables.profiles = [{ id: 'real-account', email: 'real@example.test', language: 'es' }];
    await provision(env, ['--apply'], deps);
    expect(db.tables.profiles.filter(row => row.id !== 'real-account').every(row => row.language === 'en')).toBe(true);
    expect(db.tables.profiles[0].language).toBe('es');
    expect(db.calls.filter(call => call.update).every(call => !call.privileged && call.table === 'profiles')).toBe(true);
    const journal = read(root, 'journal.json');
    expect(journal.entries['profile:admin'].status).toBe('verified');
    db.tables.profiles[1].language = 'es';
    await expect(provision(env, ['--apply'], deps)).rejects.toThrow('drift');
    await expect(provision({ ...env, QA_ALLOW_SMOKE_ADJUSTMENTS: '1' }, ['--apply'], deps)).resolves.toMatchObject({ status: 'VERIFIED' });
  });
  it('uses a real repository static image and requires consent plus exact old fingerprints for existing products', async () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../public/images/logo.png'))).toBe(true);
    const db = database(), deps = dependencies(root, db);
    await provision(env, ['--apply'], deps);
    const config = configuration(env), battery = plan(config);
    const store = openStore(root, config);
    for (const item of battery.rows.filter(item => item.table === 'catalog_items')) {
      const legacy = { ...item.row }; delete legacy.image_url;
      store.state.entries[item.kind] = { fingerprint: fingerprint(legacy), status: 'verified' };
      db.tables.catalog_items.find(row => row.id === item.row.id).image_url = null;
    }
    // Reproduce a previously verified run whose profile trigger defaulted to es.
    for (const user of battery.users) {
      delete store.state.entries[`profile:${user.role}`];
      db.tables.profiles.find(row => row.id === user.id).language = 'es';
    }
    store.save(); store.close();
    await expect(provision(env, ['--apply'], deps)).rejects.toThrow('QA_ALLOW_SMOKE_ADJUSTMENTS');
    const before = db.calls.filter(call => call.update).length;
    await expect(provision({ ...env, QA_ALLOW_SMOKE_ADJUSTMENTS: '1' }, ['--apply'], deps)).resolves.toMatchObject({ status: 'VERIFIED' });
    expect(db.calls.filter(call => call.update).length - before).toBe(8);
    expect(db.tables.catalog_items.every(row => row.image_url === '/images/logo.png')).toBe(true);
    expect(read(root, 'journal.json').entries['adjust-image:product'].status).toBe('verified');
    await provision(env, ['--apply'], deps);
    expect(db.calls.filter(call => call.update).length - before).toBe(8);
  });
  it('rejects custom images even when the legacy row fingerprint and adjustment consent match', async () => {
    const db = database(), deps = dependencies(root, db);
    await provision(env, ['--apply'], deps);
    const config = configuration(env), battery = plan(config), store = openStore(root, config);
    const item = battery.rows.find(item => item.kind === 'product');
    const legacy = { ...item.row }; delete legacy.image_url;
    store.state.entries.product = { fingerprint: fingerprint(legacy), status: 'verified' }; store.save();
    db.tables.catalog_items[0].image_url = 'https://custom.invalid/image.png';
    await expect(adjustImages(config, battery, store, key => db.createClient(config.url, key, {}), true)).rejects.toThrow('custom image');
    expect(db.tables.catalog_items[0].image_url).toBe('https://custom.invalid/image.png');
    store.close();
  });
  it('resumes only a durable matching image adjustment and refuses unrelated catalog drift', async () => {
    const db = database(), deps = dependencies(root, db);
    await provision(env, ['--apply'], deps);
    const config = configuration(env), battery = plan(config), store = openStore(root, config);
    const item = battery.rows.find(item => item.kind === 'product');
    const legacy = { ...item.row }; delete legacy.image_url;
    store.state.entries.product = { fingerprint: fingerprint(legacy), status: 'verified' }; store.save();
    const makeClient = key => db.createClient(config.url, key, {});
    await expect(adjustImages(config, battery, store, makeClient, true)).rejects.toThrow('Unjournaled');
    const adjustment = { previousFingerprint: fingerprint(legacy), fingerprint: fingerprint(item.row), id: item.row.id, image_url: '/images/logo.png' };
    store.intent('adjust-image:product', adjustment);
    db.tables.catalog_items[0].name = 'changed-name';
    await expect(adjustImages(config, battery, store, makeClient, true)).rejects.toThrow('drift');
    db.tables.catalog_items[0].name = item.row.name;
    const writes = db.calls.filter(call => call.update).length;
    await adjustImages(config, battery, store, makeClient, true);
    expect(db.calls.filter(call => call.update)).toHaveLength(writes);
    expect(store.owns('product', item.row)).toBe(true);
    expect(store.state.entries['adjust-image:product'].status).toBe('verified');
    store.close();
  });
  it('resumes a failed legacy expense insert only after fresh absence checks and journals the repair', async () => {
    const config = configuration(env), battery = plan(config), db = database();
    const legacyBattery = plan(config);
    const legacyItem = legacyBattery.rows.find(item => item.kind === 'expense-account');
    legacyItem.row.key = config.id;
    const client = db.createClient(config.url, config.setupKey, {});
    const store = openStore(root, config);
    await expect(seedRows(client, legacyBattery, store)).rejects.toThrow('Setup insert failed in accounting_accounts');
    expect(db.tables.accounting_accounts).toBeUndefined();
    expect(store.state.entries['expense-account']).toEqual({ status: 'intent', fingerprint: fingerprint(legacyItem.row) });
    const priorInserts = db.calls.filter(call => call.insertion && call.table !== 'accounting_accounts').length;
    store.close();
    const resumed = openStore(root, config);
    await seedRows(client, battery, resumed);
    const expected = battery.rows.find(item => item.kind === 'expense-account').row;
    expect(db.tables.accounting_accounts).toEqual([expected]);
    expect(resumed.state.entries['expense-account']).toEqual({ status: 'verified', fingerprint: fingerprint(expected) });
    expect(resumed.state.events).toContainEqual(expect.objectContaining({ kind: 'expense-account-key-repair',
      previousFingerprint: fingerprint(legacyItem.row), fingerprint: fingerprint(expected) }));
    expect(db.calls.filter(call => call.insertion && call.table === 'sites')).toHaveLength(2);
    expect(priorInserts).toBeGreaterThan(0);
    const inserts = db.calls.filter(call => call.insertion).length;
    await seedRows(client, battery, resumed);
    expect(db.calls.filter(call => call.insertion)).toHaveLength(inserts);
    resumed.close();
  });
  it.each(['legacy-row', 'corrected-row', 'code-collision'])('never repairs/adopts an existing expense %s', async collision => {
    const config = configuration(env), battery = plan(config), db = database();
    const item = battery.rows.find(row => row.kind === 'expense-account');
    const legacy = { ...item.row, key: config.id };
    const store = openStore(root, config);
    store.intent(item.kind, legacy);
    db.tables.accounting_accounts = [{ ...(collision === 'legacy-row' ? legacy : item.row),
      ...(collision === 'code-collision' ? { id: 'foreign-id' } : {}) }];
    const client = db.createClient(config.url, config.setupKey, {});
    await expect(seedRows(client, battery, store)).rejects.toThrow(/collision/i);
    expect(store.state.entries[item.kind].fingerprint).toBe(fingerprint(legacy));
    expect(store.state.events).toHaveLength(0);
    expect(db.calls.filter(call => call.insertion)).toHaveLength(0);
    store.close();
  });
  it.each(['verified', 'different-fingerprint'])('refuses absent expense repair for %s journal state', async state => {
    const config = configuration(env), battery = plan(config), db = database();
    const item = battery.rows.find(row => row.kind === 'expense-account');
    const legacy = { ...item.row, key: config.id, ...(state === 'different-fingerprint' ? { label: 'different-label' } : {}) };
    const store = openStore(root, config);
    store.intent(item.kind, legacy);
    if (state === 'verified') store.done(item.kind);
    const original = { ...store.state.entries[item.kind] };
    const client = db.createClient(config.url, config.setupKey, {});
    await expect(seedRows(client, { ...battery, rows: [item] }, store)).rejects.toThrow('repair refused');
    expect(store.state.entries[item.kind]).toEqual(original);
    expect(db.calls.filter(call => call.insertion)).toHaveLength(0);
    store.close();
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
  it('accepts the actual bootstrap guard through read-only local psql, not remote URLs or shell interpolation', () => {
    const guard = "QA_RLS=9\nQA workflow webhook rejected: non-local destination\nwebhook_url !~ '^http://(127[.]0[.]0[.]1|localhost|host[.]docker[.]internal):[0-9]+/'";
    const run = jest.fn(() => ({ status: 0, stdout: guard }));
    const url = 'postgres://postgres:private-password@127.0.0.1:54322/postgres';
    expect(() => schemaPreflight({ QA_DATABASE_URL: url }, run)).not.toThrow();
    const [command, args, options] = run.mock.calls[0];
    expect(command).toBe('psql');
    expect(JSON.stringify(args)).not.toContain('private-password');
    expect(options.env.PGOPTIONS).toContain('default_transaction_read_only=on');
    expect(options.env.PGDATABASE).toBe(url);
    expect(args.at(-1)).toContain('ROLLBACK');
    expect(() => schemaPreflight({ QA_DB_CONTAINER: 'x; touch /tmp/unsafe' }, run)).toThrow('Apply requires');
    expect(run).toHaveBeenCalledTimes(1);
  });
});