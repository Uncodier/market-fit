/** @jest-environment node */
import { execFile, execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"

const pgBin = process.env.BILLING_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
const available = ["initdb", "pg_ctl", "psql"].every(file => existsSync(path.join(pgBin, file)))
const suite = available ? describe : describe.skip
const migration = readFileSync(path.join(process.cwd(),
  "supabase/migrations/20261002210954_atomic_stripe_subscription_invoices.sql"), "utf8")
const site = "00000000-0000-4000-8000-000000000001"
const otherSite = "00000000-0000-4000-8000-000000000002"
const invoice = {
  site_id: site, invoice_id: "in_testInvoice", customer_id: "cus_testCustomer",
  subscription_id: "sub_testSubscription", payment_intent_id: "pi_testPayment",
  status: "paid", amount: 99, currency: "USD", billing_reason: "subscription_cycle",
  plan: "foundry", addons_count: 0, paid_at: "2026-10-02T19:00:00Z",
  invoice_url: null, event_id: "evt_testPaid",
}
const call = (overrides: Record<string, unknown> = {}) =>
  `SELECT public.settle_stripe_subscription_invoice('${JSON.stringify({ ...invoice, ...overrides })}'::jsonb);`

suite("atomic subscription invoice settlement in disposable PostgreSQL", () => {
  let directory = ""
  // Never use a configured connection string or inherit PG* connection settings.
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, NODE_ENV: "test", LC_ALL: "C", LANG: "C" }
  const args = () => ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
    "-h", directory, "-p", "55442", "-U", "postgres", "-d", "postgres"]
  const db = (sql: string) => execFileSync(path.join(pgBin, "psql"), args(),
    { input: sql, encoding: "utf8", stdio: "pipe", timeout: 20000, env }).trim()
  const state = () => JSON.parse(db(`SELECT json_build_object(
    'balance', (SELECT credits_available FROM public.billing WHERE site_id='${site}'),
    'payments', (SELECT count(*) FROM public.payments),
    'status', (SELECT status FROM public.payments LIMIT 1),
    'grants', (SELECT count(*) FROM public.credit_transactions),
    'settlements', (SELECT count(*) FROM public.stripe_subscription_invoice_settlements));`))

  beforeAll(() => {
    directory = mkdtempSync("/tmp/stripe-invoice-pg-")
    execFileSync(path.join(pgBin, "initdb"), ["-D", path.join(directory, "data"), "-A", "trust", "-U", "postgres"],
      { env, stdio: "pipe", timeout: 30000 })
    execFileSync(path.join(pgBin, "pg_ctl"), ["-D", path.join(directory, "data"), "-l", path.join(directory, "postgres.log"),
      "-o", `-k ${directory} -p 55442 -c listen_addresses=''`, "-w", "start"], { env, stdio: "pipe", timeout: 30000 })
    db(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE TABLE public.sites(id uuid PRIMARY KEY);
      CREATE TABLE public.billing(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid UNIQUE REFERENCES public.sites,
        plan text NOT NULL DEFAULT 'free', stripe_customer_id text, stripe_subscription_id text,
        credits_available numeric DEFAULT 0, credits_used numeric DEFAULT 0, updated_at timestamptz DEFAULT now());
      CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites,
        transaction_id text NOT NULL UNIQUE, transaction_type text NOT NULL, amount numeric NOT NULL, currency text NOT NULL,
        status text NOT NULL, payment_method text, details jsonb, credits integer DEFAULT 0, invoice_url text,
        created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE public.credit_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites,
        amount numeric NOT NULL, transaction_type text NOT NULL, description text, metadata jsonb DEFAULT '{}', created_at timestamptz DEFAULT now());
      INSERT INTO public.sites VALUES ('${site}'), ('${otherSite}');
      INSERT INTO public.billing(site_id,plan,stripe_customer_id,stripe_subscription_id,credits_available)
        VALUES ('${site}','startup','cus_testCustomer','sub_testSubscription',0.0011);
    `)
    db(migration)
  }, 60000)

  afterAll(() => {
    if (directory) {
      execFileSync(path.join(pgBin, "pg_ctl"), ["-D", path.join(directory, "data"), "-m", "immediate", "stop"],
        { env, stdio: "pipe", timeout: 20000 })
      rmSync(directory, { recursive: true, force: true })
    }
  })

  beforeEach(() => {
    db(`TRUNCATE public.stripe_subscription_invoice_settlements,public.payments,public.credit_transactions;
      DELETE FROM public.billing WHERE site_id='${otherSite}';
      UPDATE public.billing SET plan='foundry',credits_available=0.0011,credits_used=153.6823,
        stripe_customer_id='cus_testCustomer',stripe_subscription_id='sub_testSubscription' WHERE site_id='${site}';`)
  })

  it("normalizes subsequent legacy writes without changing unrelated plans", () => {
    db(`UPDATE public.billing SET plan='startup' WHERE site_id='${site}'`)
    expect(db(`SELECT plan FROM public.billing WHERE site_id='${site}'`)).toBe("foundry")
    db(`UPDATE public.billing SET plan='starter' WHERE site_id='${site}'`)
    expect(db(`SELECT plan FROM public.billing WHERE site_id='${site}'`)).toBe("engine")
    db(`INSERT INTO public.billing(site_id,plan) VALUES ('${otherSite}','free')`)
    expect(db(`SELECT plan FROM public.billing WHERE site_id='${otherSite}'`)).toBe("free")
  })

  it("recovers failed -> paid in the same payment row and grants once", () => {
    const failed = JSON.parse(db(call({ status: "failed", paid_at: null })))
    const settled = JSON.parse(db(call()))
    expect(settled).toEqual({ outcome: "settled", payment_id: failed.payment_id, credits_granted: 100 })
    expect(state()).toEqual({ balance: 100.0011, payments: 1, status: "completed", grants: 1, settlements: 1 })
    expect(JSON.parse(db(call({ event_id: "evt_otherPaidEvent" })))).toMatchObject({ outcome: "duplicate", credits_granted: 0 })
    expect(state().balance).toBe(100.0011)
    expect(db(`SELECT credits_used FROM public.billing WHERE site_id='${site}'`)).toBe("153.6823")
  })

  it("repeated failures do not conflict and a late failure never downgrades payment", () => {
    db(call({ status: "failed", paid_at: null }))
    db(call({ status: "failed", paid_at: null, event_id: "evt_failedAgain" }))
    expect(state()).toMatchObject({ payments: 1, grants: 0, status: "failed" })
    db(call())
    expect(JSON.parse(db(call({ status: "failed", amount: 0, paid_at: null })))).toMatchObject({ outcome: "ignored_failure" })
    expect(state()).toMatchObject({ balance: 100.0011, status: "completed", grants: 1 })
  })

  it("serializes simultaneous events for one invoice", async () => {
    const results = await Promise.all([1, 2, 3, 4].map(i => promisify(execFile)(path.join(pgBin, "psql"),
      [...args(), "-c", `SET ROLE service_role; ${call({ event_id: `evt_parallel${i}` })}`], { env, encoding: "utf8", timeout: 20000 })))
    expect(results.map(x => JSON.parse(x.stdout.trim()).outcome).filter(x => x === "settled")).toHaveLength(1)
    expect(state()).toEqual({ balance: 100.0011, payments: 1, status: "completed", grants: 1, settlements: 1 })
  })

  it("rolls back payment, balance and settlement when the credit ledger fails", () => {
    db(call({ status: "failed", paid_at: null }))
    db(`CREATE FUNCTION public.reject_credit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Injected credit failure'; END; $$;
      CREATE TRIGGER reject_credit BEFORE INSERT ON public.credit_transactions FOR EACH ROW EXECUTE FUNCTION public.reject_credit();`)
    try {
      expect(() => db(call())).toThrow("Injected credit failure")
      expect(state()).toEqual({ balance: 0.0011, payments: 1, status: "failed", grants: 0, settlements: 0 })
    } finally { db("DROP TRIGGER reject_credit ON public.credit_transactions; DROP FUNCTION public.reject_credit();") }
    db(call())
    expect(state().balance).toBe(100.0011)
  })

  it.each(["anon", "authenticated"])("denies settlement and ledger access to %s", role => {
    expect(() => db(`SET ROLE ${role}; ${call()}`)).toThrow("permission denied")
    expect(() => db(`SET ROLE ${role}; SELECT * FROM public.stripe_subscription_invoice_settlements`)).toThrow("permission denied")
    expect(state().balance).toBe(0.0011)
  })

  it("rejects forged tenant/customer/subscription and invoice rebinding", () => {
    expect(() => db(call({ customer_id: "cus_other" }))).toThrow("identity mismatch")
    expect(() => db(call({ subscription_id: "sub_other" }))).toThrow("identity mismatch")
    expect(() => db(call({ site_id: otherSite }))).toThrow("no billing record")
    db(call())
    expect(() => db(call({ amount: 50 }))).toThrow("identity mismatch")
    db(`INSERT INTO public.billing(site_id,stripe_customer_id,stripe_subscription_id) VALUES
      ('${otherSite}','cus_testCustomer','sub_testSubscription')`)
    expect(() => db(call({ site_id: otherSite }))).toThrow("identity mismatch")
  })

  it.each([{ amount: -1 }, { currency: "usd" }, { addons_count: -1 }, { addons_count: 101 },
    { plan: "startup" }, { plan: null }, { paid_at: null }, { billing_reason: null }])("rejects invalid input %j", input => {
    expect(() => db(call(input))).toThrow("Invalid verified Stripe invoice")
    expect(state().payments).toBe(0)
  })

  it("uses the same invoice for initial checkout and invoice events", () => {
    db(call({ billing_reason: "subscription_create", plan: "engine", addons_count: 2 }))
    db(call({ billing_reason: "subscription_create", plan: "engine", addons_count: 2, event_id: "evt_checkout" }))
    expect(state()).toMatchObject({ balance: 30.0011, payments: 1, grants: 1 })
  })

  it("does not grant monthly credits for a proration invoice", () => {
    db(call({ billing_reason: "subscription_update" }))
    expect(state()).toMatchObject({ balance: 0.0011, payments: 1, status: "completed", grants: 0, settlements: 1 })
  })

  it("refuses ambiguous historical completed invoices instead of double-crediting", () => {
    db(call({ status: "failed", paid_at: null }))
    db("UPDATE public.payments SET status='completed'")
    expect(() => db(call())).toThrow("Legacy completed invoice requires credit reconciliation")
    expect(JSON.parse(db(call({ status: "failed", paid_at: null })))).toMatchObject({ outcome: "ignored_failure" })
    expect(state()).toMatchObject({ balance: 0.0011, grants: 0 })
  })

  it("refuses a historical recovery credit or initial checkout without guessing", () => {
    db(`INSERT INTO public.credit_transactions(site_id,amount,transaction_type,metadata)
      VALUES ('${site}',100,'subscription_renewal_recovery','{"stripe_invoice_id":"in_testInvoice"}')`)
    expect(() => db(call())).toThrow("historical credits")
    db("TRUNCATE public.credit_transactions")
    db(`INSERT INTO public.payments(site_id,transaction_id,transaction_type,amount,currency,status,details)
      VALUES ('${site}','stripe_cs_old','subscription',99,'USD','completed',
        '{"stripe_subscription_id":"sub_testSubscription","stripe_session_id":"cs_old"}')`)
    expect(() => db(call({ billing_reason: "subscription_create" }))).toThrow("Legacy subscription checkout")
  })
})