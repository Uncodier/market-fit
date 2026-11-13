/** @jest-environment node */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  actor, bootstrap, call, disposablePostgres, ids, migration,
  postgresAvailable, receipt, transfer, uuid,
} from "./movements-postgres"

const forward = readFileSync(path.join(process.cwd(),
  "supabase/migrations/20261113190000_inventory_writer_coordination.sql"), "utf8")
const suite = postgresAvailable ? describe : describe.skip
const literal = (value: string | null) => value === null ? "NULL" : `'${value}'`
const delta = (amount = "-1", floor = "false", item: string | null = ids.product,
  location: string | null = ids.target, site: string | null = ids.site) =>
  `SELECT public.apply_location_inventory_delta(${literal(site)},${literal(item)},${literal(location)},${amount},${floor});`

// Use mutable permissions and a real site row lock, not the original no-op
// license fixture, so revocation commits while the RPC is waiting on the site.
const coordinationFixture = `
  CREATE TABLE public.inventory_test_permissions(site_id uuid,user_id uuid,can_update boolean,
    PRIMARY KEY(site_id,user_id));
  INSERT INTO public.inventory_test_permissions VALUES
    ('${ids.site}','${ids.owner}',true), ('${ids.site}','${ids.restricted}',true),
    ('${ids.site}','${ids.viewer}',false), ('${ids.otherSite}','${ids.foreign}',true);
  GRANT SELECT ON public.inventory_test_permissions TO authenticated;
  CREATE OR REPLACE FUNCTION public.user_can(site uuid, command text) RETURNS boolean
    LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.inventory_test_permissions
      WHERE site_id=site AND user_id=auth.uid() AND (command='select' OR can_update)); $$;
  CREATE OR REPLACE FUNCTION public.lock_site_license(site uuid) RETURNS void
    LANGUAGE plpgsql AS $$ BEGIN
      PERFORM 1 FROM public.sites WHERE id=site FOR UPDATE;
    END; $$;
`

