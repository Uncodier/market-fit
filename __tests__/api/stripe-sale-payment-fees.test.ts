/** @jest-environment node */
import { execFile, execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"

const root = path.resolve(__dirname, "../..")
const pgBin = process.env.STRIPE_PAYMENT_FEES_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
const available = ["initdb", "pg_ctl", "psql"].every(file => existsSync(path.join(pgBin, file)))
const suite = available ? describe : describe.skip
const guard = readFileSync(path.join(root,
  "supabase/migrations/20261014220000_stripe_sale_wallet_usd_guard.sql"), "utf8")
const migration = readFileSync(path.join(root,
  "supabase/migrations/20261015000000_stripe_sale_payment_fee_rates.sql"), "utf8")
const verification = readFileSync(path.join(root, "scripts/verify-stripe-sale-payment-fees.sql"), "utf8")
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
const site = uuid(1), owner = uuid(2), sale = uuid(3), order = uuid(4)
const session = "cs_payment_fees_test"
const revenueId = `sale_${sale}_${order}`, commissionId = `commission_${sale}_${order}`
const signature = "public.apply_stripe_sale_financial_effects(uuid,text,numeric,text)"
const literal = (value: string | null) => value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`
const call = (amount = "100", currency: string | null = "USD", saleId = sale, sessionId = session) =>
  `SELECT public.apply_stripe_sale_financial_effects('${saleId}', ${literal(sessionId)},
    ${amount}::numeric, ${literal(currency)});`

suite("Stripe total payment fee forward migration in disposable PostgreSQL", () => {
  let directory = ""
  // Deliberately omit HOME, DATABASE_URL, all PG* settings, dotenv and app secrets.
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, NODE_ENV: "test", LC_ALL: "C", LANG: "C" }
  const args = () => {
    if (!directory.startsWith("/tmp/stripe-payment-fees-pg-")) throw new Error("Disposable socket is required")
    return ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
      "-h", directory, "-p", "55444", "-U", "postgres", "-d", "postgres"]
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
    'balance', (SELECT account_balance::text FROM public.billing WHERE site_id = '${site}'),
    'plan', (SELECT plan FROM public.billing WHERE site_id = '${site}'),
    'billing', (SELECT count(*) FROM public.billing),
    'payments', (SELECT count(*) FROM public.payments),
    'transactions', (SELECT count(*) FROM public.transactions),
    'status', (SELECT financial_status FROM public.stripe_sale_checkout_effects WHERE stripe_session_id = '${session}'),
    'completed_at', (SELECT financial_completed_at IS NOT NULL FROM public.stripe_sale_checkout_effects WHERE stripe_session_id = '${session}'));`))
  const deny = (sql: string, message: string, role = "service_role") => {
    const before = snapshot()
    expect(() => actor(sql, role)).toThrow(message)
    expect(snapshot()).toBe(before)
  }
  const ledger = () => JSON.parse(db(`SELECT jsonb_agg(jsonb_build_object(
    'id', transaction_id, 'type', transaction_type, 'amount', amount, 'currency', currency,
    'status', status, 'method', payment_method, 'details', details) ORDER BY transaction_type)
    FROM public.payments;`))
  const verify = () => JSON.parse(db(verification))
  const concurrent = (sqls: string[]) => Promise.all(sqls.map(sql => promisify(execFile)(
    path.join(pgBin, "psql"), [...args(), "-c", `BEGIN; SET LOCAL ROLE service_role; ${sql}
      DO $$ BEGIN PERFORM pg_sleep(0.2); END $$; COMMIT;`],
    { env, encoding: "utf8", timeout: 20000 })))

  beforeAll(() => {
    directory = mkdtempSync("/tmp/stripe-payment-fees-pg-")
    execFileSync(path.join(pgBin, "initdb"), [
      "-D", path.join(directory, "data"), "-U", "postgres", "-A", "trust", "--no-locale",
    ], { stdio: "pipe", env, timeout: 30000 })
    execFileSync(path.join(pgBin, "pg_ctl"), [
      "-D", path.join(directory, "data"), "-l", path.join(directory, "server.log"),
      "-o", `-F -p 55444 -k ${directory} -c listen_addresses='' -c lc_messages=C`, "-w", "start",
    ], { stdio: "pipe", env, timeout: 30000 })
    expect(db("SHOW listen_addresses")).toBe("")
    expect(Number(db("SHOW server_version_num"))).toBeGreaterThanOrEqual(170000)
    db("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;")
  }, 60000)

  afterAll(() => {
    if (!directory) return
    try {
      if (existsSync(path.join(directory, "data/postmaster.pid"))) {
        execFileSync(path.join(pgBin, "pg_ctl"), [
          "-D", path.join(directory, "data"), "-m", "fast", "-w", "stop",
        ], { stdio: "pipe", env, timeout: 20000 })
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }, 30000)

  beforeEach(() => {
    // Minimal prerequisite schema, not a claim to bootstrap the entire Supabase history.
    // Unconstrained numeric exercises sub-cent balances and the RPC's finite/cent guards.
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
      VALUES ('${session}', 'reference', '${sale}', '${order}', 'pi_fee_test', 200000, 'mxn', 'settled');
      INSERT INTO public.billing (site_id, plan, account_balance) VALUES ('${site}', 'commission', 10.1234);`)
    // Every live case actually installs the latest user guard, then the forward replacement.
    db(guard)
    db(migration)
  })

  it.each([
    ["enterprise", 0.045, 4.5, 95.5], ["foundry", 0.055, 5.5, 94.5],
    ["engine", 0.06, 6, 94], ["commission", 0.07, 7, 93],
    [null, 0.07, 7, 93], ["unknown", 0.07, 7, 93], ["", 0.07, 7, 93],
    ["Enterprise", 0.07, 7, 93], [" enterprise ", 0.07, 7, 93],
    ["starter", 0.07, 7, 93], ["startup", 0.07, 7, 93], ["reactor", 0.07, 7, 93],
  ])("records one total fee for billing plan %p", (plan, rate, fee, credit) => {
    db(`UPDATE public.billing SET plan = ${literal(plan)};`)
    expect(apply("100", " usd ")).toEqual({ status: "completed", balance_credit: credit, commission_amount: fee })
    expect(db(`SELECT account_balance - 10.1234 = ${credit} FROM public.billing`)).toBe("t")
    expect(ledger()).toEqual([
      { id: commissionId, type: "commission", amount: fee, currency: "USD", status: "completed", method: "system",
        details: { order_id: order, sale_id: sale, commission_basis: "processing_included",
          commission_rate: rate, related_transaction_id: revenueId } },
      { id: revenueId, type: "sale", amount: 100, currency: "USD", status: "completed", method: "stripe",
        details: { stripe_payment_intent_id: "pi_fee_test", stripe_session_id: session, order_id: order,
          sale_id: sale, gross_amount: 100, original_currency: "mxn", original_amount: 200000,
          commission_basis: "processing_included", commission_rate: rate } },
    ])
    expect(JSON.parse(db(`SELECT jsonb_build_object('amount', amount, 'currency', currency,
      'description', description, 'user', user_id, 'type', type, 'category', category,
      'state', accounting_state, 'today', date = current_date) FROM public.transactions`))).toEqual({
      amount: fee, currency: "USD", description: `Platform commission for order ${order}`,
      user: owner, type: "variable", category: "operating", state: "pending", today: true,
    })
    expect(state()).toMatchObject({ plan, billing: 1, payments: 2, transactions: 1, status: "completed", completed_at: true })
  })

  it("creates missing billing explicitly as commission despite its foundry database default", () => {
    db("DELETE FROM public.billing")
    expect(apply()).toEqual({ status: "completed", balance_credit: 93, commission_amount: 7 })
    expect(state()).toEqual({ balance: "93.00", plan: "commission", billing: 1,
      payments: 2, transactions: 1, status: "completed", completed_at: true })
    expect(ledger().map((row: { details: { commission_rate: number } }) => row.details.commission_rate)).toEqual([0.07, 0.07])
  })

  it.each([
    ["enterprise", "1.00", "0.05", "0.95"], ["foundry", "1.00", "0.06", "0.94"],
    ["engine", "0.25", "0.02", "0.23"], ["commission", "0.50", "0.04", "0.46"],
    ["commission", "0.01", "0.00", "0.01"],
    ["enterprise", "999999999999.99", "45000000000.00", "954999999999.99"],
  ])("rounds %s fee on %s once without rounding the pre-existing balance", (plan, gross, fee, credit) => {
    const opening = "123456789012345678901234567890.12345678"
    db(`UPDATE public.billing SET plan = '${plan}', account_balance = ${opening};`)
    expect(apply(gross)).toMatchObject({ commission_amount: Number(fee), balance_credit: Number(credit) })
    expect(db(`SELECT account_balance = ${opening} + ${credit} FROM public.billing`)).toBe("t")
    expect(db(`SELECT bool_and(amount = CASE transaction_type WHEN 'sale' THEN ${gross} ELSE ${fee} END)
      FROM public.payments`)).toBe("t")
    expect(db(`SELECT (${gross} - ${fee}) = ${credit}`)).toBe("t")
  })

  it("coalesces a null opening balance and keeps sale/session identifiers without an order or owner", () => {
    db(`UPDATE public.billing SET account_balance = NULL;
      UPDATE public.stripe_sale_checkout_effects SET order_id = NULL;
      UPDATE public.sites SET user_id = NULL;`)
    expect(apply().balance_credit).toBe(93)
    expect(state()).toMatchObject({ balance: "93.00", transactions: 0 })
    expect(ledger().map((row: { id: string }) => row.id).sort()).toEqual([
      `commission_${sale}_${session}`, `sale_${sale}_${session}`,
    ])
  })

  it("serializes concurrent retries, then ignores plan changes for completed effects", async () => {
    db("UPDATE public.billing SET plan = 'enterprise'")
    const results = await concurrent(Array(4).fill(call()))
    expect(results.map(result => JSON.parse(result.stdout.trim()).status).sort()).toEqual([
      "already_completed", "already_completed", "already_completed", "completed",
    ])
    expect(state()).toMatchObject({ balance: "105.6234", payments: 2, transactions: 1 })
    db("UPDATE public.billing SET plan = 'commission'")
    const before = snapshot()
    for (let i = 0; i < 3; i++) expect(apply()).toEqual({ status: "already_completed" })
    expect(snapshot()).toBe(before)
    expect(ledger().map((row: { details: { commission_rate: number } }) => row.details.commission_rate)).toEqual([0.045, 0.045])
  }, 30000)

  it("serializes distinct same-site settlements when billing is initially missing", async () => {
    db(`DELETE FROM public.billing;
      INSERT INTO public.sales VALUES ('${uuid(5)}', '${site}', 'cs_second', 0, 'completed');
      INSERT INTO public.stripe_sale_checkout_effects
        (stripe_session_id, sale_reference, sale_id, amount_minor, currency, settlement_status)
      VALUES ('cs_second', 'second', '${uuid(5)}', 10000, 'usd', 'settled');`)
    const results = await concurrent([call(), call("100", "USD", uuid(5), "cs_second")])
    expect(results.map(result => JSON.parse(result.stdout.trim()).status)).toEqual(["completed", "completed"])
    expect(state()).toMatchObject({ balance: "186.00", plan: "commission", billing: 1, payments: 4, transactions: 2 })
  }, 30000)

  it.each(["completed", "pending"])("never reprices %s historical guard-era rows during migration or replay", status => {
    db(guard)
    db("UPDATE public.billing SET plan = 'enterprise'")
    expect(apply()).toEqual({ status: "completed", balance_credit: 98, commission_amount: 2 })
    db(`UPDATE public.stripe_sale_checkout_effects SET financial_status = '${status}';
      UPDATE public.billing SET plan = 'foundry';`)
    const beforeMigration = snapshot()
    db(migration)
    expect(snapshot()).toBe(beforeMigration)
    expect(apply()).toEqual({ status: status === "completed" ? "already_completed" : "recovered_existing" })
    expect(state()).toMatchObject({ balance: "108.1234", payments: 2, transactions: 1, status: "completed" })
    expect(ledger().map((row: { details: { commission_rate: number } }) => row.details.commission_rate)).toEqual([0.02, 0.02])
    expect(ledger().every((row: { details: { commission_basis?: string } }) => row.details.commission_basis === undefined)).toBe(true)
    const recovered = snapshot()
    expect(apply()).toEqual({ status: "already_completed" })
    expect(snapshot()).toBe(recovered)
  })

  it("recovers matching revenue alone without synthesizing a historical fee or wallet credit", () => {
    db(`INSERT INTO public.payments (site_id, transaction_id, transaction_type, amount, currency, status, details)
      VALUES ('${site}', '${revenueId}', 'sale', 100, 'usd', 'completed', '{"commission_rate":0.03}');`)
    expect(apply()).toEqual({ status: "recovered_existing" })
    expect(state()).toMatchObject({ balance: "10.1234", payments: 1, transactions: 0, status: "completed" })
    expect(ledger()[0].details).toEqual({ commission_rate: 0.03 })
  })

  it.each([["MXN", "100"], ["USD", "99"]])("refuses historical currency/amount reconciliation: %s %s", (currency, amount) => {
    db(`INSERT INTO public.payments (site_id, transaction_id, transaction_type, amount, currency, status)
      VALUES ('${site}', '${revenueId}', 'sale', ${amount}, '${currency}', 'completed');`)
    deny(call(), "Existing Stripe revenue requires currency reconciliation")
  })

  it.each(["MXN", "eur", "", "  ", null])("rejects non-USD %p without any writes", currency => {
    deny(call("100", currency), "Stripe wallet settlement must be USD")
    deny(call("100", currency, sale, "cs_missing"), "Stripe wallet settlement must be USD")
  })

  it.each(["NULL", "0", "-1", "'NaN'", "'Infinity'", "'-Infinity'", "0.001", "100.001"])(
    "rejects invalid amount %s atomically", amount => deny(call(amount), "Invalid Stripe USD settlement amount"))

  it("retains input validation even on completed retries", () => {
    apply()
    deny(call("100", "MXN"), "Stripe wallet settlement must be USD")
    deny(call("'NaN'"), "Invalid Stripe USD settlement amount")
    deny(call("0.001"), "Invalid Stripe USD settlement amount")
  })

  it.each([
    ["DELETE FROM public.stripe_sale_checkout_effects", "effect"],
    ["UPDATE public.stripe_sale_checkout_effects SET settlement_status = 'rejected'", "effect"],
    ["UPDATE public.stripe_sale_checkout_effects SET sale_id = NULL", "effect"],
    ["UPDATE public.sales SET stripe_checkout_session_id = 'cs_wrong'", "sale"],
    ["UPDATE public.sales SET amount_due = 1", "sale"],
    ["UPDATE public.sales SET status = 'cancelled'", "sale"],
    ["UPDATE public.sales SET status = 'refunded'", "sale"],
    ["DELETE FROM public.sales", "sale"],
  ])("preserves eligibility guard: %s", (sql, kind) => {
    db(sql)
    deny(call(), kind === "effect" ? "Stripe settlement effect is not eligible" : "Stripe sale is not eligible for financial effects")
  })

  it("denies mismatched caller sale/session bindings", () => {
    deny(call("100", "USD", uuid(99)), "Stripe settlement effect is not eligible")
    deny(call("100", "USD", sale, "cs_missing"), "Stripe settlement effect is not eligible")
  })

  it("rolls back all financial effects on failure and safely retries at the then-current plan", () => {
    db(`CREATE FUNCTION public.fail_commission() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Injected commission failure'; END; $$;
      CREATE TRIGGER fail_commission BEFORE INSERT ON public.transactions
        FOR EACH ROW EXECUTE FUNCTION public.fail_commission();`)
    deny(call(), "Injected commission failure")
    db(`DROP TRIGGER fail_commission ON public.transactions; DROP FUNCTION public.fail_commission();
      UPDATE public.billing SET plan = 'foundry';`)
    expect(apply()).toEqual({ status: "completed", balance_credit: 94.5, commission_amount: 5.5 })
    expect(state()).toMatchObject({ balance: "104.6234", payments: 2, transactions: 1, status: "completed" })
  })

  it("retains SECURITY DEFINER, pinned search_path, RLS and service-only execution", () => {
    expect(JSON.parse(db(`SELECT jsonb_build_object(
      'service', has_function_privilege('service_role', '${signature}', 'EXECUTE'),
      'authenticated', has_function_privilege('authenticated', '${signature}', 'EXECUTE'),
      'anon', has_function_privilege('anon', '${signature}', 'EXECUTE'),
      'public', EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) a
        WHERE p.oid = '${signature}'::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
      'definer', (SELECT prosecdef FROM pg_proc WHERE oid = '${signature}'::regprocedure),
      'config', (SELECT proconfig FROM pg_proc WHERE oid = '${signature}'::regprocedure),
      'rls', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.stripe_sale_checkout_effects'::regclass));`))).toEqual({
      service: true, authenticated: false, anon: false, public: false,
      definer: true, config: ["search_path=public, pg_temp"], rls: true,
    })
    for (const role of ["authenticated", "anon"]) {
      deny(call(), "permission denied for function apply_stripe_sale_financial_effects", role)
    }
    // The RPC, not direct table access, is the granted service-role surface here.
    expect(() => actor("SELECT count(*) FROM public.billing")).toThrow("permission denied for table billing")
    expect(apply().status).toBe("completed")
  })

  it("reapplying forward DDL preserves rows and restores browser revocations", () => {
    apply()
    const before = snapshot()
    db(`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC, anon, authenticated;`)
    db(migration)
    expect(snapshot()).toBe(before)
    expect(verify().verification_status).toBe("PASS")
  })

  it("read-only catalog script reports effective rates/guards/grants without changing rows", () => {
    const before = snapshot()
    const result = verify()
    expect(result.verification_status).toBe("PASS")
    expect(Object.values(result.checks).every(value => value === true)).toBe(true)
    expect(result.expected_total_fee_rates).toEqual({ enterprise: 0.045, foundry: 0.055, engine: 0.06, commission: 0.07 })
    expect(result.effective_definition).toContain("WHEN v_plan = 'foundry' THEN 0.055")
    expect(result.policy_comment).toContain("includes processing")
    expect(snapshot()).toBe(before)
  })

  it("read-only catalog script diagnoses old, missing and insecure installed definitions", () => {
    db(guard)
    const before = snapshot()
    const old = verify()
    expect(old.verification_status).toBe("FAIL")
    expect(old.checks["total_fee_case_enterprise_0.045"]).toBe(false)
    expect(old.effective_definition).toContain("THEN 0.02")
    expect(snapshot()).toBe(before)
    db(migration)
    db(`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC;`)
    expect(verify().checks.no_browser_or_public_execute).toBe(false)
    db(`DROP FUNCTION ${signature};`)
    const missing = verify()
    expect(missing.verification_status).toBe("FAIL")
    expect(missing.checks.four_argument_function_installed).toBe(false)
    expect(missing.effective_definition).toBeNull()
    expect(snapshot()).toBe(before)
  })
})