/** @jest-environment node */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"

const pgBin = process.env.DUE_DATE_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
const available = ["initdb", "pg_ctl", "psql"].every((file) => existsSync(path.join(pgBin, file)))
const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20261006210000_financial_due_dates.sql"), "utf8")
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
const site = uuid(1), otherSite = uuid(2), purchase = uuid(3)
const env = { ...process.env, LC_ALL: "C", LANG: "C" }

describe("financial due date migration contract", () => {
  it("adds nullable dates without a backfill or changed table access", () => {
    for (const table of ["sales", "subscriptions", "purchases"]) {
      expect(sql).toContain(`ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS due_date date;`)
    }
    expect(sql.trim().startsWith("BEGIN;")).toBe(true)
    expect(sql.trim().endsWith("COMMIT;")).toBe(true)
    expect(sql).not.toMatch(/UPDATE public\.(sales|subscriptions)|DROP TABLE|DISABLE TRIGGER|CREATE POLICY/)
    expect(sql).toContain("ON public.sales(site_id, due_date, id)")
    expect(sql).toContain("due_date IS NOT NULL AND amount_due > 0 AND status = 'pending'")
  })
  it("retains version, tenant, payment, and authorization guards for atomic bill edits", () => {
    expect(sql).toContain("'purchase_date','due_date','location_id'")
    expect(sql).toContain("due_date = replacement.due_date")
    expect(sql).toContain("previous.updated_at IS DISTINCT FROM p_expected_updated_at")
    expect(sql).toContain("id = p_purchase_id AND site_id = p_site_id FOR UPDATE")
    expect(sql).toContain("paid := greatest(recorded_paid, implicit_paid)")
    expect(sql).toContain("public.user_can(p_site_id, 'update')")
    expect(sql).toContain("SECURITY DEFINER SET search_path = public, pg_temp")
    expect(sql).toContain("FROM PUBLIC, anon, authenticated, service_role")
  })
})

;(available ? describe : describe.skip)("due dates in disposable local PostgreSQL", () => {
  let directory = ""
  const db = (query: string) => execFileSync(path.join(pgBin, "psql"), [
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", directory,
    "-p", "55442", "-U", "postgres", "-d", "postgres",
  ], { input: query, encoding: "utf8", stdio: "pipe", env, timeout: 20000 }).trim()
  const edit = (patch: object, options: { tenant?: string; version?: string; role?: string; subtotal?: number } = {}) => db(`
    SET ROLE ${options.role || "authenticated"};
    SELECT public.accounting_update_purchase_items('${options.tenant || site}', '${purchase}',
      '${options.version || "2026-10-06T00:00:00Z"}',
      '[{"name":"Materials","quantity":1,"unit_cost":120,"subtotal":${options.subtotal ?? 120}}]',
      '${JSON.stringify(patch)}'::jsonb);
  `)
  const state = () => JSON.parse(db(`SELECT json_build_object('due',due_date,'amount',amount,'paid',amount-amount_due,
    'item', (SELECT name FROM public.purchase_items WHERE purchase_id='${purchase}' LIMIT 1))
    FROM public.purchases WHERE id='${purchase}'`))

  beforeAll(() => {
    // Socket-only cluster: never read or use configured remote database credentials.
    directory = mkdtempSync("/tmp/due-date-pg-")
    execFileSync(path.join(pgBin, "initdb"), ["-D", path.join(directory, "data"), "-U", "postgres", "-A", "trust", "--no-locale"], { stdio: "pipe", env, timeout: 20000 })
    execFileSync(path.join(pgBin, "pg_ctl"), ["-D", path.join(directory, "data"), "-l", path.join(directory, "server.log"), "-o", `-F -p 55442 -k ${directory} -c listen_addresses='' -c lc_messages=C`, "-w", "start"], { stdio: "pipe", env, timeout: 20000 })
    db(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('role') $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${uuid(9)}'::uuid $$;
      CREATE FUNCTION public.user_can(p_site uuid, command text) RETURNS boolean LANGUAGE sql AS $$ SELECT p_site='${site}'::uuid $$;
      CREATE TABLE public.sales(id uuid, site_id uuid, status text, amount_due numeric);
      CREATE TABLE public.subscriptions(id uuid);
      CREATE TABLE public.purchases(id uuid PRIMARY KEY, site_id uuid, title text, vendor_company_id uuid,
        status text, currency text, purchase_date date, location_id uuid, notes text, amount numeric,
        amount_due numeric, payments jsonb, accounting_state text, updated_at timestamptz);
      CREATE TABLE public.purchase_items(purchase_id uuid, site_id uuid, catalog_item_id uuid, name text, quantity numeric, unit_cost numeric, subtotal numeric);
      CREATE TABLE public.locations(id uuid, site_id uuid);
      CREATE TABLE public.companies(id uuid);
      CREATE TABLE public.catalog_items(id uuid, site_id uuid);
    `)
    db(sql)
    db(sql) // Rerunnable DDL; does not overwrite data or remove protections.
  }, 30000)

  afterAll(() => {
    if (!directory) return
    if (existsSync(path.join(directory, "data/postmaster.pid"))) execFileSync(path.join(pgBin, "pg_ctl"), ["-D", path.join(directory, "data"), "-m", "fast", "-w", "stop"], { stdio: "pipe", env, timeout: 20000 })
    rmSync(directory, { recursive: true, force: true })
  })

  beforeEach(() => db(`
    TRUNCATE public.sales, public.subscriptions, public.purchases, public.purchase_items;
    INSERT INTO public.purchases(id,site_id,title,status,currency,purchase_date,amount,amount_due,payments,accounting_state,updated_at)
      VALUES('${purchase}','${site}','Bill','pending','USD','2026-10-06',100,60,
        '[{"amount":40}]','posted','2026-10-06T00:00:00Z');
    INSERT INTO public.purchase_items VALUES('${purchase}','${site}',NULL,'Original',1,100,100);
  `))

  it("preserves old null dates and accepts leap dates on all three sources", () => {
    expect(state().due).toBeNull()
    db(`INSERT INTO public.sales(due_date) VALUES('2028-02-29'); INSERT INTO public.subscriptions(due_date) VALUES('2028-02-29');`)
    for (const table of ["sales", "subscriptions", "purchases"]) {
      expect(() => db(`INSERT INTO public.${table}(due_date) VALUES('infinity')`)).toThrow()
      expect(() => db(`INSERT INTO public.${table}(due_date) VALUES('2026-02-30')`)).toThrow()
    }
  })
  it("saves and clears due date with lines without changing recorded paid amount", () => {
    edit({ due_date: "2026-10-20" })
    expect(state()).toEqual({ due: "2026-10-20", amount: 120, paid: 40, item: "Materials" })
    const version = db(`SELECT updated_at FROM public.purchases WHERE id='${purchase}'`)
    edit({ due_date: null }, { version })
    expect(state().due).toBeNull()
    expect(state().paid).toBe(40)
  })
  it("rejects cross-tenant, anonymous, stale, malformed, and failed-item changes atomically", () => {
    for (const options of [{ tenant: otherSite }, { role: "anon" }, { version: "2026-10-05" }, { subtotal: 1 }]) {
      expect(() => edit({ due_date: "2026-10-20" }, options)).toThrow()
      expect(state()).toEqual({ due: null, amount: 100, paid: 40, item: "Original" })
    }
    expect(() => edit({ due_date: "2026-02-30" })).toThrow()
    expect(state()).toEqual({ due: null, amount: 100, paid: 40, item: "Original" })
  })
})