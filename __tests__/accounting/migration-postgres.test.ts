/** @jest-environment node */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { buildPurchaseJournalDrafts, buildSaleJournalDrafts } from '@/app/accounting/builders'

// An isolated socket-only cluster, never a DATABASE_URL or a remote Supabase project.
const pgBin = process.env.ACCOUNTING_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin'
const enabled = existsSync(path.join(pgBin, 'initdb')) && existsSync(path.join(pgBin, 'pg_ctl'))
const pgEnv = { ...process.env, LC_ALL: 'C', LANG: 'C' }
const suite = enabled ? describe : describe.skip
const site = '11111111-1111-4111-8111-111111111111'
const otherSite = '22222222-2222-4222-8222-222222222222'
const sale = '33333333-3333-4333-8333-333333333333'
const company = '44444444-4444-4444-8444-444444444444'
const dimension = '55555555-5555-4555-8555-555555555555'
const owner = '66666666-6666-4666-8666-666666666666'
const collaborator = '77777777-7777-4777-8777-777777777777'
const marketing = '88888888-8888-4888-8888-888888888888'
const inactive = '99999999-9999-4999-8999-999999999999'
const key = `manual:${sale}`
const hash = 'a'.repeat(64)
const otherHash = 'b'.repeat(64)
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`
const json = (value: unknown) => `${quote(JSON.stringify(value))}::jsonb`
const header = (overrides = {}) => ({ entry_date: '2026-09-29T00:00:00.000Z', source_type: 'manual',
  source_id: null, idempotency_key: key, source_hash: hash, currency: 'USD', memo: 'Test journal', ...overrides })
const lines = [{ account_code: '1000', debit: 10, credit: 0 }, { account_code: '4000', debit: 0, credit: 10 }]
const save = (entry = header(), items: unknown = lines, id: string | null = null, expected: string | null = null, check = false) =>
  `SELECT public.accounting_save_journal('${site}', ${json(entry)}, ${json(items)}, ${id ? quote(id) : 'NULL'}, ${expected ? quote(expected) : 'NULL'}, ${check})`

suite('accounting migrations in disposable PostgreSQL', () => {
  let directory = ''
  let running = false
  const psqlArgs = () => ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55439', '-U', 'postgres', '-d', 'postgres']
  const db = (sql: string) => execFileSync(path.join(pgBin, 'psql'), psqlArgs(), {
    input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000, env: pgEnv,
  }).trim()
  const actor = (sql: string, user = owner, role = 'authenticated') =>
    `SET ROLE ${role}; SET request.jwt.claim.role = '${role}'; SET request.jwt.claim.sub = '${user}'; ${sql};`
  const call = (sql: string, user = owner, role = 'authenticated') => db(actor(sql, user, role))
  const service = (sql: string) => call(sql, owner, 'service_role')
  const rejects = (sql: string, text: string, user = owner, role = 'authenticated') => {
    expect(() => call(sql, user, role)).toThrow(text)
  }
  const sourceEntry = (overrides = {}) => header({ source_type: 'sale', source_id: sale, idempotency_key: `sale:${sale}`, ...overrides })
  const replace = (drafts: unknown, version = '2026-09-29T00:00:00Z', state = 'posted') =>
    `SELECT public.accounting_replace_source_journals('${site}', 'sale', '${sale}', ${json(drafts)}, '${version}', '${state}')`
  const refund = (id = 're_one', amount = 10, currency = 'USD') =>
    `SELECT public.accounting_record_sale_refund('${sale}', '${id}', ${amount}, '${currency}', '2026-09-29T01:00:00Z')`
  const concurrent = (sql: string) => new Promise<string>((resolve, reject) => {
    const child = spawn(path.join(pgBin, 'psql'), psqlArgs(), { stdio: ['pipe', 'pipe', 'pipe'], env: pgEnv })
    let output = ''; let error = ''
    child.stdout.on('data', data => { output += data })
    child.stderr.on('data', data => { error += data })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(error)))
    child.stdin.end(sql)
  })

  beforeAll(() => {
    // macOS tmpdir paths exceed PostgreSQL's Unix socket length limit.
    directory = mkdtempSync('/tmp/accounting-pg-')
    execFileSync(path.join(pgBin, 'initdb'), ['-D', path.join(directory, 'data'), '-U', 'postgres', '-A', 'trust', '--no-locale'], { stdio: 'pipe', env: pgEnv })
    try {
      execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(directory, 'data'), '-l', path.join(directory, 'server.log'),
        '-o', `-F -p 55439 -k ${directory} -c listen_addresses='' -c lc_messages=C`, '-w', 'start'], { stdio: 'pipe', env: pgEnv })
    } catch {
      throw new Error(readFileSync(path.join(directory, 'server.log'), 'utf8'))
    }
    running = true
    db(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      CREATE TABLE sites (id uuid PRIMARY KEY, user_id uuid);
      CREATE TABLE site_ownership (site_id uuid, user_id uuid);
      CREATE TABLE site_members (site_id uuid, user_id uuid, role text, status text);
      CREATE TABLE companies (id uuid PRIMARY KEY);
      ${['locations','leads','campaigns','segments','catalog_items','catalog_categories'].map(table =>
        `CREATE TABLE ${table} (id uuid PRIMARY KEY, site_id uuid REFERENCES sites);`).join('\n')}
      CREATE TABLE accounting_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid REFERENCES sites,
        code text, key text, type text, label text, system boolean, active boolean,
        created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(site_id,code));
      CREATE TABLE journal_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid REFERENCES sites,
        entry_date timestamptz, memo text, source_type text, source_id uuid, idempotency_key text, source_hash text,
        currency text, status text DEFAULT 'posted', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
        UNIQUE(site_id,idempotency_key));
      CREATE TABLE journal_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entry_id uuid REFERENCES journal_entries ON DELETE CASCADE,
        account_code text, debit numeric, credit numeric, created_at timestamptz DEFAULT now(),
        location_id uuid REFERENCES locations, lead_id uuid REFERENCES leads, campaign_id uuid REFERENCES campaigns,
        segment_id uuid REFERENCES segments, catalog_item_id uuid REFERENCES catalog_items,
        catalog_category_id uuid REFERENCES catalog_categories, company_id uuid REFERENCES companies);
      ${['sales','transactions','purchases'].map(table => `CREATE TABLE ${table} (id uuid PRIMARY KEY, site_id uuid REFERENCES sites,
        amount numeric, amount_due numeric, payments jsonb, currency text, company_id uuid, vendor_company_id uuid,
        sale_order_id uuid, accounting_state text DEFAULT 'pending', updated_at timestamptz, status text,
        title text, purchase_date date, sale_date date, location_id uuid, notes text, last_emailed_at timestamptz);`).join('\n')}
      CREATE TABLE sale_orders (id uuid PRIMARY KEY, site_id uuid, sale_id uuid, tax_total numeric);
      CREATE TABLE sale_order_items (id uuid PRIMARY KEY, sale_order_id uuid, site_id uuid, catalog_item_id uuid);
      CREATE TABLE purchase_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid, site_id uuid, subtotal numeric,
        catalog_item_id uuid, name text, quantity numeric, unit_cost numeric);
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
      CREATE POLICY historical_journal_all ON journal_entries FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY historical_lines_all ON journal_lines FOR ALL USING (true) WITH CHECK (true);
    `)
    // Use the real capability matrix, omitting unrelated remote_instances DDL.
    const roleMigration = readFileSync(path.join(process.cwd(), 'supabase/migrations/20260825160000_fix_site_role_and_delete_caps.sql'), 'utf8')
    db(roleMigration.split('DROP POLICY IF EXISTS')[0])
    const folder = path.join(process.cwd(), 'supabase/migrations')
    for (const name of readdirSync(folder).filter(name => /^2026092922\d{4}_accounting_.*\.sql$/.test(name)).sort()) {
      db(readFileSync(path.join(folder, name), 'utf8'))
    }
  }, 30000)

  afterAll(() => {
    if (running) execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(directory, 'data'), '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe', env: pgEnv })
    if (directory) rmSync(directory, { recursive: true, force: true })
  })

  beforeEach(() => db(`
    TRUNCATE sites, companies, site_members, site_ownership, sale_orders, sale_order_items, purchase_items CASCADE;
    INSERT INTO sites VALUES ('${site}', '${owner}'), ('${otherSite}', '${otherSite}');
    INSERT INTO site_members VALUES ('${site}','${collaborator}','collaborator','active'),
      ('${site}','${marketing}','marketing','active'), ('${site}','${inactive}','admin','inactive');
    INSERT INTO companies VALUES ('${company}');
    INSERT INTO locations VALUES ('${dimension}', '${otherSite}');
    INSERT INTO accounting_accounts(site_id, code, type, label, key, system, active) VALUES
      ('${site}', '1000','asset','Cash',NULL,true,true), ('${site}','4000','income','Revenue','revenue',true,true),
      ('${site}', '5100','expense','Custom','custom',false,true), ('${otherSite}','9999','expense','Foreign',NULL,false,true);
    INSERT INTO sales(id, site_id, amount, amount_due, payments, currency, updated_at, company_id)
      VALUES ('${sale}', '${site}', 100, 0, '[{"amount":100}]', 'USD', '2026-09-29T00:00:00Z', '${company}');
  `))

  it('accepts owner/collaborator writes and denies anonymous, marketing, inactive and cross-tenant callers', () => {
    expect(call(save(), collaborator)).toMatch(/^[0-9a-f-]{36}$/)
    rejects(save(), 'Accounting write is not authorized', marketing)
    rejects(save(), 'Accounting write is not authorized', inactive)
    rejects(save(), 'Accounting write is not authorized', otherSite)
    rejects(save(), 'permission denied', owner, 'anon')
    expect(call('SELECT count(*) FROM journal_entries', otherSite)).toBe('0')
    expect(call('SELECT count(*) FROM journal_entries', marketing)).toBe('1')
  })

  it('revokes direct DML and private/generated RPC access even for authenticated owners', () => {
    rejects("INSERT INTO journal_entries DEFAULT VALUES", 'permission denied')
    rejects("INSERT INTO journal_lines DEFAULT VALUES", 'permission denied')
    rejects(replace([]), 'permission denied')
    rejects(refund(), 'permission denied')
    rejects(`SELECT accounting_save_journal_internal('${site}', '{}', '[]', NULL, NULL, false, true)`, 'permission denied')
    expect(() => service('DELETE FROM journal_entries')).toThrow('permission denied')
    rejects(save(sourceEntry()), 'Standalone journals must be manual or opening')
  })

  it.each([
    ['unbalanced', [{ ...lines[0], debit: 9 }, lines[1]], 'balance exactly'],
    ['fractional cent', [{ ...lines[0], debit: 10.001 }, lines[1]], 'two-decimal'],
    ['negative', [{ ...lines[0], debit: -10 }, lines[1]], 'two-decimal'],
    ['double-sided', [{ ...lines[0], credit: 10 }, lines[1]], 'two-decimal'],
    ['zero', [{ ...lines[0], debit: 0 }, lines[1]], 'two-decimal'],
    ['oversized', [{ ...lines[0], debit: 1000000000001 }, lines[1]], 'two-decimal'],
    ['non-finite', [{ ...lines[0], debit: 'NaN' }, lines[1]], 'Invalid journal line'],
    ['missing', [{ account_code: '1000', credit: 0 }, lines[1]], 'Invalid journal line'],
    ['single line', [lines[0]], '2 to 500'],
    ['too many', Array(501).fill(lines[0]), '2 to 500'],
    ['wrong type', {}, 'must be an array'],
    ['cross-tenant account', [{ ...lines[0], account_code: '9999' }, lines[1]], 'not found in this site'],
  ])('rejects %s without a partial header', (_label, items, error) => {
    rejects(save(header(), items), error as string)
    expect(db('SELECT count(*) FROM journal_entries')).toBe('0')
  })

  it('enforces UTC dates, currency, source identity and unsupported manual dimensions', () => {
    rejects(save(header({ currency: 'usd' })), 'Invalid journal header fields')
    rejects(save(header({ entry_date: '2026-09-29T02:00:00+02:00' })), 'Invalid journal header fields')
    rejects(save(header({ source_id: sale })), 'Invalid or unauthorized journal source')
    rejects(save(header({ source_type: 'opening', idempotency_key: `opening:${otherSite}` })), 'Invalid journal header fields')
    rejects(save(header(), [{ ...lines[0], company_id: company }, lines[1]]), 'do not accept dimensions')
  })

  it('preserves identity, rejects lost updates and rolls back an invalid replacement', () => {
    const id = call(save())
    rejects(save(header({ source_hash: otherHash }), lines, id), 'Journal changed')
    rejects(save(header({ source_hash: otherHash }), lines, id, otherHash, true), 'Journal changed')
    rejects(save(header({ currency: 'EUR' }), lines, id, hash, true), 'currency cannot change')
    rejects(save(header({ idempotency_key: `manual:${company}` }), lines, id, hash, true), 'identity is immutable')
    rejects(save(header({ source_hash: otherHash }), [lines[0]], id, hash, true), '2 to 500')
    expect(db(`SELECT source_hash FROM journal_entries WHERE id='${id}'`)).toBe(hash)
    expect(db(`SELECT count(*) FROM journal_lines WHERE entry_id='${id}'`)).toBe('2')
    expect(call(save(header({ source_hash: otherHash, memo: 'Edited' }), lines, id, hash, true))).toBe(id)
  })

  it('requires active accounts except for the unchanged existing amount multiset', () => {
    const custom = [{ ...lines[0], account_code: '5100' }, lines[1]]
    const id = call(save(header(), custom))
    call("UPDATE accounting_accounts SET active=false WHERE code='5100'")
    expect(call(save(header({ memo: 'Preserve archived amounts', source_hash: otherHash }), custom, id, hash, true))).toBe(id)
    rejects(save(header({ idempotency_key: `manual:${company}` }), custom), 'Inactive account amounts')
    rejects(save(header(), [{ ...custom[0], debit: 11 }, { ...custom[1], credit: 11 }], id, otherHash, true), 'Inactive account amounts')
    rejects(save(header(), lines, id, otherHash, true), 'Inactive account amounts cannot be removed')
  })

  it('protects system and referenced classifications, tenant identity and unique keys', () => {
    call(save())
    rejects("UPDATE accounting_accounts SET type='expense' WHERE code='4000'", 'classification is immutable')
    rejects("UPDATE accounting_accounts SET active=false WHERE code='1000'", 'must remain active')
    rejects(`UPDATE accounting_accounts SET site_id='${otherSite}' WHERE code='5100'`, 'identity is immutable')
    rejects("DELETE FROM accounting_accounts WHERE code='1000'", 'cannot be deleted')
    rejects(`INSERT INTO accounting_accounts(site_id,code,key,type,label,system,active) VALUES ('${site}','5999','custom','expense','Other',false,true)`, 'duplicate key')
  })

  it('deletes only manual entries with delete capability and reports missing records', () => {
    const id = call(save())
    rejects(`SELECT accounting_delete_manual_journal('${site}','${id}')`, 'not authorized', collaborator)
    call(`SELECT accounting_delete_manual_journal('${site}','${id}')`)
    expect(db('SELECT count(*) FROM journal_lines')).toBe('0')
    rejects(`SELECT accounting_delete_manual_journal('${site}','${id}')`, 'Journal not found')
  })

  it('atomically posts, keeps matching line IDs, updates source currency and unpublishes', () => {
    const drafts = [{ entry: sourceEntry(), lines }]
    service(replace(drafts))
    const id = db('SELECT id FROM journal_entries')
    const lineIds = db('SELECT id FROM journal_lines ORDER BY id')
    const version = db(`SELECT updated_at FROM sales WHERE id='${sale}'`)
    service(replace(drafts, version))
    expect(db('SELECT id FROM journal_lines ORDER BY id')).toBe(lineIds)
    service(replace([{ entry: sourceEntry({ currency: 'EUR', source_hash: otherHash }), lines }], version))
    expect(db('SELECT id FROM journal_entries')).toBe(id)
    expect(db('SELECT currency FROM journal_entries')).toBe('EUR')
    service(replace([], db(`SELECT updated_at FROM sales WHERE id='${sale}'`), 'unpublished'))
    expect(db('SELECT count(*) FROM journal_entries')).toBe('0')
    expect(db('SELECT accounting_state FROM sales')).toBe('unpublished')
  })

  it('rejects stale sources, wrong ownership, duplicate keys and invalid later drafts without partial posting', () => {
    rejects(replace([{ entry: sourceEntry(), lines }], '2020-01-01'), 'source changed', owner, 'service_role')
    rejects(replace([{ entry: sourceEntry({ source_id: company }), lines }]), 'does not belong', owner, 'service_role')
    rejects(replace([{ entry: sourceEntry(), lines }, { entry: sourceEntry(), lines }]), 'duplicate source', owner, 'service_role')
    rejects(replace([{ entry: sourceEntry(), lines }, { entry: sourceEntry({ idempotency_key: `sale:${sale}:refund` }), lines: [lines[0]] }]), '2 to 500', owner, 'service_role')
    expect(db('SELECT count(*) FROM journal_entries')).toBe('0')
    expect(db('SELECT accounting_state FROM sales')).toBe('pending')
  })

  it('enforces tenant-owned dimensions and global company equality to the locked source', () => {
    rejects(replace([{ entry: sourceEntry(), lines: [{ ...lines[0], location_id: dimension }, lines[1]] }]), 'dimension for this site', owner, 'service_role')
    rejects(replace([{ entry: sourceEntry(), lines: [{ ...lines[0], company_id: otherSite }, lines[1]] }]), 'Company dimension must match', owner, 'service_role')
    service(replace([{ entry: sourceEntry(), lines: lines.map(line => ({ ...line, company_id: company })) }]))
    expect(db('SELECT count(*) FROM journal_lines')).toBe('2')
  })

  it('invalidates source revisions for legacy payment updates and preserves deliberate unpublication', () => {
    service(replace([{ entry: sourceEntry(), lines }]))
    const version = db('SELECT updated_at FROM sales')
    db(`UPDATE sales SET payments='[{"amount":90}]'`)
    expect(db('SELECT accounting_state FROM sales')).toBe('pending')
    rejects(replace([], version), 'source changed', owner, 'service_role')
    db("UPDATE sales SET accounting_state='unpublished'; UPDATE sales SET amount=90")
    expect(db('SELECT accounting_state FROM sales')).toBe('unpublished')
  })

  it('invalidates source snapshots on order tax, sale item and purchase item changes', () => {
    db(`INSERT INTO sale_orders VALUES ('${company}', '${site}', '${sale}', 0)`)
    let version = db('SELECT updated_at FROM sales')
    service(replace([{ entry: sourceEntry(), lines }], version))
    version = db('SELECT updated_at FROM sales')
    db('UPDATE sale_orders SET tax_total=2')
    expect(db('SELECT accounting_state FROM sales')).toBe('pending')
    rejects(replace([], version), 'source changed', owner, 'service_role')
    version = db('SELECT updated_at FROM sales')
    db(`INSERT INTO sale_order_items VALUES ('${dimension}', '${company}', '${site}', NULL)`)
    expect(db('SELECT updated_at FROM sales')).not.toBe(version)
    db(`INSERT INTO purchases(id,site_id,amount,currency,accounting_state,updated_at)
      VALUES ('${sale}','${site}',10,'USD','posted','2026-09-29T00:00:00Z');
      INSERT INTO purchase_items(id,purchase_id,site_id,subtotal) VALUES ('${dimension}','${sale}','${site}',10)`)
    expect(db('SELECT accounting_state FROM purchases')).toBe('pending')
  })

  it('records refund receipts exactly once, rejects conflicts and caps actual cash received', () => {
    service(refund())
    const version = db('SELECT updated_at FROM sales')
    service(refund())
    expect(db('SELECT count(*) FROM accounting_sale_refunds')).toBe('1')
    expect(db('SELECT updated_at FROM sales')).toBe(version)
    rejects(refund('re_one', 11), 'conflicts', owner, 'service_role')
    rejects(refund('re_two', 91), 'exceed recorded', owner, 'service_role')
    rejects(refund('re_two', 1, 'EUR'), 'currency does not match', owner, 'service_role')
    expect(call('SELECT count(*) FROM accounting_sale_refunds', otherSite)).toBe('0')
    db(`UPDATE sales SET amount=50, payments='[{"amount":100}]'`)
    service(refund('re_two', 90))
    expect(db('SELECT sum(amount) FROM accounting_sale_refunds')).toBe('100')
  })

  it('serializes concurrent opening inserts and refund deliveries', async () => {
    const opening = header({ source_type: 'opening', idempotency_key: `opening:${site}` })
    const outcomes = await Promise.allSettled([concurrent(actor(save(opening, lines, null, null, true))), concurrent(actor(save(opening, lines, null, null, true)))])
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(db('SELECT count(*) FROM journal_entries')).toBe('1')
    await Promise.all([concurrent(actor(refund(), owner, 'service_role')), concurrent(actor(refund(), owner, 'service_role'))])
    expect(db('SELECT count(*) FROM accounting_sale_refunds')).toBe('1')
  })

  it('rejects a legacy implicit overpayment without changing the source or items', () => {
    db(`INSERT INTO purchases(id,site_id,title,status,amount,amount_due,payments,currency,purchase_date,updated_at)
      VALUES ('${sale}','${site}','Legacy bill','completed',100,0,'[]','USD','2026-09-29','2026-09-29');
      INSERT INTO purchase_items(purchase_id,site_id,name,quantity,unit_cost,subtotal)
      VALUES ('${sale}','${site}','Original item',1,100,100)`)
    const before = db('SELECT to_jsonb(purchases) FROM purchases')
    const itemsBefore = db('SELECT to_jsonb(purchase_items) FROM purchase_items')
    const version = db('SELECT updated_at FROM purchases')
    const items = [{ name: 'Reduced item', quantity: 1, unit_cost: 60, subtotal: 60 }]
    rejects(`SELECT accounting_update_purchase_items('${site}','${sale}','${version}',${json(items)},'{}')`,
      'Legacy purchase payment receipts require review')
    expect(db('SELECT to_jsonb(purchases) FROM purchases')).toBe(before)
    expect(db('SELECT to_jsonb(purchase_items) FROM purchase_items')).toBe(itemsBefore)
  })

  it('replaces purchase header/items atomically, preserves paid amounts and rejects stale or foreign writes', () => {
    db(`INSERT INTO purchases(id,site_id,title,status,amount,amount_due,payments,currency,purchase_date,updated_at)
      VALUES ('${sale}','${site}','Bill','pending',100,70,'[]','USD','2026-09-29','2026-09-29');
      INSERT INTO purchase_items(purchase_id,site_id,name,quantity,unit_cost,subtotal)
      VALUES ('${sale}','${site}','Existing',1,100,100)`)
    const version = db('SELECT updated_at FROM purchases')
    const item = { name: 'Replacement', quantity: 2, unit_cost: 40, subtotal: 80, catalog_item_id: null }
    const update = (items: unknown, patch: unknown = { title: 'Edited' }, revision = version) =>
      `SELECT accounting_update_purchase_items('${site}','${sale}','${revision}',${json(items)},${json(patch)})`
    rejects(update([item]), 'not authorized', marketing)
    rejects(update([item]), 'not authorized', otherSite)
    rejects(update([{ ...item, subtotal: 20 }]), 'subtotal does not match')
    rejects(update([item], { amount: 20 }), 'Invalid item count or purchase update fields')
    rejects(update([item], { location_id: dimension }), 'location not found in this site')
    expect(db('SELECT name FROM purchase_items')).toBe('Existing')
    expect(db('SELECT amount FROM purchases')).toBe('100')
    // A late insertion failure must restore items deleted earlier in the RPC.
    db("ALTER TABLE purchase_items ADD CONSTRAINT test_failure CHECK (name <> 'Fail insertion')")
    rejects(update([{ ...item, name: 'Fail insertion' }]), 'test_failure')
    expect(db('SELECT name FROM purchase_items')).toBe('Existing')
    expect(db('SELECT updated_at FROM purchases')).toBe(version)
    db('ALTER TABLE purchase_items DROP CONSTRAINT test_failure')
    call(update([item]))
    expect(db('SELECT title FROM purchases')).toBe('Edited')
    expect(db('SELECT amount_due FROM purchases')).toBe('50.00')
    expect(db('SELECT name FROM purchase_items')).toBe('Replacement')
    expect(db('SELECT accounting_state FROM purchases')).toBe('pending')
    rejects(update([item]), 'Purchase changed')
  })

  it('retains source, journals and publication state when a linked refund prevents deletion', () => {
    service(replace([{ entry: sourceEntry(), lines }]))
    service(refund())
    const oldState = db('SELECT to_jsonb(sales) FROM sales')
    rejects(`SELECT accounting_delete_source('${site}','sale','${sale}')`, 'retained for audit')
    expect(db('SELECT count(*) FROM journal_entries')).toBe('1')
    expect(db('SELECT count(*) FROM journal_lines')).toBe('2')
    expect(db('SELECT to_jsonb(sales) FROM sales')).toBe(oldState)
  })

  it('rolls back both journal deletions on a late source FK failure and authorizes deletion', () => {
    service(replace([{ entry: sourceEntry(), lines }]))
    db(`CREATE TABLE test_source_reference (sale_id uuid REFERENCES sales(id)); INSERT INTO test_source_reference VALUES ('${sale}')`)
    const remove = `SELECT accounting_delete_source('${site}','sale','${sale}')`
    rejects(remove, 'not authorized', collaborator)
    rejects(remove, 'not authorized', marketing)
    rejects(remove, 'foreign key constraint')
    expect(db('SELECT count(*) FROM journal_entries')).toBe('1')
    expect(db('SELECT count(*) FROM journal_lines')).toBe('2')
    db('DROP TABLE test_source_reference')
    call(remove)
    expect(db('SELECT count(*) FROM sales')).toBe('0')
    expect(db('SELECT count(*) FROM journal_entries')).toBe('0')
  })

  it('rejects a collaborator reverting paid or posted purchases to draft before any history changes', () => {
    db(`INSERT INTO purchases(id,site_id,status,amount,amount_due,payments,currency,accounting_state,updated_at)
      VALUES ('${sale}','${site}','completed',100,0,'[]','USD','posted','2026-09-29')`)
    rejects(`UPDATE purchases SET status='draft' WHERE id='${sale}'`, 'cannot return to draft', collaborator)
    expect(db('SELECT status FROM purchases')).toBe('completed')
    expect(db('SELECT accounting_state FROM purchases')).toBe('posted')
  })

  it('preserves legacy inferred cash when a new dated payment is registered, then builds every posting', () => {
    db(`INSERT INTO purchases(id,site_id,status,amount,amount_due,payments,currency,purchase_date,updated_at)
      VALUES ('${sale}','${site}','pending',100,50,'[]','USD','2026-08-01','2026-08-01')`)
    const receipt = { id: 'p_new', amount: 50, date: '2026-09-01', method: 'cash' }
    call(`UPDATE purchases SET payments=${json([receipt])}, amount_due=0 WHERE id='${sale}'`)
    const row = JSON.parse(db('SELECT to_jsonb(purchases) FROM purchases'))
    expect(row.payments).toEqual([expect.objectContaining({ amount: 50, date: '2026-08-01', legacy_inferred: true }), receipt])
    const drafts = buildPurchaseJournalDrafts(row)
    expect(drafts.map(draft => draft.entry.entryDate)).toEqual(['2026-08-01','2026-08-01','2026-09-01'])
    call(`UPDATE purchases SET payments=${json([receipt])} WHERE id='${sale}'`)
    expect(JSON.parse(db('SELECT payments FROM purchases'))).toHaveLength(2)
  })

  it('preserves a partially documented sale balance on its first new receipt', () => {
    db(`DELETE FROM sales; INSERT INTO sales(id,site_id,sale_date,status,amount,amount_due,payments,currency,updated_at)
      VALUES ('${sale}','${site}','2026-08-01','pending',100,50,NULL,'USD','2026-08-01')`)
    const receipt = { id: 'sale-receipt', amount: 50, date: '2026-09-01' }
    call(`UPDATE sales SET amount_due=0,payments=${json([receipt])} WHERE id='${sale}'`)
    const row = JSON.parse(db('SELECT to_jsonb(sales) FROM sales'))
    expect(row.payments[0]).toMatchObject({ amount: 50, legacy_inferred: true, date: '2026-08-01' })
    expect(buildSaleJournalDrafts(row,null).map(draft => draft.entry.entryDate)).toEqual(['2026-08-01','2026-08-01','2026-09-01'])
  })

  it('does not invalidate posted accounting for email timestamps, but still invalidates amounts', () => {
    db(`ALTER TABLE sale_orders ADD COLUMN IF NOT EXISTS last_emailed_at timestamptz;
      INSERT INTO sale_orders(id,site_id,sale_id,tax_total) VALUES ('${company}','${site}','${sale}',0)`)
    service(replace([{ entry: sourceEntry(), lines }], db('SELECT updated_at FROM sales')))
    db('UPDATE sale_orders SET last_emailed_at=now(); UPDATE sales SET last_emailed_at=now()')
    expect(db('SELECT accounting_state FROM sales')).toBe('posted')
    db('UPDATE sale_orders SET tax_total=1')
    expect(db('SELECT accounting_state FROM sales')).toBe('pending')
  })

  it('blocks reports for a legacy opening with unknown currency rather than silently excluding it', () => {
    // Reproduce a pre-migration opening row; NOT VALID intentionally preserves old data.
    db(`ALTER TABLE journal_entries DROP CONSTRAINT accounting_entry_currency_valid;
      INSERT INTO journal_entries(site_id,entry_date,source_type,idempotency_key,currency)
      VALUES ('${site}','2026-01-01','opening','opening:${site}',NULL);
      ALTER TABLE journal_entries ADD CONSTRAINT accounting_entry_currency_valid CHECK(currency IS NOT NULL AND currency ~ '^[A-Z]{3}$') NOT VALID`)
    rejects(`SELECT accounting_report_snapshot('${site}',NULL,'2026-09-30','USD',true)`, 'ACCOUNTING_UNKNOWN_CURRENCY')
    rejects(`SELECT accounting_report_snapshot('${site}',NULL,'2026-09-30','USD',true)`, 'access denied', otherSite)
  })

  it('returns all aggregates from one statement snapshot while another connection updates a journal', async () => {
    const id = call(save())
    const query = `SELECT accounting_report_snapshot('${site}',NULL,'2026-09-30','USD',true)`
    const reader = concurrent(actor(`WITH barrier AS MATERIALIZED (SELECT pg_sleep(0.3)) ${query} FROM barrier`))
    await new Promise(resolve => setTimeout(resolve, 70))
    const changed = lines.map(line => ({ ...line, debit: line.debit * 2, credit: line.credit * 2 }))
    call(save(header({ source_hash: otherHash }), changed, id, hash, true))
    expect(JSON.parse(await reader)).toMatchObject({ '1000': { debit: 10 }, '4000': { credit: 10 } })
    expect(JSON.parse(call(query))).toMatchObject({ '1000': { debit: 20 }, '4000': { credit: 20 } })
  })

  it('aggregates more than the Data API row cap without losing lines or mixing currencies', () => {
    db(`WITH entries AS (
      INSERT INTO journal_entries(site_id,entry_date,source_type,idempotency_key,currency)
      SELECT '${site}','2026-09-29','manual','bulk:'||n,CASE WHEN n=1002 THEN 'EUR' ELSE 'USD' END
      FROM generate_series(1,1002) n RETURNING id
    ) INSERT INTO journal_lines(entry_id,account_code,debit,credit)
      SELECT id,code,debit,credit FROM entries CROSS JOIN (VALUES ('1000',1,0),('4000',0,1)) v(code,debit,credit)`)
    const result = JSON.parse(call(`SELECT accounting_report_snapshot('${site}',NULL,'2026-09-30','USD',true)`))
    expect(result).toEqual({ '1000': { debit: 1001, credit: 0 }, '4000': { debit: 0, credit: 1001 } })
    expect(db('SELECT count(*) FROM journal_lines')).toBe('2004')
  })
})