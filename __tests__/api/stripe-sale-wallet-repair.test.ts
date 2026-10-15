/** @jest-environment node */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

const pgBin = process.env.STRIPE_REPAIR_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin'
const available = ['initdb', 'pg_ctl', 'psql'].every(file => existsSync(path.join(pgBin, file)))
const suite = available ? describe : describe.skip
const pgEnv = { ...process.env, LC_ALL: 'C', LANG: 'C' }
const migration = readFileSync(path.join(process.cwd(), 'supabase/migrations/20261014220100_repair_stripe_sale_wallet_currency.sql'), 'utf8')
const original = readFileSync(path.join(process.cwd(), 'supabase/migrations/20260917210300_stripe_settlement_effect_execution.sql'), 'utf8')
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`
const site = uuid(1), sale = uuid(2), order = uuid(3), expense = uuid(4)
const grossId = `sale_${sale}_${order}`, commissionId = `commission_${sale}_${order}`
const session = 'cs_test_repair'
const evidence = { source: 'resolveStripeSaleWalletAmount', project: 'abcdefghijklmnopqrst', mode: 'test',
  site_id: site, session_id: session, sale_id: sale, payment_intent_id: 'pi_test_repair',
  checkout_amount_minor: 16400, checkout_currency: 'mxn', usd_amount_minor: 830, captured_at: '2026-10-14T00:00:00Z' }

describe('Stripe sale wallet repair migration contract', () => {
  it('is forward-only, service-only, default preview, with settlement-compatible locks', () => {
    expect(migration.trim().startsWith('BEGIN;')).toBe(true)
    expect(migration.trim().endsWith('COMMIT;')).toBe(true)
    expect(migration).toContain('p_apply boolean DEFAULT false')
    expect(migration).toContain('SET search_path = public, pg_temp')
    expect(migration).toContain('FROM PUBLIC, anon, authenticated;')
    expect(migration).toContain('TO service_role;')
    const locks = ['INTO STRICT v_effect', 'INTO STRICT v_sale', "pg_advisory_xact_lock(hashtextextended('stripe-billing:'", 'INTO STRICT v_billing', 'FOR v_payment IN']
      .map(fragment => migration.indexOf(fragment))
    expect(locks.every((position, i) => position > 0 && (!i || position > locks[i - 1]))).toBe(true)
    expect(migration).toContain('account_balance = account_balance + v_delta')
    expect(migration).not.toMatch(/SET\s+credits_available|INSERT INTO public\.journal|UPDATE public\.sales|UPDATE public\.stripe_sale_checkout_effects/)
  })
})

suite('Stripe sale wallet repair in disposable PostgreSQL', () => {
  let directory = ''
  const connection = () => ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55443', '-U', 'postgres', '-d', 'postgres']
  const db = (sql: string) => execFileSync(path.join(pgBin, 'psql'), connection(),
    { input: sql, encoding: 'utf8', stdio: 'pipe', timeout: 20000, env: pgEnv }).trim()
  const call = (apply = false, overrides: { site?: string; gross?: number; commission?: number; currency?: string; minor?: string; evidence?: object } = {}) =>
    `SELECT public.repair_stripe_sale_wallet_currency('${overrides.site || site}', '${session}',
      ${overrides.gross ?? 164}, ${overrides.commission ?? 8.2}, '${overrides.currency || 'MXN'}',
      ${overrides.minor || '830'}, '${JSON.stringify(overrides.evidence || evidence)}'::jsonb, ${apply});`
  const actor = (sql: string, role = 'service_role') => db(`SET ROLE ${role}; ${sql}`)
  const state = () => JSON.parse(db(`SELECT jsonb_build_object(
    'balance', (SELECT account_balance FROM public.billing),
    'credits', (SELECT credits_available FROM public.billing),
    'gross', (SELECT min(amount) FROM public.payments WHERE transaction_id = '${grossId}'),
    'commission', (SELECT min(amount) FROM public.payments WHERE transaction_id = '${commissionId}'),
    'expense', (SELECT amount FROM public.transactions WHERE id = '${expense}'),
    'expense_state', (SELECT accounting_state FROM public.transactions WHERE id = '${expense}'),
    'currency', (SELECT min(currency) FROM public.payments WHERE transaction_id = '${grossId}'),
    'effect', (SELECT to_jsonb(e) FROM public.stripe_sale_checkout_effects e),
    'sale', (SELECT to_jsonb(s) FROM public.sales s),
    'audit', (SELECT details->'fx_repair' FROM public.payments WHERE transaction_id = '${grossId}' LIMIT 1)
  )`))
  const asyncDb = (sql: string) => new Promise<string>((resolve, reject) => {
    const child = spawn(path.join(pgBin, 'psql'), connection(), { env: pgEnv, stdio: 'pipe' })
    let output = '', errors = ''
    child.stdout.on('data', data => { output += data })
    child.stderr.on('data', data => { errors += data })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(errors)))
    child.stdin.end(sql)
  })

  beforeAll(() => {
    // New socket-only cluster: never read DATABASE_URL or connect to any project.
    directory = mkdtempSync('/tmp/stripe-wallet-repair-pg-')
    execFileSync(path.join(pgBin, 'initdb'), ['-D', path.join(directory, 'data'), '-U', 'postgres', '-A', 'trust', '--no-locale'],
      { stdio: 'pipe', env: pgEnv, timeout: 20000 })
    execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(directory, 'data'), '-l', path.join(directory, 'server.log'),
      '-o', `-F -p 55443 -k ${directory} -c listen_addresses='' -c lc_messages=C`, '-w', 'start'],
    { stdio: 'pipe', env: pgEnv, timeout: 20000 })
    db('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
  }, 30000)

  afterAll(() => {
    if (!directory) return
    if (existsSync(path.join(directory, 'data/postmaster.pid'))) execFileSync(path.join(pgBin, 'pg_ctl'),
      ['-D', path.join(directory, 'data'), '-m', 'fast', '-w', 'stop'], { stdio: 'pipe', env: pgEnv, timeout: 20000 })
    rmSync(directory, { recursive: true, force: true })
  })

  beforeEach(() => {
    // Model columns used by the actual original function and the new repair.
    db(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE TABLE public.sites(id uuid PRIMARY KEY, user_id uuid);
      CREATE TABLE public.sales(id uuid PRIMARY KEY, site_id uuid, stripe_checkout_session_id text,
        stripe_payment_intent_id text, amount numeric, currency text, amount_due numeric, status text,
        accounting_state text DEFAULT 'posted', updated_at timestamptz DEFAULT now());
      CREATE TABLE public.stripe_sale_checkout_effects(stripe_session_id text PRIMARY KEY,
        sale_reference text, sale_id uuid, order_id uuid, payment_intent_id text, amount_minor bigint, currency text,
        settlement_status text, financial_status text DEFAULT 'pending', compensation_status text DEFAULT 'not_required',
        stripe_refund_id text, financial_completed_at timestamptz, updated_at timestamptz DEFAULT now());
      CREATE TABLE public.billing(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid UNIQUE,
        plan text, account_balance numeric, credits_available numeric, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid,
        transaction_id text, transaction_type text, amount numeric, currency text, status text, payment_method text,
        details jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE public.transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid, user_id uuid,
        type text, amount numeric, description text, category text, date date, currency text, accounting_state text,
        created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE public.accounting_sale_refunds(id text PRIMARY KEY, sale_id uuid, site_id uuid, amount numeric);
      INSERT INTO public.sites VALUES ('${site}', '${uuid(10)}');
      INSERT INTO public.sales(id,site_id,stripe_checkout_session_id,stripe_payment_intent_id,amount,currency,amount_due,status)
        VALUES ('${sale}','${site}','${session}','pi_test_repair',164,'MXN',0,'completed');
      INSERT INTO public.stripe_sale_checkout_effects(stripe_session_id,sale_reference,sale_id,order_id,payment_intent_id,amount_minor,currency,settlement_status)
        VALUES ('${session}','${sale}','${sale}','${order}','pi_test_repair',16400,'mxn','settled');
      INSERT INTO public.billing(site_id,plan,account_balance,credits_available) VALUES ('${site}','foundry',17.42,63.630963);
    `)
    const financialFunction = original.slice(original.indexOf('CREATE OR REPLACE FUNCTION public.apply_stripe_sale_financial_effects('),
      original.indexOf('CREATE OR REPLACE FUNCTION public.claim_stripe_sale_fulfillment('))
    db(financialFunction)
    db(`SELECT public.apply_stripe_sale_financial_effects('${sale}','${session}',164,'MXN');
      UPDATE public.transactions SET id = '${expense}';
      UPDATE public.billing SET plan = 'enterprise';`)
    db(migration)
    db('GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;')
  })

  it('performs a read-only preview, then only adjusts the historical net delta using the stored rate', () => {
    const before = state()
    expect(before).toMatchObject({ balance: 173.22, gross: 164, commission: 8.2, expense: 8.2 })
    const preview = JSON.parse(actor(call()))
    expect(preview).toMatchObject({ status: 'preview', new_gross: 8.3, new_commission: 0.42,
      audit: { balance_delta: -147.92, balance_before: 173.22, balance_after: 25.3, commission_rate: 0.05 } })
    expect(state()).toEqual(before)
    expect(JSON.parse(actor(call(true))).status).toBe('repaired')
    expect(state()).toMatchObject({ balance: 25.3, credits: before.credits, gross: 8.3, commission: 0.42,
      expense: 0.42, expense_state: 'pending', currency: 'USD', effect: before.effect, sale: before.sale,
      audit: { original: { gross: { amount: 164, currency: 'MXN' }, commission: { amount: 8.2, currency: 'MXN' }, expense: { amount: 8.2, currency: 'MXN' } } } })
    expect(db(`SELECT (a.details->'fx_repair') = (b.details->'fx_repair') FROM public.payments a, public.payments b
      WHERE a.transaction_id='${grossId}' AND b.transaction_id='${commissionId}'`)).toBe('t')
  })

  it('defaults to preview when p_apply is omitted', () => {
    const before = state()
    expect(JSON.parse(actor(call().replace(', false);', ');'))).status).toBe('preview')
    expect(state()).toEqual(before)
  })

  it('accepts explicitly acknowledged verified operator USD evidence and audits the reference', () => {
    const manual = { ...evidence, source: 'verified_operator_usd', ack_manual_usd: true, evidence_reference: 'approved-case:local-proof' }
    expect(JSON.parse(actor(call(true, { evidence: manual }))).status).toBe('repaired')
    expect(state().audit.evidence).toEqual(manual)
  })

  it.each(['anon', 'authenticated'])('denies %s callers', role => {
    expect(() => actor(call(true), role)).toThrow('permission denied for function repair_stripe_sale_wallet_currency')
  })

  it('is idempotent and refuses a changed USD amount or manually changed repaired row', () => {
    actor(call(true)); const before = state()
    expect(JSON.parse(actor(call(true))).status).toBe('already_repaired')
    expect(state()).toEqual(before)
    expect(() => actor(call(true, { minor: '831', evidence: { ...evidence, usd_amount_minor: 831 } })))
      .toThrow('Existing FX repair audit or repaired values are inconsistent')
    db("UPDATE public.transactions SET amount=1")
    expect(() => actor(call(true))).toThrow('Existing FX repair audit or repaired values are inconsistent')
  })

  it('serializes concurrent apply and preserves later unrelated wallet credits', async () => {
    const results = await Promise.all([asyncDb(`SET ROLE service_role; ${call(true)}`), asyncDb(`SET ROLE service_role; ${call(true)}`)])
    expect(results.map(result => JSON.parse(result).status).sort()).toEqual(['already_repaired', 'repaired'])
    db('UPDATE public.billing SET account_balance=account_balance+50')
    actor(call(true))
    expect(state().balance).toBe(75.3)
  })

  it('leaves an already correct USD session and another site expense untouched', () => {
    db(`INSERT INTO public.payments(site_id,transaction_id,transaction_type,amount,currency,status,payment_method,details)
      VALUES ('${site}','sale_correct_other_session','sale',7.05,'USD','completed','stripe','{"sale_id":"${uuid(20)}","stripe_session_id":"cs_other"}');
      INSERT INTO public.transactions(site_id,type,amount,description,category,currency,accounting_state)
      VALUES ('${uuid(30)}','variable',8.20,'Platform commission for order ${order}','operating','MXN','posted');`)
    const untouched = () => db(`SELECT jsonb_build_object(
      'payment',(SELECT to_jsonb(p) FROM public.payments p WHERE transaction_id='sale_correct_other_session'),
      'expense',(SELECT to_jsonb(t) FROM public.transactions t WHERE site_id='${uuid(30)}'))`)
    const before = untouched()
    actor(call(true))
    expect(untouched()).toEqual(before)
  })

  it('preserves unpublished expenses and supports the no-order sale description', () => {
    db(`UPDATE public.stripe_sale_checkout_effects SET order_id=NULL;
      UPDATE public.payments SET transaction_id=replace(transaction_id,'${order}','${session}'),
        details=jsonb_set(details,'{order_id}','null');
      UPDATE public.payments SET details=jsonb_set(details,'{related_transaction_id}','"sale_${sale}_${session}"') WHERE transaction_type='commission';
      UPDATE public.transactions SET description='Platform commission for sale ${sale}', accounting_state='unpublished';`)
    actor(call(true))
    expect(state().expense_state).toBe('unpublished')
    expect(state().balance).toBe(25.3)
  })

  it.each([
    [`UPDATE public.payments SET amount=7.05,currency='USD' WHERE transaction_type='sale'`, 'Expected original amounts/currency'],
    [`UPDATE public.payments SET currency='USD'`, 'Expected original amounts/currency'],
    [`UPDATE public.payments SET details=jsonb_set(details,'{gross_amount}','7.05') WHERE transaction_type='sale'`, 'Expected original amounts/currency'],
    [`DELETE FROM public.payments WHERE transaction_type='commission'`, 'Missing or duplicate'],
    [`INSERT INTO public.payments SELECT gen_random_uuid(),site_id,transaction_id,transaction_type,amount,currency,status,payment_method,details,created_at,updated_at FROM public.payments WHERE transaction_type='sale'`, 'Missing or duplicate'],
    [`INSERT INTO public.payments SELECT gen_random_uuid(),site_id,'other_sale',transaction_type,amount,currency,status,payment_method,details,created_at,updated_at FROM public.payments WHERE transaction_type='sale'`, 'Ambiguous sale payment'],
    [`UPDATE public.sales SET status='refunded'`, 'Sale is mismatched'],
    [`INSERT INTO public.accounting_sale_refunds VALUES ('re_test','${sale}','${site}',1)`, 'Sale is mismatched'],
    [`UPDATE public.stripe_sale_checkout_effects SET compensation_status='refunded'`, 'Stripe effect is not eligible'],
    [`UPDATE public.billing SET account_balance=1`, 'Insufficient wallet balance'],
    [`DELETE FROM public.billing`, 'query returned no rows'],
    [`UPDATE public.payments SET details=details-'commission_rate'`, 'Stored commission rate'],
    [`DELETE FROM public.transactions`, 'Missing or ambiguous'],
    [`INSERT INTO public.transactions SELECT gen_random_uuid(),site_id,user_id,type,999,description,category,date,currency,accounting_state,created_at,updated_at FROM public.transactions`, 'Missing or ambiguous'],
    [`UPDATE public.transactions SET amount=1`, 'Expected original amounts/currency'],
    [`UPDATE public.transactions SET currency='USD'`, 'Expected original amounts/currency'],
  ])('refuses unsafe or inconsistent data without further mutation (%#)', (change, error) => {
    db(change); const before = state()
    expect(() => actor(call(true))).toThrow(error)
    expect(state()).toEqual(before)
  })

  it.each([
    { site: uuid(99) }, { gross: 163 }, { commission: 8 }, { currency: 'USD' }, { minor: '0' },
    { evidence: { ...evidence, payment_intent_id: 'pi_forged' } },
    { evidence: { ...evidence, checkout_amount_minor: 1 } },
    { evidence: { ...evidence, usd_amount_minor: 1 } },
    { evidence: { ...evidence, source: 'verified_operator_usd' } },
    { evidence: { ...evidence, source: 'verified_operator_usd', ack_manual_usd: true, evidence_reference: '' } },
    { evidence: { ...evidence, source: 'unknown' } },
  ])('refuses mismatched target or evidence (%#)', overrides => {
    const before = state()
    expect(() => actor(call(true, overrides))).toThrow()
    expect(state()).toEqual(before)
  })

  it('rolls back all changes when an expense update fails', () => {
    db(`CREATE FUNCTION public.reject_expense() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected expense failure'; END; $$;
      CREATE TRIGGER reject_expense BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.reject_expense();`)
    const before = state()
    expect(() => actor(call(true))).toThrow('Injected expense failure')
    expect(state()).toEqual(before)
  })
})