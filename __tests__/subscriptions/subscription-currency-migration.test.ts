/** @jest-environment node */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"

const pgBin = process.env.ATTRIBUTION_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
const suite = ["initdb", "pg_ctl", "psql"].every(file => existsSync(path.join(pgBin, file))) ? describe : describe.skip
const env = { ...process.env, LC_ALL: "C", LANG: "C" }
const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20261117010000_subscription_currency.sql"), "utf8")

suite("subscription currency in disposable PostgreSQL", () => {
  let directory = ""
  const db = (sql: string) => execFileSync(path.join(pgBin, "psql"), [
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", directory,
    "-p", "55449", "-U", "postgres", "-d", "postgres",
  ], { input: sql, encoding: "utf8", stdio: "pipe", env, timeout: 20000 }).trim()

  beforeAll(() => {
    directory = mkdtempSync("/tmp/subscription-currency-pg-")
    execFileSync(path.join(pgBin, "initdb"), ["-D", path.join(directory, "data"), "-U", "postgres", "-A", "trust", "--no-locale"], { stdio: "pipe", env, timeout: 20000 })
    execFileSync(path.join(pgBin, "pg_ctl"), ["-D", path.join(directory, "data"), "-l", path.join(directory, "server.log"),
      "-o", `-F -p 55449 -k ${directory} -c listen_addresses=''`, "-w", "start"], { stdio: "pipe", env, timeout: 20000 })
    db(`CREATE ROLE authenticated;
      CREATE TABLE public.subscriptions (id text PRIMARY KEY, site_id text);
      CREATE TABLE public.sales (id text PRIMARY KEY, subscription_id text, site_id text, currency text);
      INSERT INTO public.subscriptions VALUES ('sub', 'site'), ('foreign', 'other');
      INSERT INTO public.sales VALUES ('historical', 'sub', 'site', 'MXN');`)
    db(migration)
    db(`ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY own_site ON public.subscriptions TO authenticated USING (site_id = 'site') WITH CHECK (site_id = 'site');
      GRANT SELECT, UPDATE ON public.subscriptions TO authenticated;
      GRANT INSERT, SELECT, UPDATE ON public.sales TO authenticated;
      UPDATE public.subscriptions SET currency = 'USD' WHERE id = 'sub';
      UPDATE public.subscriptions SET currency = 'EUR' WHERE id = 'foreign';`)
  }, 30000)

  afterAll(() => {
    if (!directory) return
    if (existsSync(path.join(directory, "data/postmaster.pid"))) {
      execFileSync(path.join(pgBin, "pg_ctl"), ["-D", path.join(directory, "data"), "-m", "fast", "-w", "stop"], { stdio: "pipe", env, timeout: 20000 })
    }
    rmSync(directory, { recursive: true, force: true })
  })

  it("overrides external renewal inserts without rewriting invoice history", () => {
    db("SET ROLE authenticated; INSERT INTO public.sales VALUES ('renewal', 'sub', 'site', 'MXN');")
    expect(db("SELECT currency FROM public.sales WHERE id = 'renewal'")).toBe("USD")
    expect(db("SELECT currency FROM public.sales WHERE id = 'historical'")).toBe("MXN")
    db("SET ROLE authenticated; UPDATE public.sales SET currency = 'CAD' WHERE id = 'renewal';")
    expect(db("SELECT currency FROM public.sales WHERE id = 'renewal'")).toBe("CAD")
  })

  it("does not bypass RLS or use foreign-site overrides", () => {
    db("SET ROLE authenticated; UPDATE public.subscriptions SET currency = 'GBP' WHERE id = 'foreign';")
    expect(db("SELECT currency FROM public.subscriptions WHERE id = 'foreign'")).toBe("EUR")
    db("SET ROLE authenticated; INSERT INTO public.sales VALUES ('foreign-invoice', 'foreign', 'other', 'MXN');")
    expect(db("SELECT currency FROM public.sales WHERE id = 'foreign-invoice'")).toBe("MXN")
    db("INSERT INTO public.sales VALUES ('mismatch', 'foreign', 'site', 'MXN');")
    expect(db("SELECT currency FROM public.sales WHERE id = 'mismatch'")).toBe("MXN")
  })

  it("keeps legacy insert currency when no override is set and rejects malformed overrides", () => {
    db("INSERT INTO public.subscriptions (id, site_id) VALUES ('legacy', 'site'); INSERT INTO public.sales VALUES ('legacy-invoice', 'legacy', 'site', 'MXN');")
    expect(db("SELECT currency FROM public.sales WHERE id = 'legacy-invoice'")).toBe("MXN")
    expect(() => db("UPDATE public.subscriptions SET currency = 'invalid' WHERE id = 'legacy'")).toThrow()
  })
})