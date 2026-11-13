/** @jest-environment node */
import { actor, call, disposablePostgres, ids, postgresAvailable, receipt, uuid } from "./movements-postgres"
import { receivers } from "./receiving-responsibility-postgres"
import { concurrentSql, createSql, jsonSql, transferInput, transitionSql } from "./transfer-orders-postgres"
import { accountingFix, boundary, partialCall, setupReviewDatabase } from "./receipt-review-postgres"

it("keeps the two forward migrations below 500 lines", () => {
  for (const sql of [boundary, accountingFix]) expect(sql.split("\n").length).toBeLessThan(500)
})

const suite = postgresAvailable ? describe : describe.skip
suite("receipt review fixes in disposable socket-only PostgreSQL", () => {
  const postgres = disposablePostgres()
  const db = postgres.db
  const items = (withIds = false) => JSON.parse(db(`SELECT jsonb_agg(jsonb_build_object(
    'catalog_item_id',catalog_item_id,'name',name,'quantity',quantity,'unit_cost',unit_cost,'subtotal',subtotal)
    ${withIds ? "|| jsonb_build_object('id',id)" : ""} ORDER BY id) FROM public.purchase_items WHERE purchase_id='${ids.bill}';`))
  const edit = (input: unknown = items(), header: unknown = { notes: "Header edited" }, expected?: string) =>
    `SELECT public.accounting_update_purchase_items('${ids.site}','${ids.bill}',
    '${expected || db(`SELECT updated_at FROM public.purchases WHERE id='${ids.bill}';`)}',${jsonSql(input)},${jsonSql(header)});`
  const snapshot = () => db(`SELECT jsonb_build_object(
    'bills',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.purchases p),
    'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.purchase_items i),
    'stock',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.inventory_levels i),
    'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.purchase_inventory_receipts r),
    'movements',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.inventory_movements m),
    'requests',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_id) FROM public.inventory_operation_requests r));`)
  const denied = (sql: string, pattern: RegExp, user: string | null = ids.owner, role = "authenticated") => {
    const before = snapshot()
    expect(() => db(actor(sql, user, role))).toThrow(pattern)
    expect(snapshot()).toBe(before)
  }
  const lineState = () => db(`SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.purchase_items i;`)
  beforeAll(() => postgres.start(), 30000)
  afterAll(() => postgres.stop())
  beforeEach(() => setupReviewDatabase(db))

  it.each([null, ids.source])("preserves canonical scope %s through partial completion and exact replay", canonical => {
    if (canonical) setupReviewDatabase(db, true, canonical)
    db(actor(partialCall(1, uuid(600))))
    expect(db(`SELECT coalesce(location_id::text,'NULL')||':'||stock_receipt_location_id::text
      FROM public.purchases WHERE id='${ids.bill}';`)).toBe(`${canonical || "NULL"}:${ids.target}`)
    const before = snapshot()
    expect(JSON.parse(db(actor(partialCall(1, uuid(600))))).alreadyApplied).toBe(true)
    expect(snapshot()).toBe(before)
    db(actor(`SELECT public.receive_bill_inventory_lines('${ids.site}','${ids.bill}','${uuid(601)}',
      '${ids.target}','${ids.owner}','[{"purchaseItemId":"${uuid(50)}","quantity":3},
      {"purchaseItemId":"${uuid(51)}","quantity":2.5},{"purchaseItemId":"${uuid(52)}","quantity":3}]');`))
    expect(db(`SELECT stock_received FROM public.purchases WHERE id='${ids.bill}';`)).toBe("t")
    expect(db("SELECT count(*) FROM inventory_receipt_private.writes;")).toBe("0")
    denied(`UPDATE public.purchases SET location_id='${ids.hidden}' WHERE id='${ids.bill}';`, /scope is immutable|Manager scope assignment/)
  })

  it.each([null, ids.source])("supports legacy full receipt with historical scope %s and synchronizes budgets", canonical => {
    if (canonical) setupReviewDatabase(db, true, canonical)
    db(actor(call([receipt()], uuid(610))))
    expect(db(`SELECT coalesce(location_id::text,'NULL')||':'||stock_receipt_location_id::text||':'||stock_received
      FROM public.purchases WHERE id='${ids.bill}';`)).toBe(`${canonical || "NULL"}:${ids.target}:true`)
    expect(db(`SELECT received_quantity FROM public.purchase_items WHERE id='${uuid(50)}';`)).toBe("4")
    const before = snapshot()
    expect(JSON.parse(db(actor(call([receipt()], uuid(610))))).alreadyApplied).toBe(true)
    expect(snapshot()).toBe(before)
    expect(db("SELECT count(*) FROM inventory_receipt_private.writes;")).toBe("0")
  })

  it("denies direct completion, destination and budget forgery, including service-role and INSERT paths", () => {
    for (const role of ["authenticated", "service_role"]) {
      denied(`UPDATE public.purchases SET stock_received=true WHERE id='${ids.bill}';`, /Receipt operation required/, ids.owner, role)
      denied(`UPDATE public.purchases SET stock_receipt_location_id='${ids.target}' WHERE id='${ids.bill}';`, /Receipt operation required/, ids.owner, role)
      denied(`UPDATE public.purchase_items SET received_quantity=quantity WHERE id='${uuid(50)}';`, /immutable/, ids.owner, role)
      denied(`INSERT INTO public.purchases(id,site_id,stock_received) VALUES ('${uuid(620)}','${ids.site}',true);`, /New bills cannot/, ids.owner, role)
      denied(`INSERT INTO inventory_receipt_private.writes VALUES(txid_current(),'${ids.bill}','${ids.owner}',true);`, /permission denied/, ids.owner, role)
    }
    denied(`SET app.receipt_operation='true'; UPDATE public.purchases SET stock_received=true WHERE id='${ids.bill}';`, /Receipt operation required/)
    denied(partialCall(1, uuid(621)), /access denied/, ids.foreign)
    denied(partialCall(1, uuid(621)), /access denied/, null)
    denied(partialCall(1, uuid(621)), /permission denied/, ids.owner, "anon")
  })

  it("rolls back effects and capabilities on a later invalid line and blocks legacy receipt after partial receipt", () => {
    denied(`SELECT public.receive_bill_inventory_lines('${ids.site}','${ids.bill}','${uuid(622)}',
      '${ids.target}','${ids.owner}','[{"purchaseItemId":"${uuid(50)}","quantity":1},
      {"purchaseItemId":"${uuid(52)}","quantity":999}]');`, /remaining quantity/)
    expect(db("SELECT count(*) FROM inventory_receipt_private.writes;")).toBe("0")
    db(actor(partialCall(1, uuid(623))))
    denied(call([receipt()], uuid(624)), /partial receipts/)
    denied(`UPDATE public.purchases SET stock_received=true WHERE id='${ids.bill}';`, /Receipt operation required/)
  })

  it.each(["partial", "legacy"])("preserves all item identities and receipt budgets on %s header-only edits", mode => {
    db(actor(mode === "partial" ? partialCall(1, uuid(630)) : call([receipt()], uuid(630))))
    const before = lineState()
    db(actor(edit(items().reverse(), { notes: "Header edited", due_date: "2027-01-01" })))
    expect(lineState()).toBe(before)
    db(actor(edit(items(true))))
    expect(lineState()).toBe(before)
    expect(db(`SELECT notes||':'||due_date FROM public.purchases WHERE id='${ids.bill}';`)).toBe("Header edited:2027-01-01")
    for (const field of ["quantity", "unit_cost", "name", "catalog_item_id"]) {
      const changed = items()
      changed[0][field] = field === "name" ? "Different" : field === "catalog_item_id" ? ids.secondProduct : 9
      delete changed[0].subtotal
      denied(edit(changed), /must remain unchanged/)
    }
    const forged = items(true)
    forged[0].id = uuid(999)
    denied(edit(forged), /identity must remain unchanged/)
    const duplicate = items(true)
    duplicate[1].id = duplicate[0].id
    denied(edit(duplicate), /identity must remain unchanged/)
    denied(edit(items(), { notes: "Stale" }, "2020-01-01"), /reload before saving/)
    denied(`DELETE FROM public.purchase_items WHERE id='${uuid(50)}';`, /immutable/)
  })

  it("retains the historical private accounting wrapper and denies restricted actors", () => {
    db(`INSERT INTO public.site_member_location_restrictions VALUES
      ('${ids.site}','${receivers.memberRow}','${ids.hidden}');`)
    denied(edit(), /no authorized location projection/, receivers.member)
    denied(`SELECT location_acl_private.original_1();`, /permission denied/)
    const changed = items()
    changed[0].quantity = 5
    delete changed[0].subtotal
    db(actor(edit(changed)))
    expect(db(`SELECT quantity FROM public.purchase_items WHERE purchase_id='${ids.bill}' ORDER BY quantity LIMIT 1;`)).toBe("2.5")
  })

  it("also patches an unwrapped accounting implementation", () => {
    setupReviewDatabase(db, false)
    db(actor(partialCall(1, uuid(640))))
    const before = lineState()
    db(actor(edit()))
    expect(lineState()).toBe(before)
  })

  it("compares duplicate lines as a multiset without recreating their identities", () => {
    db(`UPDATE public.purchase_items SET quantity=4,subtotal=40 WHERE id='${uuid(51)}';`)
    db(actor(partialCall(1, uuid(645))))
    const before = lineState()
    db(actor(edit(items().reverse())))
    expect(lineState()).toBe(before)
    denied(edit(items().slice(1)), /must remain unchanged/)
    denied(edit([...items(), items()[0]]), /must remain unchanged/)
  })

  it("serializes competing receipts and releases capabilities before later same-transaction writes", async () => {
    const socket = db("SHOW unix_socket_directories;")
    const outcomes = await Promise.allSettled([660, 661].map(request =>
      concurrentSql(socket, actor(partialCall(3, uuid(request))))))
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1)
    expect(db(`SELECT received_quantity FROM public.purchase_items WHERE id='${uuid(50)}';`)).toBe("3")
    expect(db("SELECT count(*) FROM inventory_receipt_private.writes;")).toBe("0")
    denied(`BEGIN; ${partialCall(1, uuid(662))}
      UPDATE public.purchases SET stock_received=true WHERE id='${ids.bill}'; COMMIT;`, /Receipt operation required/)
  })

  it("serializes header edits against receiving without losing receipt identities", async () => {
    db(actor(partialCall(1, uuid(670))))
    const socket = db("SHOW unix_socket_directories;")
    const outcomes = await Promise.allSettled([
      concurrentSql(socket, actor(edit())),
      concurrentSql(socket, actor(partialCall(1, uuid(671)))),
    ])
    expect(outcomes[1].status).toBe("fulfilled")
    if (outcomes[0].status === "rejected") expect(String(outcomes[0].reason)).toMatch(/reload before saving/)
    expect(db(`SELECT received_quantity FROM public.purchase_items WHERE id='${uuid(50)}';`)).toBe("2")
    expect(db("SELECT count(*) FROM public.purchase_inventory_receipts;")).toBe("2")
  })

  it("recognizes a licensed co-owner through the canonical role helper, not the membership role", () => {
    db(`INSERT INTO public.site_ownership VALUES ('${ids.site}','${receivers.member}');`)
    expect(db(actor(`SELECT public.current_user_site_role('${ids.site}');`, receivers.member))).toBe("owner")
    const order = JSON.parse(db(actor(createSql(transferInput(), uuid(650))))).orderId
    db(actor(transitionSql(order, { action: "approve", revision: 0 }, uuid(651)), receivers.member))
    expect(db(`SELECT status FROM public.inventory_transfer_orders WHERE id='${order}';`)).toBe("approved")
    const second = JSON.parse(db(actor(createSql(transferInput(), uuid(652))))).orderId
    db(`UPDATE public.site_members SET manually_disabled=true,license_suspended=true WHERE id='${receivers.memberRow}';`)
    expect(() => db(actor(transitionSql(second, { action: "approve", revision: 0 }, uuid(653)), receivers.member)))
      .toThrow(/responsibility denied/)
  })
})
