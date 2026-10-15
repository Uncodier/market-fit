/** @jest-environment node */
import { execFile, execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"

const pgBin = process.env.STRIPE_WALLET_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
const available = ["initdb", "pg_ctl", "psql"].every(file => existsSync(path.join(pgBin, file)))
const suite = available ? describe : describe.skip
const migration = readFileSync(path.join(process.cwd(),
  "supabase/migrations/20261014220000_stripe_sale_wallet_usd_guard.sql"), "utf8")
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
const site = uuid(1)
const owner = uuid(2)
const sale = uuid(3)
const order = uuid(4)
const session = "cs_wallet_test"
const revenueId = `sale_${sale}_${order}`
const commissionId = `commission_${sale}_${order}`
const signature = "public.apply_stripe_sale_financial_effects(uuid,text,numeric,text)"
const literal = (value: string | null) => value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`
const call = (amount = "100", currency: string | null = "USD", saleId = sale, sessionId = session) =>
  `SELECT public.apply_stripe_sale_financial_effects('${saleId}', ${literal(sessionId)},
    ${amount}::numeric, ${literal(currency)});`

suite("Stripe USD wallet guard in disposable PostgreSQL 17", () => {
  let directory = ""
  // No app credentials, DATABASE_URL, PG* settings, or psql startup files are used.
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, NODE_ENV: "test", LC_ALL: "C", LANG: "C" }
  const args = () => {
    if (!directory.startsWith("/tmp/stripe-wallet-pg-")) throw new Error("Disposable socket is required")
    return ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
      "-h", directory, "-p", "55443", "-U", "postgres", "-d", "postgres"]
  }
  const db = (sql: string) => execFileSync(path.join(pgBin, "psql"), args(),
    { input: sql, encoding: "utf8", stdio: "pipe", timeout: 20000, env }).trim()
  const actor = (sql: string, role = "service_role") => db(`SET ROLE ${role}; ${sql}`)
  const apply = (amount = "100", currency: string | null = "USD") => JSON.parse(actor(call(amount, currency)))
  const snapshot = () => db(`SELECT jsonb_build_object(
    'sites', (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.sites s),
    'sales', (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.sales s),
    'effects', (SELECT jsonb_agg(to_jsonb(e) ORDER BY stripe_session_id) FROM public.stripe_sale_checkout_effects e),
    'billing', (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM public.billing b),
    'payments', (SELECT jsonb_agg(to_jsonb(p) ORDER BY transaction_id) FROM public.payments p),
    'transactions', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transactions t));`)
  const state = () => JSON.parse(db(`SELECT jsonb_build_object(
    'balance', (SELECT account_balance FROM public.billing WHERE site_id = '${site}'),
    'billing', (SELECT count(*) FROM public.billing),
    'payments', (SELECT count(*) FROM public.payments),
    'transactions', (SELECT count(*) FROM public.transactions),
    'financial_status', (SELECT financial_status FROM public.stripe_sale_checkout_effects WHERE stripe_session_id = '${session}'),
    'completed_at', (SELECT financial_completed_at IS NOT NULL FROM public.stripe_sale_checkout_effects WHERE stripe_session_id = '${session}'));`))
  const denyWithoutWrites = (sql: string, message: string, role = "service_role") => {
    const before = snapshot()
    expect(() => actor(sql, role)).toThrow(message)
    expect(snapshot()).toBe(before)
  }

  beforeAll(() => {
    expect(execFileSync(path.join(pgBin, "initdb"), ["--version"], { env, encoding: "utf8" })).toMatch(/\b17\./)
    // A fresh private Unix socket and disabled TCP make remote mutation impossible.
    directory = mkdtempSync("/tmp/stripe-wallet-pg-")
    execFileSync(path.join(pgBin, "initdb"), [
      "-D", path.join(directory, "data"), "-U", "postgres", "-A", "trust", "--no-locale",
    ], { stdio: "pipe", env, timeout: 30000 })
    execFileSync(path.join(pgBin, "pg_ctl"), [
      "-D", path.join(directory, "data"), "-l", path.join(directory, "server.log"),
      "-o", `-F -p 55443 -k ${directory} -c listen_addresses='' -c lc_messages=C`, "-w", "start",
    ], { stdio: "pipe", env, timeout: 30000 })
    expect(db("SHOW listen_addresses")).toBe("")
    expect(Number(db("SHOW server_version_num"))).toBeGreaterThanOrEqual(170000)
    expect(Number(db("SHOW server_version_num"))).toBeLessThan(180000)
    db("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;")
  }, 60000)

  afterAll(() => {
    if (!directory) return
    if (existsSync(path.join(directory, "data/postmaster.pid"))) {
      execFileSync(path.join(pgBin, "pg_ctl"), [
        "-D", path.join(directory, "data"), "-m", "fast", "-w", "stop",
      ], { stdio: "pipe", env, timeout: 20000 })
    }
    rmSync(directory, { recursive: true, force: true })
  }, 30000)

  beforeEach(() => {
    // Minimal pre-existing schema; unconstrained numeric preserves invalid input for the RPC guard.
    db(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      CREATE TABLE public.sites (id uuid PRIMARY KEY, user_id uuid);
      CREATE TABLE public.sales (
        id uuid PRIMARY KEY, site_id uuid NOT NULL REFERENCES public.sites,
        stripe_checkout_session_id text, amount_due numeric, status text NOT NULL);
      CREATE TABLE public.stripe_sale_checkout_effects (
        stripe_session_id text PRIMARY KEY, sale_reference text NOT NULL, sale_id uuid, order_id uuid,
        payment_intent_id text, amount_minor bigint NOT NULL, currency text NOT NULL,
        settlement_status text NOT NULL CHECK (settlement_status IN ('settled', 'rejected')),
        financial_status text NOT NULL DEFAULT 'pending'
          CHECK (financial_status IN ('pending', 'completed', 'not_required')),
        financial_completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE public.billing (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL UNIQUE REFERENCES public.sites,
        plan text DEFAULT 'foundry', account_balance numeric DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE public.payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites,
        transaction_id text UNIQUE, transaction_type text NOT NULL, amount numeric NOT NULL,
        currency text NOT NULL, status text NOT NULL, payment_method text, details jsonb);
      CREATE TABLE public.transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites,
        user_id uuid NOT NULL, type text NOT NULL, amount numeric NOT NULL, description text,
        category text, date date, currency text NOT NULL, accounting_state text);
      ALTER TABLE public.stripe_sale_checkout_effects ENABLE ROW LEVEL SECURITY;
      INSERT INTO public.sites VALUES ('${site}', '${owner}');
      INSERT INTO public.sales VALUES ('${sale}', '${site}', '${session}', 0, 'completed');
      INSERT INTO public.stripe_sale_checkout_effects (
        stripe_session_id, sale_reference, sale_id, order_id, payment_intent_id,
        amount_minor, currency, settlement_status)
      VALUES ('${session}', '${sale}', '${sale}', '${order}', 'pi_wallet_test', 200000, 'mxn', 'settled');
      INSERT INTO public.billing (site_id, plan, account_balance) VALUES ('${site}', 'foundry', 10.1234);`)
    // Execute the actual forward-only migration, not a copied or mocked function body.
    db(migration)
  })

  it("credits only verified USD less 5% commission, retaining the original MXN checkout metadata", () => {
    expect(apply()).toEqual({ status: "completed", balance_credit: 95, commission_amount: 5 })
    expect(state()).toEqual({ balance: 105.1234, billing: 1, payments: 2, transactions: 1,
      financial_status: "completed", completed_at: true })
    const payments = JSON.parse(db(`SELECT jsonb_agg(to_jsonb(p) - 'id' ORDER BY transaction_type)
      FROM public.payments p;`))
    expect(payments).toEqual([
      { site_id: site, transaction_id: commissionId, transaction_type: "commission", amount: 5,
        currency: "USD", status: "completed", payment_method: "system",
        details: { order_id: order, sale_id: sale, commission_rate: 0.05, related_transaction_id: revenueId } },
      { site_id: site, transaction_id: revenueId, transaction_type: "sale", amount: 100,
        currency: "USD", status: "completed", payment_method: "stripe",
        details: { stripe_payment_intent_id: "pi_wallet_test", stripe_session_id: session,
          order_id: order, sale_id: sale, gross_amount: 100, original_currency: "mxn",
          original_amount: 200000, commission_rate: 0.05 } },
    ])
    expect(JSON.parse(db(`SELECT to_jsonb(t) - 'id' - 'date' FROM public.transactions t;`))).toEqual({
      site_id: site, user_id: owner, type: "variable", amount: 5,
      description: `Platform commission for order ${order}`, category: "operating",
      currency: "USD", accounting_state: "pending",
    })
    expect(db("SELECT date = current_date FROM public.transactions")).toBe("t")
  })

  it("creates the USD wallet if billing is absent and rounds the 5% commission to cents", () => {
    db("DELETE FROM public.billing")
    expect(apply("10.11", " usd ")).toEqual({ status: "completed", balance_credit: 9.6, commission_amount: 0.51 })
    expect(state()).toEqual({ balance: 9.6, billing: 1, payments: 2, transactions: 1,
      financial_status: "completed", completed_at: true })
    expect(db("SELECT bool_and(currency = 'USD') FROM public.payments")).toBe("t")
  })

  it("replays a completed effect without crediting or rewriting any row", () => {
    apply()
    const before = snapshot()
    for (let i = 0; i < 3; i++) expect(apply()).toEqual({ status: "already_completed" })
    expect(snapshot()).toBe(before)
  })

  it("serializes overlapping service-role calls and applies every financial write exactly once", async () => {
    // Each client holds the effect lock past its SELECT so other independent sessions overlap.
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => promisify(execFile)(
      path.join(pgBin, "psql"), [...args(), "-c", `BEGIN; SET LOCAL ROLE service_role; ${call()}
        DO $$ BEGIN PERFORM pg_sleep(0.2); END $$; COMMIT;`], { env, encoding: "utf8", timeout: 20000 })))
    expect(results.map(result => result.status)).toEqual(Array(4).fill("fulfilled"))
    const statuses = results.flatMap(result => result.status === "fulfilled"
      ? [JSON.parse(result.value.stdout.trim()).status] : [])
    expect(statuses.sort()).toEqual(["already_completed", "already_completed", "already_completed", "completed"])
    expect(state()).toEqual({ balance: 105.1234, billing: 1, payments: 2, transactions: 1,
      financial_status: "completed", completed_at: true })
    expect(db(`SELECT count(DISTINCT transaction_id) FROM public.payments`)).toBe("2")
  }, 30000)

  it.each(["MXN", "eur", " cad ", "", "   ", null])("rejects non-USD currency %p before attempting writes", currency => {
    db(`CREATE FUNCTION public.forbid_wallet_write() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Financial write attempted before validation'; END; $$;`)
    for (const table of ["billing", "payments", "transactions", "stripe_sale_checkout_effects"]) {
      db(`CREATE TRIGGER forbid_wallet_write BEFORE INSERT OR UPDATE OR DELETE ON public.${table}
        FOR EACH ROW EXECUTE FUNCTION public.forbid_wallet_write();`)
    }
    denyWithoutWrites(call("100", currency), "Stripe wallet settlement must be USD")
    // Invalid input is rejected even if the referenced effect does not exist.
    denyWithoutWrites(call("100", currency, sale, "cs_missing"), "Stripe wallet settlement must be USD")
  })

  it.each(["NULL", "0", "-1", "'NaN'", "'Infinity'", "'-Infinity'", "0.001", "100.001"])(
    "rejects invalid USD amount %s without changing any financial or settlement row", amount => {
      denyWithoutWrites(call(amount), "Invalid Stripe USD settlement amount")
    })

  it("validates currency and amount on completed retries instead of bypassing the guard", () => {
    apply()
    denyWithoutWrites(call("100", "MXN"), "Stripe wallet settlement must be USD")
    denyWithoutWrites(call("'NaN'"), "Invalid Stripe USD settlement amount")
    denyWithoutWrites(call("0.001"), "Invalid Stripe USD settlement amount")
  })

  it("denies missing sessions and mismatched effect/sale bindings", () => {
    denyWithoutWrites(call("100", "USD", sale, "cs_missing"), "Stripe settlement effect is not eligible")
    denyWithoutWrites(call("100", "USD", uuid(99)), "Stripe settlement effect is not eligible")
    db(`UPDATE public.sales SET stripe_checkout_session_id = 'cs_other' WHERE id = '${sale}'`)
    denyWithoutWrites(call(), "Stripe sale is not eligible for financial effects")
  })

  it.each([
    "UPDATE public.stripe_sale_checkout_effects SET settlement_status = 'rejected'",
    "UPDATE public.stripe_sale_checkout_effects SET sale_id = NULL",
    "UPDATE public.sales SET stripe_checkout_session_id = NULL",
    "UPDATE public.sales SET amount_due = 1",
    "UPDATE public.sales SET status = 'cancelled'",
    "UPDATE public.sales SET status = 'refunded'",
    "DELETE FROM public.sales",
  ])("denies ineligible durable state: %s", sql => {
    db(sql)
    denyWithoutWrites(call(), sql.includes("checkout_effects")
      ? "Stripe settlement effect is not eligible" : "Stripe sale is not eligible for financial effects")
  })

  it("grants execution only to service_role, not PUBLIC, authenticated, or anon", () => {
    expect(JSON.parse(db(`SELECT jsonb_build_object(
      'service', has_function_privilege('service_role', '${signature}', 'EXECUTE'),
      'authenticated', has_function_privilege('authenticated', '${signature}', 'EXECUTE'),
      'anon', has_function_privilege('anon', '${signature}', 'EXECUTE'),
      'public', EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) a
        WHERE p.oid = '${signature}'::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
      'definer', (SELECT prosecdef FROM pg_proc WHERE oid = '${signature}'::regprocedure),
      'config', (SELECT proconfig FROM pg_proc WHERE oid = '${signature}'::regprocedure));`))).toEqual({
      service: true, authenticated: false, anon: false, public: false,
      definer: true, config: ["search_path=public, pg_temp"],
    })
    for (const role of ["authenticated", "anon"]) {
      denyWithoutWrites(call(), "permission denied for function apply_stripe_sale_financial_effects", role)
    }
    expect(apply().status).toBe("completed")
  })

  it.each([
    ["MXN", "100"], ["mxn", "100"], ["USD", "99"],
  ])("does not recover pending existing %s revenue of %s", (currency, amount) => {
    db(`INSERT INTO public.payments (site_id, transaction_id, transaction_type, amount, currency, status, payment_method)
      VALUES ('${site}', '${revenueId}', 'sale', ${amount}, '${currency}', 'completed', 'stripe');`)
    denyWithoutWrites(call(), "Existing Stripe revenue requires currency reconciliation")
    expect(state()).toEqual({ balance: 10.1234, billing: 1, payments: 1, transactions: 0,
      financial_status: "pending", completed_at: false })
  })

  it("recovers matching existing USD revenue without creating new credit or commission", () => {
    db(`INSERT INTO public.payments (site_id, transaction_id, transaction_type, amount, currency, status, payment_method)
      VALUES ('${site}', '${revenueId}', 'sale', 100, 'USD', 'completed', 'stripe');`)
    expect(apply()).toEqual({ status: "recovered_existing" })
    expect(state()).toEqual({ balance: 10.1234, billing: 1, payments: 1, transactions: 0,
      financial_status: "completed", completed_at: true })
    const before = snapshot()
    expect(apply()).toEqual({ status: "already_completed" })
    expect(snapshot()).toBe(before)
  })

  it("rolls back the wallet and payments if the commission transaction write fails, then safely retries", () => {
    db(`CREATE FUNCTION public.fail_commission() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Injected commission failure'; END; $$;
      CREATE TRIGGER fail_commission BEFORE INSERT ON public.transactions
        FOR EACH ROW EXECUTE FUNCTION public.fail_commission();`)
    denyWithoutWrites(call(), "Injected commission failure")
    db("DROP TRIGGER fail_commission ON public.transactions; DROP FUNCTION public.fail_commission();")
    expect(apply()).toEqual({ status: "completed", balance_credit: 95, commission_amount: 5 })
    expect(state()).toEqual({ balance: 105.1234, billing: 1, payments: 2, transactions: 1,
      financial_status: "completed", completed_at: true })
  })
})