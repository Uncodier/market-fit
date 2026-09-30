/** @jest-environment node */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"

const pgBin = process.env.ATTRIBUTION_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
const available = ["initdb", "pg_ctl", "psql"].every(file => existsSync(path.join(pgBin, file)))
const suite = available ? describe : describe.skip
const pgEnv = { ...process.env, LC_ALL: "C", LANG: "C" }
const original = readFileSync(path.join(process.cwd(), "supabase/migrations/20260917220000_sale_order_attribution.sql"), "utf8")
const repair = () => readFileSync(path.join(process.cwd(), "supabase/migrations/20260929224000_repair_sale_order_attribution.sql"), "utf8")
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
const owner = uuid(1)
const cashier = uuid(2)
const seller = uuid(3)
const inactive = uuid(4)
const outsider = uuid(5)
const site = uuid(10)
const otherSite = uuid(11)
const lead = uuid(20)
const otherLead = uuid(21)

describe("sale order attribution repair contract", () => {
  it("locks the table and removes only attribution guards before backfilling in one transaction", () => {
    const sql = repair().replace(/--[^\n]*/g, "").trim()
    const update = sql.indexOf("UPDATE public.sale_orders AS orders")
    expect(sql.startsWith("BEGIN;")).toBe(true)
    expect(sql.endsWith("COMMIT;")).toBe(true)
    const lock = sql.indexOf("LOCK TABLE public.sale_orders IN ACCESS EXCLUSIVE MODE;")
    expect(lock).toBeGreaterThan(0)
    for (const name of ["preserve_sale_order_creator", "validate_sale_order_attribution"]) {
      const drop = sql.indexOf(`DROP TRIGGER IF EXISTS ${name} ON public.sale_orders;`)
      expect(drop).toBeGreaterThan(lock)
      expect(drop).toBeLessThan(update)
      expect(sql.indexOf(`CREATE TRIGGER ${name}`)).toBeGreaterThan(update)
    }
    expect(sql.match(/DROP TRIGGER/g)).toHaveLength(2)
    expect(sql).not.toMatch(/DISABLE TRIGGER|session_replication_role|SECURITY DEFINER/)
  })

  it("retains the exact original runtime guard functions without a privileged bypass", () => {
    for (const name of ["preserve_sale_order_creator", "validate_sale_order_attribution"]) {
      const functionSql = (sql: string) => sql.slice(sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`)).split("$$;")[0]
      expect(functionSql(repair())).toBe(functionSql(original))
    }
  })
})

suite("sale order attribution repair in disposable PostgreSQL", () => {
  let directory = ""
  const db = (sql: string) => execFileSync(path.join(pgBin, "psql"), [
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", directory,
    "-p", "55440", "-U", "postgres", "-d", "postgres",
  ], { input: sql, encoding: "utf8", stdio: "pipe", timeout: 20000, env: pgEnv }).trim()
  const actor = (sql: string, role = "authenticated") => db(`SET ROLE ${role}; ${sql}`)
  const attribution = (id: string) => JSON.parse(db(`SELECT json_build_array(
    created_by_user_id, seller_user_id, requested_by_lead_id
  ) FROM public.sale_orders WHERE id = '${id}'`))
  const installOriginal = () => db(original)
  const insertLegacyOrder = (id = "pos", user = cashier, source = "pos") => db(`
    INSERT INTO public.sales VALUES ('${id}', '${site}', '${source}', '${lead}');
    INSERT INTO public.sale_orders (id, site_id, sale_id, user_id)
      VALUES ('${id}', '${site}', '${id}', '${user}');
  `)

  beforeAll(() => {
    // Socket-only disposable cluster: never use DATABASE_URL or a remote project.
    directory = mkdtempSync("/tmp/attribution-pg-")
    execFileSync(path.join(pgBin, "initdb"), [
      "-D", path.join(directory, "data"), "-U", "postgres", "-A", "trust", "--no-locale",
    ], { stdio: "pipe", env: pgEnv, timeout: 20000 })
    execFileSync(path.join(pgBin, "pg_ctl"), [
      "-D", path.join(directory, "data"), "-l", path.join(directory, "server.log"),
      "-o", `-F -p 55440 -k ${directory} -c listen_addresses='' -c lc_messages=C`, "-w", "start",
    ], { stdio: "pipe", env: pgEnv, timeout: 20000 })
    db("CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;")
  }, 30000)

  afterAll(() => {
    if (!directory) return
    if (existsSync(path.join(directory, "data/postmaster.pid"))) {
      execFileSync(path.join(pgBin, "pg_ctl"), [
        "-D", path.join(directory, "data"), "-m", "fast", "-w", "stop",
      ], { stdio: "pipe", env: pgEnv, timeout: 20000 })
    }
    rmSync(directory, { recursive: true, force: true })
  })

  beforeEach(() => {
    // Only the pre-existing columns required by these migrations are modeled.
    db(`
      DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
      CREATE SCHEMA public; CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE TABLE public.sites (id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users);
      CREATE TABLE public.site_members (site_id uuid REFERENCES public.sites, user_id uuid REFERENCES auth.users, status text);
      CREATE TABLE public.leads (id uuid PRIMARY KEY, site_id uuid REFERENCES public.sites);
      CREATE TABLE public.sales (id text PRIMARY KEY, site_id uuid REFERENCES public.sites, source text, lead_id uuid REFERENCES public.leads);
      CREATE TABLE public.sale_orders (id text PRIMARY KEY, site_id uuid REFERENCES public.sites,
        sale_id text REFERENCES public.sales, user_id uuid REFERENCES auth.users, notes text);
      INSERT INTO auth.users VALUES ('${owner}'), ('${cashier}'), ('${seller}'), ('${inactive}'), ('${outsider}');
      INSERT INTO public.sites VALUES ('${site}', '${owner}'), ('${otherSite}', '${outsider}');
      INSERT INTO public.site_members VALUES ('${site}', '${cashier}', 'active'),
        ('${site}', '${seller}', 'active'), ('${site}', '${inactive}', 'inactive');
      INSERT INTO public.leads VALUES ('${lead}', '${site}'), ('${otherLead}', '${otherSite}');
      GRANT USAGE ON SCHEMA public, auth TO authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    `)
  })

  it("reproduces the original failure and repairs rows with the guard already installed", () => {
    installOriginal()
    insertLegacyOrder()
    expect(() => db(`BEGIN; ${original} COMMIT;`)).toThrow("created_by_user_id is immutable")
    expect(attribution("pos")).toEqual([null, null, null])
    db(repair())
    expect(attribution("pos")).toEqual([cashier, cashier, lead])
  })

  it("also completes a fresh or partially installed attribution schema", () => {
    db("ALTER TABLE public.sale_orders ADD COLUMN created_by_user_id uuid REFERENCES auth.users ON DELETE SET NULL;")
    insertLegacyOrder()
    db(repair())
    expect(attribution("pos")).toEqual([cashier, cashier, lead])
    expect(db(`SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
      AND indexname IN ('sale_orders_site_created_by_idx', 'sale_orders_site_seller_idx', 'sale_orders_site_requested_by_idx')`)).toBe("3")
  })

  it("does not rewrite data after a successful original migration", () => {
    insertLegacyOrder()
    installOriginal()
    const version = db("SELECT xmin FROM public.sale_orders WHERE id = 'pos'")
    db(repair())
    expect(attribution("pos")).toEqual([cashier, cashier, lead])
    expect(db("SELECT xmin FROM public.sale_orders WHERE id = 'pos'")).toBe(version)
  })

  it("backfills historical inactive cashiers without weakening runtime seller validation", () => {
    installOriginal()
    insertLegacyOrder("inactive", inactive)
    db(repair())
    expect(attribution("inactive")).toEqual([inactive, inactive, lead])
    expect(() => actor(`UPDATE public.sale_orders SET seller_user_id = '${inactive}' WHERE id = 'inactive'`))
      .toThrow("seller_user_id must be an active member of the order site")
  })

  it("preserves existing attribution independently and does not update rows on replay", () => {
    installOriginal()
    insertLegacyOrder("seller-only")
    const requester = uuid(22)
    db(`INSERT INTO public.leads VALUES ('${requester}', '${site}');
      UPDATE public.sale_orders SET seller_user_id = '${seller}' WHERE id = 'seller-only';
      INSERT INTO public.sale_orders (id, site_id, sale_id, user_id, created_by_user_id, requested_by_lead_id)
        VALUES ('creator-only', '${site}', 'seller-only', '${cashier}', '${owner}', '${requester}');`)
    db(repair())
    expect(attribution("seller-only")).toEqual([cashier, seller, lead])
    expect(attribution("creator-only")).toEqual([owner, cashier, requester])
    const versions = db("SELECT id, xmin FROM public.sale_orders ORDER BY id")
    db(repair())
    expect(db("SELECT id, xmin FROM public.sale_orders ORDER BY id")).toBe(versions)
  })

  it("does not attribute storefront creators or sellers, but still fills the requester", () => {
    installOriginal()
    insertLegacyOrder("shop", owner, "shop")
    db(repair())
    expect(attribution("shop")).toEqual([null, null, lead])
  })

  it("skips cross-site sales and leads and orders without a cashier", () => {
    installOriginal()
    insertLegacyOrder("wrong-sale")
    insertLegacyOrder("wrong-lead")
    insertLegacyOrder("no-cashier")
    db(`UPDATE public.sales SET site_id = '${otherSite}' WHERE id = 'wrong-sale';
      UPDATE public.sales SET lead_id = '${otherLead}' WHERE id = 'wrong-lead';
      UPDATE public.sale_orders SET user_id = NULL WHERE id = 'no-cashier';`)
    db(repair())
    expect(attribution("wrong-sale")).toEqual([null, null, null])
    expect(attribution("wrong-lead")).toEqual([cashier, cashier, null])
    expect(attribution("no-cashier")).toEqual([null, null, lead])
  })

  it.each(["authenticated", "service_role"])("keeps every creator change forbidden for %s", role => {
    installOriginal()
    insertLegacyOrder()
    insertLegacyOrder("shop", owner, "shop")
    db(repair())
    for (const value of [`'${owner}'`, "NULL"]) {
      expect(() => actor(`UPDATE public.sale_orders SET created_by_user_id = ${value} WHERE id = 'pos'`, role))
        .toThrow("created_by_user_id is immutable")
    }
    expect(() => actor(`UPDATE public.sale_orders SET created_by_user_id = '${owner}' WHERE id = 'shop'`, role))
      .toThrow("created_by_user_id is immutable")
    actor("UPDATE public.sale_orders SET created_by_user_id = created_by_user_id, notes = 'Allowed'", role)
    expect(db("SELECT count(*) FROM public.sale_orders WHERE notes = 'Allowed'")).toBe("2")
  })

  it("restores seller and requester guards for inserts and updates", () => {
    insertLegacyOrder()
    db(repair())
    actor(`UPDATE public.sale_orders SET seller_user_id = '${owner}' WHERE id = 'pos'`)
    actor(`UPDATE public.sale_orders SET seller_user_id = '${seller}', requested_by_lead_id = '${lead}' WHERE id = 'pos'`)
    expect(() => actor(`UPDATE public.sale_orders SET seller_user_id = '${outsider}' WHERE id = 'pos'`))
      .toThrow("seller_user_id must be an active member of the order site")
    expect(() => actor(`UPDATE public.sale_orders SET requested_by_lead_id = '${otherLead}' WHERE id = 'pos'`))
      .toThrow("requested_by_lead_id must belong to the order site")
    expect(() => actor(`INSERT INTO public.sale_orders (id, site_id, seller_user_id) VALUES ('bad-seller', '${site}', '${inactive}')`))
      .toThrow("seller_user_id must be an active member of the order site")
    expect(() => actor(`INSERT INTO public.sale_orders (id, site_id, requested_by_lead_id) VALUES ('bad-lead', '${site}', '${otherLead}')`))
      .toThrow("requested_by_lead_id must belong to the order site")
  })

  it("rolls back data and restores the prior triggers when recovery fails", () => {
    installOriginal()
    insertLegacyOrder()
    const restore = "CREATE OR REPLACE FUNCTION public.preserve_sale_order_creator()"
    const failing = repair().replace(restore, `DO $$ BEGIN RAISE EXCEPTION 'Injected recovery failure'; END; $$; ${restore}`)
    expect(() => db(failing)).toThrow("Injected recovery failure")
    expect(attribution("pos")).toEqual([null, null, null])
    expect(db(`SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.sale_orders'::regclass
      AND tgname IN ('preserve_sale_order_creator', 'validate_sale_order_attribution') AND tgenabled = 'O'`)).toBe("2")
    expect(() => actor(`UPDATE public.sale_orders SET created_by_user_id = '${cashier}' WHERE id = 'pos'`))
      .toThrow("created_by_user_id is immutable")
    db(repair())
    expect(attribution("pos")).toEqual([cashier, cashier, lead])
  })

  it("leaves unrelated triggers, RLS, grants and foreign keys in place", () => {
    installOriginal()
    insertLegacyOrder()
    db(`CREATE FUNCTION public.keep_order_note() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.notes := 'Unrelated trigger ran'; RETURN NEW; END; $$;
      CREATE TRIGGER keep_order_note BEFORE UPDATE ON public.sale_orders
        FOR EACH ROW EXECUTE FUNCTION public.keep_order_note();
      ALTER TABLE public.sale_orders ENABLE ROW LEVEL SECURITY;
      CREATE POLICY owner_only ON public.sale_orders TO authenticated USING (false);`)
    db(repair())
    expect(db("SELECT notes FROM public.sale_orders WHERE id = 'pos'")).toBe("Unrelated trigger ran")
    expect(actor("SELECT count(*) FROM public.sale_orders")).toBe("0")
    expect(actor("SELECT count(*) FROM public.sale_orders", "service_role")).toBe("1")
    expect(() => actor(`INSERT INTO public.sale_orders (id, site_id, created_by_user_id)
      VALUES ('invalid-fk', '${site}', '${uuid(99)}')`, "service_role"))
      .toThrow("violates foreign key constraint")
  })
})