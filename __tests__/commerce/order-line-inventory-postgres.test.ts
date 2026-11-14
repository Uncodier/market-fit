/** @jest-environment node */
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { actor, bootstrap, disposablePostgres, ids, migration, postgresAvailable, uuid } from "../inventory/movements-postgres"

const sql = (name: string) => readFileSync(path.join(process.cwd(), "supabase/migrations", name), "utf8")
const forward = sql("20261114000000_order_line_inventory_receipts.sql")
const orderId = uuid(200)
const lineId = uuid(201)
const legacyId = uuid(202)
const insertLine = (id = lineId, metadata = "{}") => `INSERT INTO public.sale_order_items
  VALUES('${id}','${orderId}','${ids.site}','${ids.product}',4,'completed','${metadata}',NULL);`
const request = (quantity = "4", mode = "debit", line = lineId, location = ids.source, site = ids.site) =>
  `SELECT public.reconcile_order_line_inventory('${site}','${orderId}','${line}','${location}',${quantity},'${mode}');`

const suite = postgresAvailable ? describe : describe.skip
suite("order-line inventory receipts in disposable socket-only PostgreSQL", () => {
  const pg = disposablePostgres()
  const db = pg.db
  const call = (query = request()) => JSON.parse(db(actor(query)))
  const stock = () => Number(db(`SELECT quantity FROM public.inventory_levels
    WHERE catalog_item_id='${ids.product}' AND location_id='${ids.source}'`))
  const state = () => db(`SELECT row_to_json(r) FROM public.order_line_inventory_receipts r ORDER BY sale_order_item_id`)
  const asyncDb = (query: string) => new Promise<string>((resolve, reject) => {
    const child = spawn(path.join(process.env.REQUIREMENT_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin", "psql"),
      ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", db("SHOW unix_socket_directories"),
        "-p", db("SHOW port"), "-U", "postgres", "-d", "postgres"],
      { env: { ...process.env, LC_ALL: "C", LANG: "C" } })
    let output = "", error = ""
    child.stdout.on("data", value => { output += value })
    child.stderr.on("data", value => { error += value })
    child.on("error", reject)
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error)))
    child.stdin.end(query)
  })
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    db(bootstrap)
    db(migration())
    db(sql("20261113190000_inventory_writer_coordination.sql"))
    db(`ALTER TABLE public.catalog_items ADD track_inventory boolean DEFAULT true;
      CREATE OR REPLACE FUNCTION public.lock_site_license(site uuid) RETURNS void LANGUAGE plpgsql AS $$
        BEGIN PERFORM 1 FROM public.sites WHERE id=site FOR UPDATE; END; $$;
      CREATE TABLE public.settings(site_id uuid,commerce jsonb);
      CREATE TABLE public.sales(id uuid PRIMARY KEY,site_id uuid,source text);
      CREATE TABLE public.sale_orders(id uuid PRIMARY KEY,site_id uuid,origin_location_id uuid,status text,items jsonb,sale_id uuid);
      CREATE TABLE public.sale_order_items(id uuid PRIMARY KEY,sale_order_id uuid,site_id uuid,catalog_item_id uuid,
        quantity numeric,status text,metadata jsonb,shipment_id uuid);
      CREATE TABLE public.shipments(id uuid PRIMARY KEY,sale_order_id uuid,site_id uuid,origin_location_id uuid);
      CREATE FUNCTION public.is_self_service_order_items(items jsonb) RETURNS boolean LANGUAGE sql AS $$
        SELECT coalesce(items->>'self_service','false')='true'; $$;
      INSERT INTO public.sales VALUES('${uuid(203)}','${ids.site}','pos');
      INSERT INTO public.sale_orders VALUES('${orderId}','${ids.site}','${ids.source}','pending','{}','${uuid(203)}');
      ${insertLine(legacyId)}`)
    db(forward)
    db(insertLine())
  })

  it("debits completed operational lines exactly once without using status as debit evidence", () => {
    expect(call()).toMatchObject({ debited_quantity: 4, applied_quantity: 4, review_required: false })
    expect(stock()).toBe(6)
    expect(call()).toMatchObject({ applied_quantity: 0 })
    expect(stock()).toBe(6)
  })

  it("uses cumulative highwaters for increases and partial/full refund replays", () => {
    call(request("2")); call(request("4")); call(request("1"))
    expect(stock()).toBe(6)
    expect(call(request("1", "restock"))).toMatchObject({ restocked_quantity: 1, applied_quantity: 1 })
    call(request("1", "restock")); call(request("999", "restock")); call(request("4"))
    expect(stock()).toBe(10)
    db(`UPDATE public.sale_order_items SET quantity=5 WHERE id='${lineId}'`)
    expect(() => call(request("5"))).toThrow(/returned or cancelled/)
  })

  it("records durable review for historical lines rather than fabricating movement", () => {
    expect(call(request("4", "debit", legacyId))).toMatchObject({ review_required: true, applied_quantity: 0 })
    expect(call(request("4", "restock", legacyId))).toMatchObject({ review_required: true, applied_quantity: 0 })
    expect(db(`SELECT review_required FROM public.order_line_inventory_receipts WHERE sale_order_item_id='${legacyId}'`)).toBe("t")
    expect(stock()).toBe(10)
  })

  it("does not seed other inventory owners or infer zero after changing source", () => {
    db(`UPDATE public.sales SET source='shop'; ${insertLine(uuid(204))}; UPDATE public.sales SET source='pos'`)
    expect(db(`SELECT count(*) FROM public.order_line_inventory_receipts WHERE sale_order_item_id='${uuid(204)}'`)).toBe("0")
    expect(call(request("4", "debit", uuid(204)))).toMatchObject({ review_required: true, applied_quantity: 0 })
  })

  it("does not fabricate refunds or require review for explicit historical no-stock lines", () => {
    db(`UPDATE public.sale_order_items SET metadata='{"completed_without_stock":true}' WHERE id='${legacyId}'`)
    expect(call(request("4", "restock", legacyId))).toMatchObject({ review_required: false, skipped: true, applied_quantity: 0 })
    expect(stock()).toBe(10)
  })

  it.each(["never", "untracked", "explicit", "self-service"])("does not consume or invent receipts for %s", kind => {
    if (kind === "never") db(`INSERT INTO public.settings VALUES('${ids.site}','{"decrement_stock_on":"never"}')`)
    if (kind === "untracked") db(`UPDATE public.catalog_items SET track_inventory=false`)
    if (kind === "explicit") db(`UPDATE public.sale_order_items SET metadata='{"completed_without_stock":true}'`)
    if (kind === "self-service") db(`UPDATE public.sale_orders SET items='{"self_service":true}'`)
    expect(call()).toMatchObject({ skipped: true, debited_quantity: 0, review_required: false })
    call(request("4", "restock"))
    expect(stock()).toBe(10)
  })

  it("refunds actual debits even when current tracking/policy/metadata changed", () => {
    call()
    db(`UPDATE public.catalog_items SET track_inventory=false;
      UPDATE public.sale_order_items SET metadata='{"completed_without_stock":true}';
      INSERT INTO public.settings VALUES('${ids.site}','{"decrement_stock_on":"never"}')`)
    expect(call(request("4", "restock"))).toMatchObject({ applied_quantity: 4 })
    expect(stock()).toBe(10)
  })

  it.each(["never", "untracked", "explicit"])("does not retroactively debit a processed %s target", kind => {
    if (kind === "never") db(`INSERT INTO public.settings VALUES('${ids.site}','{"decrement_stock_on":"never"}')`)
    if (kind === "untracked") db(`UPDATE public.catalog_items SET track_inventory=false`)
    if (kind === "explicit") db(`UPDATE public.sale_order_items SET metadata='{"completed_without_stock":true}'`)
    expect(call()).toMatchObject({ skipped: true, applied_quantity: 0 })
    expect(db(`SELECT processed_quantity FROM public.order_line_inventory_receipts WHERE sale_order_item_id='${lineId}'`)).toBe("4")
    db(`DELETE FROM public.settings; UPDATE public.catalog_items SET track_inventory=true;
      UPDATE public.sale_order_items SET metadata='{}'`)
    expect(call()).toMatchObject({ skipped: false, applied_quantity: 0, debited_quantity: 0 })
    expect(stock()).toBe(10)
    db(`UPDATE public.sale_order_items SET quantity=5 WHERE id='${lineId}'`)
    expect(call(request("5"))).toMatchObject({ applied_quantity: 1, debited_quantity: 1 })
    expect(stock()).toBe(9)
  })

  it("does not guess a processed target for skipped ambiguous historical lines", () => {
    db(`INSERT INTO public.settings VALUES('${ids.site}','{"decrement_stock_on":"never"}')`)
    expect(call(request("4", "debit", legacyId))).toMatchObject({ skipped: true, applied_quantity: 0 })
    expect(db(`SELECT processed_quantity,review_required FROM public.order_line_inventory_receipts
      WHERE sale_order_item_id='${legacyId}'`)).toBe("0|t")
    db(`DELETE FROM public.settings`)
    expect(call(request("4", "debit", legacyId))).toMatchObject({ review_required: true, applied_quantity: 0 })
    expect(stock()).toBe(10)
  })

  it("rolls inventory back if the receipt write fails", () => {
    db(`CREATE FUNCTION public.fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'synthetic receipt failure'; END; $$;
      CREATE TRIGGER fail_receipt BEFORE UPDATE ON public.order_line_inventory_receipts
        FOR EACH ROW EXECUTE FUNCTION public.fail_receipt();`)
    const before = state()
    expect(() => call()).toThrow(/synthetic receipt failure/)
    expect(stock()).toBe(10)
    expect(state()).toBe(before)
  })

  it("processes shortages once but refunds only actual removed stock", () => {
    db(`UPDATE public.inventory_levels SET quantity=1 WHERE location_id='${ids.source}'`)
    expect(call()).toMatchObject({ debited_quantity: 1, applied_quantity: 1 })
    expect(stock()).toBe(0)
    db(`UPDATE public.inventory_levels SET quantity=8 WHERE location_id='${ids.source}'`)
    expect(call()).toMatchObject({ applied_quantity: 0 })
    expect(stock()).toBe(8)
    expect(call(request("4", "restock"))).toMatchObject({ applied_quantity: 1, restocked_quantity: 1 })
    expect(stock()).toBe(9)
  })

  it("serializes concurrent debit and refund replays", async () => {
    await Promise.all(Array.from({ length: 6 }, () => asyncDb(actor(request()))))
    expect(stock()).toBe(6)
    await Promise.all(Array.from({ length: 6 }, () => asyncDb(actor(request("4", "restock")))))
    expect(stock()).toBe(10)
    expect(call()).toMatchObject({ debited_quantity: 4, restocked_quantity: 4, applied_quantity: 0 })
  })

  it("coordinates with the existing atomic inventory writer", async () => {
    await Promise.all([asyncDb(actor(request())), asyncDb(actor(`SELECT public.apply_location_inventory_delta(
      '${ids.site}','${ids.product}','${ids.source}',3,false);`))])
    expect(stock()).toBe(9)
  })

  it("accepts zero-stock operational completion without retrying after replenishment", () => {
    db(`UPDATE public.inventory_levels SET quantity=0 WHERE location_id='${ids.source}'`)
    expect(call()).toMatchObject({ applied_quantity: 0, debited_quantity: 0, review_required: false })
    db(`UPDATE public.inventory_levels SET quantity=9 WHERE location_id='${ids.source}'`)
    expect(call()).toMatchObject({ applied_quantity: 0 })
    call(request("4", "restock"))
    db(`UPDATE public.sale_order_items SET quantity=5 WHERE id='${lineId}'`)
    expect(() => call(request("5"))).toThrow(/returned or cancelled/)
    expect(stock()).toBe(9)
  })

  it("restocks at the locked receipt location after order and shipment origins change", () => {
    call()
    db(`UPDATE public.sale_orders SET origin_location_id='${ids.target}'`)
    const restock = request("4", "restock").replace(`'${ids.source}'`, "NULL")
    expect(call(restock)).toMatchObject({ applied_quantity: 4 })
    expect(stock()).toBe(10)
    expect(() => call(request("4", "restock", lineId, ids.target))).toThrow(/identity mismatch/)
  })

  it("does not debit cancelled lines or malformed modes", () => {
    db(`UPDATE public.sale_order_items SET status='cancelled' WHERE id='${lineId}'`)
    expect(() => call()).toThrow(/cancelled/)
    expect(() => call(request("4", "refund"))).toThrow(/Invalid/)
    expect(stock()).toBe(10)
  })

  it("does not consume missing levels or allow a new debit after a zero-budget cancellation", () => {
    db(`DELETE FROM public.inventory_levels WHERE location_id='${ids.source}'`)
    expect(call()).toMatchObject({ debited_quantity: 0, applied_quantity: 0 })
    expect(stock()).toBe(0)
    expect(call(request("0", "restock"))).toMatchObject({ applied_quantity: 0 })
    db(`UPDATE public.sale_order_items SET quantity=5 WHERE id='${lineId}'`)
    expect(() => call(request("5"))).toThrow(/returned or cancelled/)
  })

  it.each(["NULL", "-1", "5", "1000000001", "'NaN'", "'Infinity'", "'-Infinity'"])("rejects malformed/out-of-budget target %s", quantity => {
    const before = state()
    expect(() => call(request(quantity))).toThrow(/Invalid/)
    expect(stock()).toBe(10)
    expect(state()).toBe(before)
  })

  it("rejects forged metadata, catalog tenant, and receipt identity", () => {
    db(`UPDATE public.sale_order_items SET metadata='{"completed_without_stock":"true"}' WHERE id='${lineId}'`)
    expect(() => call()).toThrow(/metadata/)
    db(`UPDATE public.sale_order_items SET metadata='{}',catalog_item_id='${ids.foreignProduct}' WHERE id='${lineId}'`)
    expect(() => call()).toThrow(/Invalid inventory product/)
    db(`UPDATE public.sale_order_items SET catalog_item_id='${ids.secondProduct}' WHERE id='${lineId}'`)
    expect(() => call()).toThrow(/identity mismatch/)
    expect(stock()).toBe(10)
  })

  it("rejects tenant/line/location scope even for service-role", () => {
    for (const query of [request("4", "debit", lineId, ids.source, ids.otherSite),
      request("4", "debit", uuid(999)), request("4", "debit", lineId, ids.foreignLocation),
      request("4", "debit", lineId, ids.target)]) {
      expect(() => db(actor(query, null, "service_role"))).toThrow(/Invalid/)
    }
    expect(stock()).toBe(10)
  })

  it("authenticates actors, enforces location scope and makes receipts read-only", () => {
    for (const who of [ids.viewer, ids.foreign]) expect(() => db(actor(request(), who))).toThrow(/access denied/)
    expect(() => db(actor(request(), null))).toThrow(/access denied/)
    expect(() => db(actor(request(), null, "anon"))).toThrow(/permission denied/)
    expect(() => db(actor(request("4", "debit", lineId, ids.hidden), ids.restricted))).toThrow(/access denied/)
    call()
    expect(db(actor("SELECT count(*) FROM public.order_line_inventory_receipts"))).toBe("1")
    expect(db(actor("SELECT count(*) FROM public.order_line_inventory_receipts", ids.foreign))).toBe("0")
    for (const role of ["authenticated", "service_role", "anon"]) {
      expect(() => db(actor("DELETE FROM public.order_line_inventory_receipts", ids.owner, role))).toThrow(/permission denied/)
    }
  })

  it("preserves budget after deletion/reinsertion and supports authorized service role", () => {
    expect(JSON.parse(db(actor(request(), null, "service_role")))).toMatchObject({ applied_quantity: 4 })
    db(`DELETE FROM public.sale_order_items WHERE id='${lineId}'; ${insertLine()}`)
    expect(call()).toMatchObject({ applied_quantity: 0 })
    expect(stock()).toBe(6)
  })

  const resolve = (line = legacyId, processed = "4", debited = "2", restocked = "0") =>
    `SELECT public.resolve_order_line_inventory_review('${ids.site}','${orderId}','${line}','${ids.source}',
      ${processed},${debited},${restocked},'Operator test: verified physical stock and original debit journal');`

  it("requires explicit server attestation to unlock ambiguous legacy inventory", () => {
    expect(call(request("4", "debit", legacyId))).toMatchObject({ review_required: true })
    const result = JSON.parse(db(actor(resolve(), ids.owner, "service_role")))
    expect(result).toMatchObject({ review_required: false, processed_quantity: 4, debited_quantity: 2 })
    expect(stock()).toBe(10)
    expect(call(request("4", "debit", legacyId))).toMatchObject({ applied_quantity: 0 })
    expect(call(request("4", "restock", legacyId))).toMatchObject({ applied_quantity: 2 })
    expect(stock()).toBe(12)
    expect(db(`SELECT reconciled_by,reconciliation_reason IS NOT NULL,reconciled_at IS NOT NULL
      FROM public.order_line_inventory_receipts WHERE sale_order_item_id='${legacyId}'`)).toBe(`${ids.owner}|t|t`)
    expect(() => db(actor(resolve(), null, "service_role"))).toThrow(/already reconciled/)
  })

  it("can attest a known unpaid historical operational completion as zero processed", () => {
    db(actor(resolve(legacyId, "0", "0", "0"), null, "service_role"))
    expect(stock()).toBe(10)
    expect(call(request("4", "debit", legacyId))).toMatchObject({ applied_quantity: 4 })
    expect(stock()).toBe(6)
  })

  it("denies browser attestations, malformed budgets and replacing known receipts", () => {
    for (const role of ["authenticated", "anon"]) {
      expect(() => db(actor(resolve(), ids.owner, role))).toThrow(/permission denied/)
    }
    for (const query of [resolve(lineId), resolve(legacyId, "1", "2"), resolve(legacyId, "4", "2", "3"),
      resolve(legacyId, "'NaN'"), resolve().replace("Operator test: verified physical stock and original debit journal", "short"),
      resolve().replace(`'${ids.site}'`, `'${ids.otherSite}'`)]) {
      expect(() => db(actor(query, null, "service_role"))).toThrow()
    }
    expect(stock()).toBe(10)
    expect(db(`SELECT count(*) FROM public.order_line_inventory_receipts WHERE reconciliation_reason IS NOT NULL`)).toBe("0")
  })
})