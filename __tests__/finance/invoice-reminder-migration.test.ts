/** @jest-environment node */
import { execFile, execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"

const migrationPath = path.join(process.cwd(), "supabase/migrations/20261006230000_invoice_reminder_ledger.sql")
const migration = () => readFileSync(migrationPath, "utf8")
const pgBin = process.env.INVOICE_REMINDER_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
const available = ["initdb", "pg_ctl", "psql"].every((file) => existsSync(path.join(pgBin, file)))
const env = { ...process.env, LC_ALL: "C", LANG: "C" }
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
const site = uuid(1), foreignSite = uuid(2), sale = uuid(3), message = uuid(4), foreignSale = uuid(5)
type Claim = { claimed?: boolean; reason?: string; reminder?: { id: string; message_id: string | null; state: string } }

describe("invoice reminder migration service-only contract", () => {
  it("creates a protected durable receipt without changing historical financial rows", () => {
    const sql = migration().replace(/--[^\n]*/g, "").trim().toLowerCase()
    expect(sql.startsWith("begin;")).toBe(true)
    expect(sql.endsWith("commit;")).toBe(true)
    expect(sql).toContain("alter table public.invoice_reminders enable row level security")
    expect(sql).toContain("unique (site_id, sale_id, reminder_key)")
    expect(sql).toContain("security definer set search_path = public, pg_temp")
    expect(sql).not.toMatch(/update public\.sales|delete from public\.sales|disable trigger/)
  })
})

;(available ? describe : describe.skip)("invoice reminder claims in disposable local PostgreSQL", () => {
  let directory = ""
  const args = () => ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", directory,
    "-p", "55446", "-U", "postgres", "-d", "postgres"]
  const db = (query: string) => execFileSync(path.join(pgBin, "psql"), args(),
    { input: query, encoding: "utf8", stdio: "pipe", env, timeout: 20000 }).trim()
  const dbAsync = (query: string) => new Promise<string>((resolve, reject) => {
    const child = execFile(path.join(pgBin, "psql"), args(), { encoding: "utf8", env, timeout: 20000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message)); else resolve(stdout.trim())
    })
    child.stdin?.end(query)
  })
  const claimSql = (key: string, tenant = site, saleId = sale, days = "3", day = "'2026-10-06'") =>
    `SELECT public.claim_invoice_reminder('${tenant}', '${saleId}', '${key}', ${day}, ${days});`
  const claim = (key = "first", tenant = site, saleId = sale): Claim =>
    JSON.parse(db(`SET ROLE service_role; ${claimSql(key, tenant, saleId)}`))
  const count = () => Number(db("SELECT count(*) FROM public.invoice_reminders"))
  const state = () => db("SELECT state FROM public.invoice_reminders ORDER BY created_at DESC LIMIT 1")
  const cancel = (tenant = site) => db(`SET ROLE service_role; SELECT public.cancel_stale_invoice_reminder('${tenant}', '${sale}');`) === "t"
  const metadata = (extra: Record<string, unknown> = {}) => ({ status: "accepted", invoice_due_date: "2026-10-01",
    invoice_amount_due: 100, invoice_currency: "USD", ...extra })
  const ready = (extra: Record<string, unknown> = {}) => {
    const data = metadata(extra)
    db(`INSERT INTO public.messages VALUES('${message}', '${JSON.stringify(data)}'::jsonb);
      INSERT INTO public.invoice_reminders(site_id,sale_id,reminder_key,state,message_id)
      VALUES('${site}','${sale}','ready-original','ready','${message}');`)
    return data
  }
  const waitForLockHolder = async (name: string) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (db(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='PgSleep')`) === "t") return
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    throw new Error("Local PostgreSQL lock-holder session did not become ready")
  }

  beforeAll(() => {
    // New socket-only cluster. No configured database URL or remote project is used.
    directory = mkdtempSync("/tmp/invoice-reminder-pg-")
    execFileSync(path.join(pgBin, "initdb"), ["-D", path.join(directory, "data"), "-U", "postgres", "-A", "trust", "--no-locale"], { stdio: "pipe", env, timeout: 20000 })
    execFileSync(path.join(pgBin, "pg_ctl"), ["-D", path.join(directory, "data"), "-l", path.join(directory, "server.log"),
      "-o", `-F -p 55446 -k ${directory} -c listen_addresses='' -c lc_messages=C`, "-w", "start"], { stdio: "pipe", env, timeout: 20000 })
    // Only pre-existing columns needed by this migration are modeled. Nullable/malformed
    // financial fields deliberately exercise fail-closed behavior with legacy rows.
    db(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE TABLE public.sites(id uuid PRIMARY KEY);
      CREATE TABLE public.sales(id uuid PRIMARY KEY,site_id uuid,status text,amount_due numeric,due_date date,currency text);
      CREATE TABLE public.messages(id uuid PRIMARY KEY,custom_data jsonb);
      INSERT INTO public.sites VALUES('${site}'),('${foreignSite}');`)
    db(migration())
  }, 30000)

  afterAll(() => {
    if (!directory) return
    if (existsSync(path.join(directory, "data/postmaster.pid"))) execFileSync(path.join(pgBin, "pg_ctl"),
      ["-D", path.join(directory, "data"), "-m", "fast", "-w", "stop"], { stdio: "pipe", env, timeout: 20000 })
    rmSync(directory, { recursive: true, force: true })
  })

  beforeEach(() => db(`TRUNCATE public.invoice_reminders,public.messages,public.sales CASCADE;
    INSERT INTO public.sales VALUES('${sale}','${site}','pending',100,'2026-10-01','USD'),
      ('${foreignSale}','${foreignSite}','pending',100,'2026-10-01','USD');`))

  it("allows only service-role ledger access and RPC execution with RLS enabled", () => {
    expect(db("SELECT relrowsecurity FROM pg_class WHERE oid='public.invoice_reminders'::regclass")).toBe("t")
    for (const role of ["anon", "authenticated"]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        expect(db(`SELECT has_table_privilege('${role}','public.invoice_reminders','${privilege}')`)).toBe("f")
      }
      expect(() => db(`SET ROLE ${role}; ${claimSql("denied")}`)).toThrow()
      expect(() => db(`SET ROLE ${role}; SELECT public.cancel_stale_invoice_reminder('${site}','${sale}')`)).toThrow()
    }
    expect(claim().claimed).toBe(true)
  })

  it("claims exactly one generation across eight concurrent different keys", async () => {
    const results: Claim[] = (await Promise.all(Array.from({ length: 8 }, (_, index) =>
      dbAsync(`SET ROLE service_role; ${claimSql(`concurrent-${index}`)}`)))).map((value) => JSON.parse(value))
    expect(results.filter((result) => result.claimed)).toHaveLength(1)
    expect(results.filter((result) => result.reason === "reminder_uncertain")).toHaveLength(7)
    expect(new Set(results.map((result) => result.reminder?.id)).size).toBe(1)
    expect(count()).toBe(1)
  })

  it("waits for the sale lock and rechecks payment state after a concurrent settlement", async () => {
    const holder = dbAsync(`SET application_name='invoice-payment-lock'; BEGIN;
      UPDATE public.sales SET amount_due=0 WHERE id='${sale}'; SELECT pg_sleep(0.5); COMMIT;`)
    await waitForLockHolder("invoice-payment-lock")
    const result = JSON.parse(await dbAsync(`SET ROLE service_role; ${claimSql("after-payment")}`))
    await holder
    expect(result.reason).toBe("invoice_not_due")
    expect(count()).toBe(0)
  })

  it.each(["amount_due=0", "amount_due=NULL", "amount_due=-1", "amount_due='NaN'", "amount_due='Infinity'",
    "status='completed'", "status='cancelled'", "status='refunded'", "status=NULL", "due_date=NULL", "due_date='2026-10-07'",
    "due_date='infinity'", "due_date='-infinity'", "due_date='0001-01-01 BC'"])(
    "rejects ineligible financial state %s", (patch) => {
      db(`UPDATE public.sales SET ${patch} WHERE id='${sale}'`)
      expect(claim().reason).toBe("invoice_not_due")
      expect(count()).toBe(0)
    })

  it("accepts a due-today invoice but neither reads nor claims a foreign tenant sale", () => {
    db(`UPDATE public.sales SET due_date='2026-10-06' WHERE id='${sale}'`)
    expect(claim("foreign-site", foreignSite).reason).toBe("sale_not_found")
    expect(claim("foreign-sale", site, foreignSale).reason).toBe("sale_not_found")
    expect(claim("today").claimed).toBe(true)
    expect(cancel(foreignSite)).toBe(false)
    expect(state()).toBe("generating")
  })

  it.each(["0", "366", "NULL"])("rejects invalid interval %s", (days) => {
    expect(() => db(`SET ROLE service_role; ${claimSql("interval", site, sale, days)}`)).toThrow()
    expect(count()).toBe(0)
  })
  it.each(["NULL", "'infinity'", "'-infinity'", "'10000-01-01'", "'0001-01-01 BC'"])("rejects invalid local date %s", (day) => {
    expect(() => db(`SET ROLE service_role; ${claimSql("day", site, sale, "3", day)}`)).toThrow()
    expect(count()).toBe(0)
  })
  it.each(["NULL", "''", `'${"x".repeat(201)}'`])("rejects invalid reminder key %s", (key) => {
    expect(() => db(`SET ROLE service_role; SELECT public.claim_invoice_reminder('${site}','${sale}',${key},'2026-10-06',3)`)).toThrow()
    expect(count()).toBe(0)
  })

  it("blocks sent repeats before interval expiry, permits exact expiry, and never reuses a key", () => {
    claim("sent-original")
    db("UPDATE public.invoice_reminders SET state='sent',sent_at=now()-interval '2 days'")
    expect(claim("early").reason).toBe("repeat_interval")
    const expired = JSON.parse(db(`BEGIN; UPDATE public.invoice_reminders SET sent_at=now()-interval '3 days';
      SET LOCAL ROLE service_role; ${claimSql("exact-expiry")} COMMIT;`))
    expect(expired.claimed).toBe(true)
    db("UPDATE public.invoice_reminders SET state='sent',sent_at=now()-interval '4 days'")
    expect(claim("sent-original").reason).toBe("repeat_interval")
    expect(count()).toBe(2)
  })

  it.each(["generating", "uncertain"])("never replays an aged ambiguous %s receipt", (receiptState) => {
    claim("unknown-original")
    db(`UPDATE public.invoice_reminders SET state='${receiptState}',created_at=now()-interval '90 days'`)
    expect(claim("new-key").reason).toBe("reminder_uncertain")
    expect(cancel()).toBe(false)
    expect(count()).toBe(1)
  })

  it("returns the original ready message for retry without another generation", () => {
    ready()
    const retry = claim("different-key")
    expect(retry.claimed).toBeUndefined()
    expect(retry.reason).toBe("ready")
    expect(retry.reminder?.message_id).toBe(message)
    expect(count()).toBe(1)
    expect(cancel()).toBe(false)
  })

  it.each(["amount_due=0", "amount_due=50", "status='cancelled'", "due_date=NULL", "due_date='2026-11-01'", "currency='EUR'"])(
    "cancels proven pretransport stale-ready message after %s", (patch) => {
      ready()
      db(`UPDATE public.sales SET ${patch} WHERE id='${sale}'`)
      expect(cancel()).toBe(true)
      expect(state()).toBe("cancelled")
      const data = JSON.parse(db(`SELECT custom_data FROM public.messages WHERE id='${message}'`))
      expect(data.status).toBe("cancelled")
      expect(data.invoice_cancelled).toBe(true)
      expect(claim("ready-original").claimed).toBeUndefined()
    })

  it.each([
    { outreach_delivery: { state: "dispatching", attempt_id: "attempt" } },
    { outreach_delivery: { state: "sent", provider_message_id: "provider" } },
    { outreach_delivery: { state: "uncertain" } },
    { outreach_delivery: { state: "unrecognized" } },
    { outreach_delivery: { attempt_id: "ambiguous" } }, { outreach_delivery: null }, { outreach_delivery: { state: "" } },
    { outreach_delivery: { state: "blocked", sent_at: "2026-10-06T12:00:00Z" } },
    { outreach_delivery: { state: "blocked", provider_message_id: "provider" } },
    { outreach_delivery: { state: "blocked", provider_call_id: "call" } },
    { status: "sent" }, { delivery: { success: true } }, { provider_message_id: "provider" }, { provider_call_id: "call" },
    { external_message_id: "external" }, { sent_at: "2026-10-06T12:00:00Z" },
  ])("does not cancel or enable new generation after transport evidence %j", (extra) => {
    const original = ready(extra)
    db(`UPDATE public.sales SET amount_due=0 WHERE id='${sale}'`)
    expect(cancel()).toBe(false)
    expect(state()).toBe("ready")
    expect(JSON.parse(db(`SELECT custom_data FROM public.messages WHERE id='${message}'`))).toEqual(original)
    db(`UPDATE public.sales SET amount_due=100 WHERE id='${sale}'`)
    expect(claim("new-key").claimed).toBeUndefined()
    expect(count()).toBe(1)
  })

  it("cancels a blocked attempt only when no transport evidence exists", () => {
    ready({ outreach_delivery: { state: "blocked", reason: "invoice_changed" } })
    db(`UPDATE public.sales SET amount_due=50 WHERE id='${sale}'`)
    expect(cancel()).toBe(true)
    expect(state()).toBe("cancelled")
  })

  it.each(["sent_at=now()", "provider_message_id='provider'"])("retains inconsistent ready receipt with durable %s", (patch) => {
    ready()
    db(`UPDATE public.invoice_reminders SET ${patch}; UPDATE public.sales SET amount_due=0 WHERE id='${sale}'`)
    expect(cancel()).toBe(false)
    expect(state()).toBe("ready")
    db(`UPDATE public.sales SET amount_due=100 WHERE id='${sale}'`)
    expect(claim("new-key").claimed).toBeUndefined()
    expect(count()).toBe(1)
  })

  it("fails closed with malformed financial message metadata, leaving both rows untouched", () => {
    const original = ready({ invoice_amount_due: "not-a-number" })
    expect(() => cancel()).toThrow()
    expect(state()).toBe("ready")
    expect(JSON.parse(db(`SELECT custom_data FROM public.messages WHERE id='${message}'`))).toEqual(original)
    expect(claim("new-key").claimed).toBeUndefined()
    expect(count()).toBe(1)
  })

  it("retains ready ownership with a missing message rather than replaying generation", () => {
    claim()
    db("UPDATE public.invoice_reminders SET state='ready'")
    expect(cancel()).toBe(false)
    expect(claim("new-key").reason).toBe("ready")
    expect(count()).toBe(1)
  })

  it("invalidates a previously loaded delivery CAS when cancellation wins the message lock", async () => {
    const original = ready()
    db(`UPDATE public.sales SET amount_due=0 WHERE id='${sale}'`)
    expect(cancel()).toBe(true)
    const ids = db(`UPDATE public.messages SET custom_data='${JSON.stringify(metadata({ outreach_delivery: { state: "dispatching" } }))}'
      WHERE id='${message}' AND custom_data='${JSON.stringify(original)}'::jsonb RETURNING id;`)
    expect(ids).toBe("")
    expect(state()).toBe("cancelled")
  })

  it("preserves ambiguous dispatch when delivery wins the message lock", async () => {
    ready()
    db(`UPDATE public.sales SET amount_due=0 WHERE id='${sale}'`)
    const holder = dbAsync(`SET application_name='invoice-dispatch-lock'; BEGIN;
      UPDATE public.messages SET custom_data=custom_data || '{"outreach_delivery":{"state":"dispatching"}}'::jsonb WHERE id='${message}';
      SELECT pg_sleep(0.5); COMMIT;`)
    await waitForLockHolder("invoice-dispatch-lock")
    expect(await dbAsync(`SET ROLE service_role; SELECT public.cancel_stale_invoice_reminder('${site}','${sale}')`)).toBe("f")
    await holder
    expect(state()).toBe("ready")
  })
})