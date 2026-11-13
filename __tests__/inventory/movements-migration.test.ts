/** @jest-environment node */
import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import {
  actor, adjustment, bootstrap, call, disposablePostgres, ids, migration,
  postgresAvailable, receipt, transfer, uuid,
} from "./movements-postgres"

const suite = postgresAvailable ? describe : describe.skip
suite("inventory operations in disposable socket-only PostgreSQL", () => {
  const postgres = disposablePostgres()
  const db = postgres.db
  const apply = (operations: unknown, request = uuid(100), user: string | null = ids.owner,
    role = "authenticated", site = ids.site) => JSON.parse(db(actor(call(operations, request, site), user, role)))
  const quantity = (location = ids.target, item = ids.product) => Number(db(
    `SELECT quantity FROM public.inventory_levels WHERE catalog_item_id='${item}' AND location_id='${location}';`))
  const counts = () => db(`SELECT (SELECT count(*) FROM public.inventory_operation_requests),
    (SELECT count(*) FROM public.inventory_movements);`)
  const pristine = () => {
    expect(quantity(ids.source)).toBe(10)
    expect(quantity()).toBe(2)
    expect(counts()).toBe("0|0")
    expect(db(`SELECT stock_received FROM public.purchases WHERE id='${ids.bill}';`)).toBe("f")
  }
  beforeAll(() => postgres.start(), 30000)
  afterAll(() => postgres.stop())
  beforeEach(() => { db(bootstrap); db(migration()) })

  it("atomically transfers counts and records immutable item/location snapshots and actor", () => {
    const result = apply([transfer()])
    expect(result).toEqual({ success: true, requestId: uuid(100),
      movementIds: [expect.any(String)], alreadyApplied: false })
    expect(quantity(ids.source)).toBe(7)
    expect(quantity()).toBe(5)
    expect(counts()).toBe("1|1")
    db(`UPDATE public.catalog_items SET name='Renamed'; UPDATE public.locations SET name='Renamed';`)
    expect(db(`SELECT actor_id,kind,item_name,from_location_name,to_location_name,quantity,notes
      FROM public.inventory_movements;`)).toBe(`${ids.owner}|transfer|Widget|Warehouse|Shop|3|Move stock`)
    expect(db(actor("SELECT count(*) FROM public.inventory_movements;"))).toBe("1")
    expect(() => db(actor("UPDATE public.inventory_movements SET quantity=999;"))).toThrow(/permission denied/)
    expect(() => db(actor("DELETE FROM public.inventory_movements;"))).toThrow(/permission denied/)
    expect(() => db(actor("SELECT * FROM public.inventory_operation_requests;"))).toThrow(/permission denied/)
  })

  it("replays the same request without additional writes and rejects payload or actor changes", () => {
    const first = apply([transfer()])
    expect(apply([transfer()])).toEqual({ ...first, alreadyApplied: true })
    expect(() => apply([transfer(4)])).toThrow(/Request ID conflict/)
    expect(() => apply([transfer()], uuid(100), ids.restricted)).toThrow(/Request ID conflict/)
    expect(quantity()).toBe(5)
    expect(counts()).toBe("1|1")
  })

  it("rechecks resource access on replay rather than disclosing previously stored results", () => {
    apply([transfer()])
    db(`UPDATE public.locations SET is_active=false WHERE id='${ids.target}';`)
    expect(() => apply([transfer()])).toThrow(/Invalid destination/)
    expect(quantity()).toBe(5)
    expect(counts()).toBe("1|1")
  })

  it("rolls back prior transfers, receipts, stock flags, request and movement rows on insufficient inventory", () => {
    expect(() => apply([transfer(1), receipt(), transfer(100)])).toThrow(/Insufficient inventory/)
    pristine()
    expect(db(`SELECT count(*) FROM public.inventory_levels WHERE catalog_item_id='${ids.secondProduct}';`)).toBe("0")
    expect(apply([transfer(2)]).success).toBe(true)
  })

  it.each([
    ["foreign site", [transfer()], ids.owner, "authenticated", ids.otherSite],
    ["unrelated actor", [transfer()], ids.foreign, "authenticated", ids.site],
    ["read-only actor", [transfer()], ids.viewer, "authenticated", ids.site],
    ["no identity", [transfer()], null, "authenticated", ids.site],
    ["anonymous", [transfer()], null, "anon", ids.site],
    ["service role", [transfer()], ids.owner, "service_role", ids.site],
    ["foreign destination", [transfer(1, { toLocationId: ids.foreignLocation })], ids.owner, "authenticated", ids.site],
    ["foreign source", [transfer(1, { fromLocationId: ids.foreignLocation })], ids.owner, "authenticated", ids.site],
    ["foreign product", [transfer(1, { catalogItemId: ids.foreignProduct })], ids.owner, "authenticated", ids.site],
    ["hidden source", [transfer(1, { fromLocationId: ids.hidden })], ids.restricted, "authenticated", ids.site],
    ["hidden destination", [transfer(1, { toLocationId: ids.hidden })], ids.restricted, "authenticated", ids.site],
    ["inactive location", [transfer(1, { toLocationId: ids.inactive })], ids.owner, "authenticated", ids.site],
    ["service item", [adjustment(1, { catalogItemId: ids.service })], ids.owner, "authenticated", ids.site],
  ])("denies %s without mutation", (_label, operations, user, role, site) => {
    expect(() => apply(operations, uuid(100), user as string | null, role as string, site as string)).toThrow()
    pristine()
  })

  it("history reads enforce both locations and tenant permissions", () => {
    apply([transfer(1, { toLocationId: ids.hidden })])
    expect(db(actor("SELECT count(*) FROM public.inventory_movements;", ids.restricted))).toBe("0")
    expect(db(actor("SELECT count(*) FROM public.inventory_movements;", ids.foreign))).toBe("0")
    expect(db(actor("SELECT count(*) FROM public.inventory_movements;", ids.viewer))).toBe("1")
    expect(() => db(actor("SELECT * FROM public.inventory_movements;", null, "anon"))).toThrow(/permission denied/)
  })

  it("receives server-owned aggregate product amounts, ignores services and creates absent levels", () => {
    const first = apply([receipt()])
    expect(first.movementIds).toHaveLength(2)
    expect(quantity()).toBe(8.5)
    expect(quantity(ids.target, ids.secondProduct)).toBe(3)
    expect(db(`SELECT location_id,stock_received FROM public.purchases WHERE id='${ids.bill}';`)).toBe(`${ids.target}|t`)
    expect(db(`SELECT count(*) FROM public.inventory_movements WHERE kind='receipt' AND purchase_id='${ids.bill}';`)).toBe("2")
    expect(apply([receipt()])).toEqual({ ...first, alreadyApplied: true })
    expect(apply([receipt()], uuid(101))).toEqual({ success: true, requestId: uuid(101),
      movementIds: [], alreadyApplied: false })
    expect(quantity()).toBe(8.5)
    expect(counts()).toBe("2|2")
    expect(() => apply([receipt({ toLocationId: ids.source })], uuid(102))).toThrow(/received elsewhere/)
  })

  it.each([
    ["client quantities", receipt({ quantity: 900 })],
    ["client item", receipt({ catalogItemId: ids.product })],
    ["cancelled bill", receipt({ purchaseId: ids.cancelled })],
    ["foreign bill", receipt({ purchaseId: ids.foreignBill })],
  ])("rejects receipt %s", (_label, operation) => {
    expect(() => apply([operation])).toThrow()
    pristine()
  })

  it("honors bill source-location access, including null/unscoped bills", () => {
    expect(() => apply([receipt()], uuid(100), ids.restricted)).toThrow(/Bill access denied/)
    db(`UPDATE public.purchases SET location_id='${ids.hidden}' WHERE id='${ids.bill}';`)
    expect(() => apply([receipt()], uuid(100), ids.restricted)).toThrow(/Bill access denied/)
    db(`UPDATE public.purchases SET location_id='${ids.source}' WHERE id='${ids.bill}';`)
    expect(apply([receipt()], uuid(100), ids.restricted).success).toBe(true)
  })

  it.each([
    ["destination", `location='${ids.target}'`, transfer()],
    ["source", `location='${ids.source}'`, transfer()],
    ["unscoped bill", "location IS NULL", receipt()],
  ])("fails closed when the %s location permission is NULL", (_label, condition, operation) => {
    db(`CREATE OR REPLACE FUNCTION public.user_can_access_location(site uuid, location uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT CASE WHEN ${condition} THEN NULL::boolean ELSE true END; $$;`)
    expect(() => apply([operation])).toThrow(/access denied/)
    pristine()
  })

  it("rejects duplicate pending bill operations atomically", () => {
    expect(() => apply([receipt(), receipt()])).toThrow(/Duplicate bill/)
    pristine()
  })

  it.each([0, -1, 1_000_000_001])("rejects invalid transfer quantity %s", quantity => {
    expect(() => apply([transfer(quantity)])).toThrow()
    pristine()
  })

  it.each([0, -1_000_000_001, 1_000_000_001])("rejects out-of-bounds adjustment %s", quantity => {
    expect(() => apply([adjustment(quantity)])).toThrow(/Invalid item or quantity/)
    pristine()
  })

  it("supports signed/fractional adjustments, exact bounds and prevents negative inventory", () => {
    apply([adjustment(-1.5)])
    expect(quantity()).toBe(0.5)
    expect(() => apply([adjustment(-1)], uuid(101))).toThrow(/Insufficient inventory/)
    expect(quantity()).toBe(0.5)
    apply([adjustment(1_000_000_000), adjustment(-1_000_000_000)], uuid(102))
    expect(quantity()).toBe(0.5)
    expect(counts()).toBe("2|3")
  })

  it.each([
    [], Array.from({ length: 101 }, () => adjustment()), null, {},
    [{ ...transfer(), unexpected: true }], [{ ...transfer(), quantity: "3" }],
    [{ ...transfer(), notes: "x".repeat(1001) }], [transfer(1, { toLocationId: ids.source })],
    [adjustment(1, { fromLocationId: ids.source })],
  ])("rejects malformed batch %#", operations => {
    expect(() => apply(operations)).toThrow()
    pristine()
  })

  it("rejects invalid server-owned aggregate receipt amounts and tenant mismatches", () => {
    for (const amount of ["-10", "NULL", "'NaN'", "1000000001"]) {
      db(`UPDATE public.purchase_items SET quantity=${amount} WHERE purchase_id='${ids.bill}' AND catalog_item_id='${ids.product}';`)
      expect(() => apply([receipt()])).toThrow(/Invalid bill (product )?quantity/)
      pristine()
    }
    db(`UPDATE public.purchase_items SET quantity=1,site_id='${ids.otherSite}' WHERE id='${uuid(50)}';`)
    expect(() => apply([receipt()])).toThrow(/Invalid bill item tenant/)
    pristine()
  })

  it("rejects negative bill lines even when their aggregate is positive", () => {
    db(`UPDATE public.purchase_items SET quantity=-1 WHERE id='${uuid(50)}';`)
    expect(() => apply([receipt()])).toThrow(/Invalid bill product quantity/)
    pristine()
  })

  it("rejects aggregate receipt overflow even when individual lines are within bounds", () => {
    db(`UPDATE public.purchase_items SET quantity=600000000
      WHERE purchase_id='${ids.bill}' AND catalog_item_id='${ids.product}';`)
    expect(() => apply([receipt()])).toThrow(/Invalid bill quantity/)
    pristine()
  })

  it("rejects a bill without product lines instead of marking it received", () => {
    db(`DELETE FROM public.purchase_items WHERE purchase_id='${ids.bill}' AND catalog_item_id<>'${ids.service}';`)
    expect(() => apply([receipt()])).toThrow(/No product lines/)
    pristine()
  })

  it("rolls back a license guard rejection before any inventory mutation", () => {
    db(`CREATE OR REPLACE FUNCTION public.lock_site_license(site uuid) RETURNS void
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'License denied' USING ERRCODE='42501'; END; $$;`)
    expect(() => apply([transfer(), receipt()])).toThrow(/License denied/)
    pristine()
  })

  it("requires READ COMMITTED isolation", () => {
    expect(() => db(actor(`BEGIN ISOLATION LEVEL REPEATABLE READ; ${call([transfer()])} COMMIT;`)))
      .toThrow(/READ COMMITTED required/)
    pristine()
  })

  const concurrent = async (operations: unknown, request: string) => {
    const bin = process.env.REQUIREMENT_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
    const socket = db("SHOW unix_socket_directories;")
    const result = await promisify(execFile)(path.join(bin, "psql"), [
      "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", socket,
      "-p", "55443", "-U", "postgres", "-d", "postgres", "-c", actor(call(operations, request)),
    ], { timeout: 20000, env: { ...process.env, LC_ALL: "C", LANG: "C" } })
    return JSON.parse(result.stdout.trim())
  }

  it("concurrent identical claims commit once and return identical movement IDs", async () => {
    const results = await Promise.all([concurrent([transfer(4)], uuid(100)), concurrent([transfer(4)], uuid(100))])
    expect(results.map(result => result.alreadyApplied).sort()).toEqual([false, true])
    expect(results[0].movementIds).toEqual(results[1].movementIds)
    expect(quantity(ids.source)).toBe(6)
    expect(quantity()).toBe(6)
    expect(counts()).toBe("1|1")
  })

  it("concurrent transfers cannot overspend available stock", async () => {
    const results = await Promise.allSettled([concurrent([transfer(7)], uuid(100)), concurrent([transfer(7)], uuid(101))])
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1)
    expect(quantity(ids.source)).toBe(3)
    expect(quantity()).toBe(9)
    expect(counts()).toBe("1|1")
  })

  it("concurrent receipt requests add stock only once", async () => {
    const results = await Promise.all([concurrent([receipt()], uuid(100)), concurrent([receipt()], uuid(101))])
    expect(results.map(result => result.movementIds.length).sort()).toEqual([0, 2])
    expect(quantity()).toBe(8.5)
    expect(quantity(ids.target, ids.secondProduct)).toBe(3)
    expect(counts()).toBe("2|2")
  })
})