suite("forward inventory writer coordination in disposable socket-only PostgreSQL", () => {
  const postgres = disposablePostgres()
  const db = postgres.db
  const quantity = (location = ids.target, item = ids.product) => Number(db(
    `SELECT quantity FROM public.inventory_levels WHERE catalog_item_id='${item}' AND location_id='${location}';`))
  const counts = () => db(`SELECT (SELECT count(*) FROM public.inventory_operation_requests),
    (SELECT count(*) FROM public.inventory_movements);`)
  const snapshot = () => db(`SELECT jsonb_build_object(
    'levels',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.inventory_levels i),
    'purchases',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.purchases p),
    'requests',(SELECT jsonb_agg(to_jsonb(r)) FROM public.inventory_operation_requests r),
    'movements',(SELECT jsonb_agg(to_jsonb(m)) FROM public.inventory_movements m));`)
  const applyDelta = (sql = delta(), user: string | null = ids.owner, role = "authenticated") =>
    JSON.parse(db(actor(sql, user, role)))

  let sequence = 0
  type Session = { name: string; child: ChildProcessWithoutNullStreams; done: Promise<{ code: number | null; stdout: string; stderr: string }> }
  const sessions: Session[] = []
  function session(sql: string, open = false): Session {
    const name = `inventory_coordination_${++sequence}`
    const child = spawn(path.join(process.env.REQUIREMENT_TEST_PG_BIN ||
      "/opt/homebrew/opt/postgresql@17/bin", "psql"), [
      "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
      "-h", db("SHOW unix_socket_directories;"), "-p", db("SHOW port;"),
      "-U", "postgres", "-d", "postgres",
    ], { env: { ...process.env, LC_ALL: "C", LANG: "C" } })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", chunk => { stdout += chunk.toString() })
    child.stderr.on("data", chunk => { stderr += chunk.toString() })
    const done = new Promise<{ code: number | null; stdout: string; stderr: string }>(resolve => {
      child.on("error", error => { stderr += error.message })
      child.on("close", code => resolve({ code, stdout: stdout.trim(), stderr }))
    })
    child.stdin.write(`SET application_name='${name}'; SET statement_timeout='8s'; ${sql}\n`)
    if (!open) child.stdin.end()
    const result = { name, child, done }
    sessions.push(result)
    return result
  }
  const waitFor = async (name: string, condition: string) => {
    const deadline = Date.now() + 4000
    while (Date.now() < deadline) {
      if (db(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
        WHERE application_name='${name}' AND (${condition}));`) === "t") return
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    throw new Error(`Session ${name} did not reach ${condition}`)
  }
  const blockedBy = (name: string, blocker: string) => waitFor(name,
    `wait_event_type='Lock' AND EXISTS(SELECT 1 FROM pg_stat_activity b
      WHERE b.application_name='${blocker}' AND b.pid=ANY(pg_blocking_pids(pg_stat_activity.pid)))`)
  const successful = async (running: ReturnType<typeof session>) => {
    const result = await running.done
    expect(result.stderr).toBe("")
    expect(result.code).toBe(0)
    return JSON.parse(result.stdout)
  }
  const serialize = async (firstSql: string, secondSql: string) => {
    const first = session(`BEGIN; ${firstSql}`, true)
    try {
      await waitFor(first.name, "state='idle in transaction'")
      const second = session(secondSql)
      await blockedBy(second.name, first.name)
      first.child.stdin.end("COMMIT;\n")
      return await Promise.all([successful(first), successful(second)])
    } finally {
      if (!first.child.stdin.writableEnded) first.child.stdin.end("ROLLBACK;\n")
    }
  }

  beforeAll(() => postgres.start(), 30000)
  afterAll(() => postgres.stop())
  beforeEach(() => { db(bootstrap); db(coordinationFixture); db(migration()); db(forward) })
  afterEach(async () => {
    for (const running of sessions.splice(0)) {
      if (running.child.exitCode === null) running.child.kill("SIGTERM")
      await running.done
    }
  })

  it.each([true, false])("receipt 6.5 plus decrement 1 preserves 7.5 (receipt first: %s)", async receiptFirst => {
    expect(quantity()).toBe(2)
    const batch = actor(call([receipt()]))
    const decrement = actor(delta())
    await serialize(receiptFirst ? batch : decrement, receiptFirst ? decrement : batch)
    expect(quantity()).toBe(7.5)
    expect(quantity(ids.target, ids.secondProduct)).toBe(3)
    expect(quantity(ids.source)).toBe(10)
    expect(counts()).toBe("1|2")
    expect(db(`SELECT stock_received FROM public.purchases WHERE id='${ids.bill}';`)).toBe("t")
  })

  it.each([true, false])("transfer plus decrement loses no delta (transfer first: %s)", async transferFirst => {
    const batch = actor(call([transfer(3)]))
    const decrement = actor(delta())
    await serialize(transferFirst ? batch : decrement, transferFirst ? decrement : batch)
    expect(quantity(ids.source)).toBe(7)
    expect(quantity()).toBe(4)
    expect(counts()).toBe("1|1")
  })

  it.each(["batch", "delta"])("rechecks update permission after a real site lock wait: %s", async kind => {
    const before = snapshot()
    expect(db(actor(`SELECT public.user_can('${ids.site}','update');`))).toBe("t")
    const holder = session(`BEGIN; SELECT id FROM public.sites WHERE id='${ids.site}' FOR UPDATE;`, true)
    try {
      await waitFor(holder.name, "state='idle in transaction'")
      const waiting = session(actor(kind === "batch" ? call([receipt()]) : delta()))
      await blockedBy(waiting.name, holder.name)
      db(`UPDATE public.inventory_test_permissions SET can_update=false
        WHERE site_id='${ids.site}' AND user_id='${ids.owner}';`)
      holder.child.stdin.end("COMMIT;\n")
      const result = await waiting.done
      expect(result.code).not.toBe(0)
      expect(result.stderr).toMatch(/Inventory access denied/)
      expect(snapshot()).toBe(before)
    } finally {
      if (!holder.child.stdin.writableEnded) holder.child.stdin.end("ROLLBACK;\n")
    }
  })

  it.each(["anon", "authenticated", "service_role"])("denies direct private implementation calls: %s", role => {
    const before = snapshot()
    expect(db(`SELECT has_function_privilege('${role}',
      'public.apply_inventory_operations_locked(uuid,uuid,jsonb)','EXECUTE');`)).toBe("f")
    expect(() => db(actor(call([transfer()]).replace("apply_inventory_operations(",
      "apply_inventory_operations_locked("), ids.owner, role))).toThrow(/permission denied/)
    expect(snapshot()).toBe(before)
  })

  it("denies anonymous and identity-less calls without mutations", () => {
    const before = snapshot()
    for (const sql of [delta(), call([transfer()])]) {
      expect(() => db(actor(sql, null, "anon"))).toThrow(/permission denied/)
      expect(() => db(actor(sql, null))).toThrow(/Inventory access denied/)
    }
    expect(snapshot()).toBe(before)
  })

  it("permits service-role deltas without a user but denies batches even with an owner identity", () => {
    expect(applyDelta(delta(), null, "service_role")).toEqual({ quantity: 1 })
    const before = snapshot()
    for (const user of [null, ids.owner]) {
      expect(() => db(actor(call([transfer()]), user, "service_role"))).toThrow(/permission denied/)
    }
    expect(snapshot()).toBe(before)
    expect(counts()).toBe("0|0")
  })

  it.each([ids.viewer, ids.foreign])("denies deltas without site update permission: %s", user => {
    const before = snapshot()
    expect(() => applyDelta(delta(), user)).toThrow(/Inventory access denied/)
    expect(snapshot()).toBe(before)
  })

  it("enforces assigned location access for authenticated writers", () => {
    expect(applyDelta(delta(), ids.restricted)).toEqual({ quantity: 1 })
    const before = snapshot()
    expect(() => applyDelta(delta("1", "false", ids.product, ids.hidden), ids.restricted))
      .toThrow(/Inventory access denied/)
    expect(snapshot()).toBe(before)
  })

  it.each([
    delta("1", "false", ids.foreignProduct),
    delta("1", "false", ids.product, ids.foreignLocation),
    delta("1", "false", ids.product, ids.target, ids.otherSite),
    delta("1", "false", uuid(999)), delta("1", "false", ids.product, uuid(999)),
  ])("rejects invalid tenant/resource pairs even for service-role: %s", sql => {
    const before = snapshot()
    expect(() => applyDelta(sql, null, "service_role")).toThrow(/Invalid inventory (product|location)/)
    expect(snapshot()).toBe(before)
  })

  it.each(["NULL", "0", "'NaN'::numeric", "'Infinity'::numeric", "'-Infinity'::numeric",
    "1000000001", "-1000000001"])("rejects invalid/non-finite delta %s", amount => {
    const before = snapshot()
    expect(() => applyDelta(delta(amount))).toThrow(/Invalid inventory delta/)
    expect(snapshot()).toBe(before)
  })

  it.each([delta("1", "NULL"), delta("1", "false", null),
    delta("1", "false", ids.product, null), delta("1", "false", ids.product, ids.target, null)])(
    "rejects missing required inputs: %s", sql => {
      const before = snapshot()
      expect(() => applyDelta(sql)).toThrow(/Invalid inventory delta/)
      expect(snapshot()).toBe(before)
    })

  it("rolls back insufficient inventory unless floor-zero is explicitly enabled", () => {
    const before = snapshot()
    expect(() => applyDelta(delta("-3"))).toThrow(/Insufficient inventory/)
    expect(snapshot()).toBe(before)
    expect(applyDelta(delta("-3", "true"))).toEqual({ quantity: 0 })
    expect(applyDelta(delta("-1", "true"))).toEqual({ quantity: 0 })
    expect(applyDelta(delta("2.5", "true"))).toEqual({ quantity: 2.5 })
    expect(applyDelta(delta("-0.5"))).toEqual({ quantity: 2 })
    expect(counts()).toBe("0|0")
  })

  it.each(["NULL", "'NaN'::numeric", "'Infinity'::numeric", "'-Infinity'::numeric"])(
    "rejects invalid stored inventory %s without repairing or overwriting it", value => {
      db(`UPDATE public.inventory_levels SET quantity=${value} WHERE location_id='${ids.target}';`)
      const before = snapshot()
      expect(() => applyDelta(delta("1"))).toThrow(/Invalid inventory level/)
      expect(snapshot()).toBe(before)
    })

  it("creates a missing row safely under concurrent deltas", async () => {
    const sql = delta("1.25", "false", ids.secondProduct)
    await serialize(actor(sql), actor(delta("2.5", "false", ids.secondProduct)))
    expect(quantity(ids.target, ids.secondProduct)).toBe(3.75)
    expect(db(`SELECT count(*) FROM public.inventory_levels
      WHERE catalog_item_id='${ids.secondProduct}' AND location_id='${ids.target}';`)).toBe("1")
    expect(counts()).toBe("0|0")
  })

  it.each(["catalog_items", "inventory_levels"])("waits for the %s row and uses committed stock", async table => {
    const holder = session(`BEGIN; SELECT 1 FROM public.${table}
      WHERE ${table === "catalog_items" ? "id" : "catalog_item_id"}='${ids.product}' FOR UPDATE;`, true)
    try {
      await waitFor(holder.name, "state='idle in transaction'")
      const waiting = session(actor(delta()))
      await blockedBy(waiting.name, holder.name)
      holder.child.stdin.end(`UPDATE public.inventory_levels SET quantity=8.5
        WHERE catalog_item_id='${ids.product}' AND location_id='${ids.target}'; COMMIT;\n`)
      expect(await successful(waiting)).toEqual({ quantity: 7.5 })
      expect(quantity()).toBe(7.5)
    } finally {
      if (!holder.child.stdin.writableEnded) holder.child.stdin.end("ROLLBACK;\n")
    }
  })

  it("rejects a stored inventory row forged into another tenant", () => {
    db(`UPDATE public.inventory_levels SET site_id='${ids.otherSite}' WHERE location_id='${ids.target}';`)
    const before = snapshot()
    expect(() => applyDelta(delta("1"), null, "service_role")).toThrow(/Invalid inventory level/)
    expect(snapshot()).toBe(before)
  })

  it("does not leave a newly created zero row after a rejected decrement", () => {
    const before = snapshot()
    expect(() => applyDelta(delta("-1", "false", ids.secondProduct))).toThrow(/Insufficient inventory/)
    expect(snapshot()).toBe(before)
    expect(applyDelta(delta("-1", "true", ids.secondProduct))).toEqual({ quantity: 0 })
  })

  it("defaults floor-zero to false on the four-argument RPC", () => {
    const before = snapshot()
    const fourArguments = (amount: number) => `SELECT public.apply_location_inventory_delta(
      '${ids.site}','${ids.product}','${ids.target}',${amount});`
    expect(() => applyDelta(fourArguments(-3))).toThrow(/Insufficient inventory/)
    expect(snapshot()).toBe(before)
    expect(applyDelta(fourArguments(-0.5))).toEqual({ quantity: 1.5 })
  })

  it.each([delta(), call([transfer()])])("rejects non-READ-COMMITTED writers: %s", sql => {
    const before = snapshot()
    expect(() => db(actor(`BEGIN ISOLATION LEVEL REPEATABLE READ; ${sql} COMMIT;`)))
      .toThrow(/READ COMMITTED required/)
    expect(snapshot()).toBe(before)
  })
})