/** @jest-environment node */
import {
  actor, call, disposablePostgres, ids, migration, postgresAvailable, transfer, uuid,
} from "./movements-postgres"
import { coordination, receivers, receiving } from "./receiving-responsibility-postgres"
import {
  admin, concurrentSql, createSql, ordersMigration, partialMigration, projectionMigration, stockMigration,
  transferBootstrap, transferInput, transitionSql,
} from "./transfer-orders-postgres"

describe("transfer migration source safety", () => {
  it("keeps timestamped files below 500 lines and requests private", () => {
    for (const sql of [ordersMigration, projectionMigration, partialMigration, stockMigration]) expect(sql.split("\n").length).toBeLessThan(500)
    expect(ordersMigration).toContain("inventory_transfer_requests ENABLE ROW LEVEL SECURITY")
    expect(ordersMigration).not.toMatch(/GRANT SELECT ON public\.inventory_transfer_requests/)
    expect(ordersMigration).toContain("SET search_path = public, pg_temp")
    expect(ordersMigration).toContain("apply_location_inventory_delta(p_site_id,line.catalog_item_id,doc.from_location_id,-qty,false)")
  })
})

const suite = postgresAvailable ? describe : describe.skip
suite("transfer order lifecycle in isolated socket-only PostgreSQL", () => {
  const postgres = disposablePostgres()
  const db = postgres.db
  const create = (input: unknown = transferInput(), request = uuid(300), user: string | null = ids.owner) =>
    JSON.parse(db(actor(createSql(input, request), user)))
  const transition = (order: string, input: unknown, request = uuid(301), user = ids.owner) =>
    JSON.parse(db(actor(transitionSql(order, input, request), user)))
  const lines = (order: string) => JSON.parse(db(`SELECT jsonb_agg(to_jsonb(l) ORDER BY catalog_item_id)
    FROM public.inventory_transfer_lines l WHERE order_id='${order}';`))
  const document = (order: string) => JSON.parse(db(`SELECT to_jsonb(o) FROM public.inventory_transfer_orders o WHERE id='${order}';`))
  const quantity = (location = ids.source, product = ids.product) => Number(db(`SELECT quantity FROM public.inventory_levels
    WHERE catalog_item_id='${product}' AND location_id='${location}';`))
  const snapshot = () => db(`SELECT jsonb_build_object(
    'orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.inventory_transfer_orders o),
    'lines',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM public.inventory_transfer_lines l),
    'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.inventory_transfer_events e),
    'stock',(SELECT CASE WHEN to_regclass('public.inventory_transfer_stock_events') IS NOT NULL
      THEN (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.inventory_transfer_stock_events s) END),
    'requests',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_id) FROM public.inventory_transfer_requests r),
    'levels',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.inventory_levels i));`)
  const rejected = (fn: () => unknown, error: RegExp) => {
    const before = snapshot()
    expect(fn).toThrow(error)
    expect(snapshot()).toBe(before)
  }
  const dispatched = () => {
    const { orderId } = create()
    const line = lines(orderId)[0]
    transition(orderId, { action: "approve", revision: 0 })
    transition(orderId, { action: "dispatch", revision: 1, lines: [{ lineId: line.id, quantity: 6 }] }, uuid(302))
    return { orderId, lineId: line.id }
  }
  beforeAll(() => postgres.start(), 30000)
  afterAll(() => postgres.stop())
  beforeEach(() => {
    db(transferBootstrap); db(migration()); db(coordination); db(receiving); db(ordersMigration); db(projectionMigration)
    db(partialMigration); db(stockMigration)
  })

  it("creates server snapshots without stock changes and replays before stale revision checks", () => {
    const input = transferInput({ status: "draft", notes: "Send goods" })
    const first = create(input)
    expect(first).toEqual({ success: true, orderId: expect.any(String), requestId: uuid(300), alreadyApplied: false })
    expect(create(input)).toEqual({ ...first, alreadyApplied: true })
    const doc = document(first.orderId)
    expect(doc).toMatchObject({ revision: 0, status: "draft", requested_by: ids.owner,
      receiving_user_name: "Receiver name", from_location_name: "Warehouse", to_location_name: "Shop" })
    expect(quantity()).toBe(10)
    const operation = { action: "request", revision: 0 }
    const applied = transition(first.orderId, operation)
    const before = snapshot()
    expect(transition(first.orderId, operation)).toEqual({ ...applied, alreadyApplied: true })
    expect(snapshot()).toBe(before)
    rejected(() => transition(first.orderId, { action: "approve", revision: 0 }, uuid(302)), /revision conflict/)
    rejected(() => create(transferInput()), /Request ID conflict/)
    rejected(() => create(input, uuid(300), admin), /Request ID conflict/)
  })

  it("debits on dispatch only, receives actual increments, and closes discrepancies with accounted stock", () => {
    const { orderId, lineId } = dispatched()
    expect(quantity()).toBe(4)
    expect(quantity(ids.target)).toBe(2)
    expect(document(orderId).status).toBe("in_transit")
    const input = { action: "receive", revision: 2, lines: [{ lineId, quantity: 2 }] }
    const result = transition(orderId, input, uuid(303), receivers.member)
    expect(quantity(ids.target)).toBe(4)
    expect(document(orderId).status).toBe("partially_received")
    const before = snapshot()
    expect(transition(orderId, input, uuid(303), receivers.member)).toEqual({ ...result, alreadyApplied: true })
    expect(snapshot()).toBe(before)
    transition(orderId, { action: "reconcile", revision: 3,
      lines: [{ lineId, returnedQuantity: 3, writtenOffQuantity: 1, notes: "Damaged in transit" }] }, uuid(304), admin)
    expect(quantity()).toBe(7)
    expect(quantity(ids.target)).toBe(4)
    expect(document(orderId)).toMatchObject({ status: "received", revision: 4, received_at: expect.any(String) })
    expect(lines(orderId)[0]).toMatchObject({ dispatched_quantity: 6, received_quantity: 2,
      returned_quantity: 3, written_off_quantity: 1, discrepancy_notes: "Damaged in transit" })
    const events = JSON.parse(db(`SELECT jsonb_agg(to_jsonb(e) ORDER BY created_at) FROM public.inventory_transfer_events e;`))
    expect(events.map((e: { action: string }) => e.action)).toEqual(["create", "approve", "dispatch", "receive", "reconcile"])
    expect(events[4].snapshot.lines[0].written_off_quantity).toBe(1)
    expect(events[3].actor_id).toBe(receivers.member)
    rejected(() => transition(orderId, { action: "cancel", revision: 4 }, uuid(305)), /Invalid transfer state/)
  })

  it("receives multiple actual shipments up to dispatched, including a below-request dispatch", () => {
    const { orderId } = create()
    const lineId = lines(orderId)[0].id
    transition(orderId, { action: "approve", revision: 0 })
    transition(orderId, { action: "dispatch", revision: 1, lines: [{ lineId, quantity: 4 }] }, uuid(302))
    transition(orderId, { action: "receive", revision: 2, lines: [{ lineId, quantity: 1 }] }, uuid(303))
    transition(orderId, { action: "receive", revision: 3, lines: [{ lineId, quantity: 3 }] }, uuid(304))
    expect(document(orderId).status).toBe("received")
    expect(quantity()).toBe(6)
    expect(quantity(ids.target)).toBe(6)
  })

  it("enforces manager approval, assigned receiving, current update/location permission even on replay", () => {
    const { orderId } = create()
    rejected(() => transition(orderId, { action: "approve", revision: 0 }, uuid(301), receivers.member), /responsibility denied/)
    transition(orderId, { action: "approve", revision: 0 }, uuid(301), admin)
    const lineId = lines(orderId)[0].id
    transition(orderId, { action: "dispatch", revision: 1, lines: [{ lineId, quantity: 6 }] }, uuid(302))
    rejected(() => transition(orderId, { action: "receive", revision: 2, lines: [{ lineId, quantity: 1 }] }, uuid(303), ids.restricted), /responsibility denied/)
    rejected(() => transition(orderId, { action: "reconcile", revision: 2, lines: [{ lineId, returnedQuantity: 1, notes: "Return" }] }, uuid(303), receivers.member), /responsibility denied/)
    db(`CREATE OR REPLACE FUNCTION public.user_can(site uuid, command text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false; $$;`)
    rejected(() => create(), /access denied/)
    rejected(() => transition(orderId, { action: "approve", revision: 0 }, uuid(301), admin), /access denied/)
  })

  it.each([
    transferInput({ items: [] }), transferInput({ items: [{ catalogItemId: ids.product, quantity: 0 }] }),
    transferInput({ items: [{ catalogItemId: ids.product, quantity: "6" }] }),
    transferInput({ items: [{ catalogItemId: ids.foreignProduct, quantity: 1 }] }),
    transferInput({ items: [{ catalogItemId: ids.service, quantity: 1 }] }),
    transferInput({ items: [{ catalogItemId: ids.product, quantity: 1 }, { catalogItemId: ids.product, quantity: 1 }] }),
    transferInput({ toLocationId: ids.foreignLocation }), transferInput({ toLocationId: ids.inactive }),
    transferInput({ fromLocationId: ids.target }), transferInput({ status: "approved" }),
    transferInput({ requestedBy: ids.foreign }), transferInput({ receivingUserId: receivers.pending }),
    transferInput({ receivingUserId: receivers.suspended }), transferInput({ receivingUserId: receivers.disabled }),
    transferInput({ receivingUserId: receivers.foreign }), transferInput({ receivingUserId: null }),
  ])("rejects invalid admission atomically: %j", input => {
    rejected(() => create(input), /Invalid|unavailable|Duplicate/)
  })

  it("rejects malformed transitions, over-receipts, postdispatch cancellation, and silent stock disappearance", () => {
    const { orderId, lineId } = dispatched()
    const bad = [
      { action: "cancel", revision: 2 }, { action: "dispatch", revision: 2, lines: [{ lineId, quantity: 1 }] },
      { action: "receive", revision: 2, lines: [{ lineId, quantity: 7 }] },
      { action: "receive", revision: 2, lines: [{ lineId, quantity: -1 }] },
      { action: "receive", revision: 2, lines: [{ lineId, quantity: 1 }, { lineId, quantity: 1 }] },
      { action: "receive", revision: 2, lines: [{ lineId: uuid(999), quantity: 1 }] },
      { action: "receive", revision: 2, status: "received", lines: [{ lineId, quantity: 1 }] },
      { action: "receive", revision: 2, lines: [{ lineId, quantity: 1, requestedQuantity: 100 }] },
      { action: "reconcile", revision: 2, lines: [{ lineId, writtenOffQuantity: 1 }] },
      { action: "reconcile", revision: 2, lines: [{ lineId, writtenOffQuantity: 1, notes: "   " }] },
      { action: "reconcile", revision: 2, lines: [{ lineId, returnedQuantity: 7, notes: "Return" }] },
      { action: "reconcile", revision: 2, lines: [{ lineId, returnedQuantity: -1, notes: "Return" }] },
      { action: "reconcile", revision: 2, lines: [{ lineId, returnedQuantity: 0, notes: "Return" }] },
      { action: "receive", revision: 2.1, lines: [{ lineId, quantity: 1 }] },
    ]
    bad.forEach(input => rejected(() => transition(orderId, input, uuid(303)), /Invalid|exceeds|duplicate/))
  })

  it("rolls back earlier line debits and history when later dispatch stock fails or lines are omitted", () => {
    const { orderId } = create(transferInput({ items: [
      { catalogItemId: ids.product, quantity: 6 }, { catalogItemId: ids.secondProduct, quantity: 3 },
    ] }))
    const [first, second] = lines(orderId)
    transition(orderId, { action: "approve", revision: 0 })
    rejected(() => transition(orderId, { action: "dispatch", revision: 1,
      lines: [{ lineId: first.id, quantity: 6 }, { lineId: second.id, quantity: 3 }] }, uuid(302)), /Insufficient inventory/)
    rejected(() => transition(orderId, { action: "dispatch", revision: 1,
      lines: [{ lineId: first.id, quantity: 6 }] }, uuid(302)), /include every line/)
    expect(quantity()).toBe(10)
  })

  it("provides user-scoped get/list with both-location RLS, private requests and immutable events", () => {
    create()
    create(transferInput({ toLocationId: ids.hidden }), uuid(306))
    for (const table of ["inventory_transfer_orders", "inventory_transfer_lines", "inventory_transfer_events"]) {
      expect(db(actor(`SELECT count(*) FROM public.${table};`, ids.restricted))).toBe("1")
      expect(db(actor(`SELECT count(*) FROM public.${table};`, ids.foreign))).toBe("0")
      expect(db(actor(`SELECT count(*) FROM public.${table};`, ids.viewer))).toBe("2")
      expect(() => db(actor(`DELETE FROM public.${table};`))).toThrow(/permission denied/)
      expect(() => db(actor(`SELECT * FROM public.${table};`, null, "anon"))).toThrow(/permission denied/)
    }
    expect(() => db(actor("SELECT * FROM public.inventory_transfer_requests;"))).toThrow(/permission denied/)
    expect(() => db("UPDATE public.inventory_transfer_events SET action='forged';")).toThrow(/immutable/)
    expect(() => db(actor("UPDATE public.inventory_transfer_lines SET requested_quantity=100;"))).toThrow(/permission denied/)
    expect(() => create(transferInput(), uuid(307), null)).toThrow(/access denied/)
    expect(() => create(transferInput(), uuid(307), ids.viewer)).toThrow(/access denied/)
    expect(() => create(transferInput({ toLocationId: ids.hidden }), uuid(307), ids.restricted)).toThrow(/access denied/)
    for (const role of ["anon", "service_role"]) {
      expect(() => db(actor(createSql(transferInput()), ids.owner, role))).toThrow(/permission denied/)
    }
  })

  it("guards post-dispatch quantities and keeps every internal helper private", () => {
    const { lineId } = dispatched()
    for (const change of ["requested_quantity=100", "dispatched_quantity=5", "catalog_item_id='" + ids.secondProduct + "'"]) {
      expect(() => db(`UPDATE public.inventory_transfer_lines SET ${change} WHERE id='${lineId}';`)).toThrow(/immutable/)
    }
    expect(() => db(`UPDATE public.inventory_transfer_lines SET received_quantity=7 WHERE id='${lineId}';`)).toThrow(/check constraint/)
    db(`UPDATE public.inventory_transfer_lines SET received_quantity=1 WHERE id='${lineId}';`)
    expect(() => db(`UPDATE public.inventory_transfer_lines SET received_quantity=0 WHERE id='${lineId}';`)).toThrow(/immutable/)
    for (const signature of [
      "inventory_transfer_authorize(uuid,uuid,uuid)", "inventory_transfer_manager(uuid)",
      "inventory_transfer_record(uuid,uuid,uuid,text,jsonb)", "inventory_transfer_project_legacy(uuid)",
      "inventory_transfer_legacy_insert()", "inventory_transfer_event_immutable()", "inventory_transfer_line_guard()",
    ]) {
      for (const role of ["authenticated", "anon", "service_role"]) {
        expect(db(`SELECT has_function_privilege('${role}','public.${signature}','EXECUTE');`)).toBe("f")
      }
    }
  })

  it("backfills received legacy transfers and keeps old RPC/replay working with automatic projection", () => {
    db(transferBootstrap); db(migration()); db(coordination); db(receiving)
    const oldInput = [transfer(1), transfer(2, { receivingUserId: receivers.member }),
      transfer(1, { toLocationId: ids.hidden })]
    const oldResult = JSON.parse(db(actor(call(oldInput))))
    db(ordersMigration); db(projectionMigration); db(partialMigration); db(stockMigration)
    expect(db("SELECT count(*) FROM public.inventory_transfer_orders;")).toBe("3")
    expect(db("SELECT count(*) FROM public.inventory_movements WHERE transfer_order_id IS NOT NULL;")).toBe("3")
    expect(db("SELECT bool_and(status='received') FROM public.inventory_transfer_orders;")).toBe("t")
    expect(db("SELECT bool_and(requested_quantity=dispatched_quantity AND received_quantity=dispatched_quantity) FROM public.inventory_transfer_lines;")).toBe("t")
    const before = snapshot()
    expect(JSON.parse(db(actor(call(oldInput))))).toEqual({ ...oldResult, alreadyApplied: true })
    expect(snapshot()).toBe(before)
    db(actor(call([transfer(1), transfer(1)], uuid(101))))
    expect(db("SELECT count(*) FROM public.inventory_transfer_orders;")).toBe("4")
    expect(db("SELECT count(*) FROM public.inventory_transfer_lines;")).toBe("5")
    expect(quantity()).toBe(4)
    expect(db("SELECT count(*) FROM public.inventory_transfer_stock_events;")).toBe("0")
  })

  it("permits skipped dispatch lines, rejects all-zero and zero-budget receipts, and closes the actual dispatched budget", () => {
    const { orderId } = create(transferInput({ items: [
      { catalogItemId: ids.product, quantity: 6 }, { catalogItemId: ids.secondProduct, quantity: 3 },
    ] }))
    const [sent, skipped] = lines(orderId)
    transition(orderId, { action: "approve", revision: 0 })
    rejected(() => transition(orderId, { action: "dispatch", revision: 1,
      lines: [{ lineId: sent.id, quantity: 0 }, { lineId: skipped.id, quantity: 0 }] }, uuid(302)), /requires positive stock/)
    transition(orderId, { action: "dispatch", revision: 1,
      lines: [{ lineId: sent.id, quantity: 4 }, { lineId: skipped.id, quantity: 0 }] }, uuid(302))
    expect(quantity()).toBe(6)
    expect(db(`SELECT count(*) FROM public.inventory_levels WHERE catalog_item_id='${ids.secondProduct}';`)).toBe("0")
    expect(lines(orderId)[1]).toMatchObject({ requested_quantity: 3, dispatched_quantity: 0 })
    expect(() => db(`UPDATE public.inventory_transfer_lines SET dispatched_quantity=1 WHERE id='${skipped.id}';`)).toThrow(/immutable/)
    rejected(() => transition(orderId, { action: "receive", revision: 2,
      lines: [{ lineId: skipped.id, quantity: 1 }] }, uuid(303)), /exceeds remaining/)
    rejected(() => transition(orderId, { action: "receive", revision: 2,
      lines: [{ lineId: sent.id, quantity: 0 }] }, uuid(303)), /Invalid transfer quantity/)
    transition(orderId, { action: "receive", revision: 2, lines: [{ lineId: sent.id, quantity: 4 }] }, uuid(303))
    expect(document(orderId).status).toBe("received")
    expect(db("SELECT count(*) FROM public.inventory_transfer_stock_events;")).toBe("2")
  })

  it("projects immutable signed dispatch, receipt, return and custody writeoff ledger without changing stock twice", () => {
    const { orderId, lineId } = dispatched()
    transition(orderId, { action: "receive", revision: 2, lines: [{ lineId, quantity: 2 }] }, uuid(303), receivers.member)
    const reconcile = { action: "reconcile", revision: 3, notes: "Transport damage",
      lines: [{ lineId, returnedQuantity: 3, writtenOffQuantity: 1 }] }
    transition(orderId, reconcile, uuid(304))
    const ledger = JSON.parse(db("SELECT jsonb_agg(to_jsonb(s) ORDER BY created_at,action) FROM public.inventory_transfer_stock_events s;"))
    expect(ledger.map((row: { action: string; quantity: number; location_id: string | null; location_name: string }) =>
      [row.action, row.quantity, row.location_id, row.location_name])).toEqual([
      ["dispatch", -6, ids.source, "Warehouse"], ["receive", 2, ids.target, "Shop"],
      ["return", 3, ids.source, "Warehouse"], ["writeoff", -1, null, "In transit"],
    ])
    for (const row of ledger) expect(row).toMatchObject({ site_id: ids.site, order_id: orderId,
      line_id: lineId, catalog_item_id: ids.product, item_name: "Widget" })
    expect(ledger[1]).toMatchObject({ request_id: uuid(303), actor_id: receivers.member })
    expect(quantity()).toBe(7)
    expect(quantity(ids.target)).toBe(4)
    const before = snapshot()
    transition(orderId, reconcile, uuid(304))
    expect(snapshot()).toBe(before)
    expect(db(actor("SELECT count(*) FROM public.inventory_transfer_stock_events;", ids.viewer))).toBe("4")
    expect(db(actor("SELECT count(*) FROM public.inventory_transfer_stock_events;", ids.foreign))).toBe("0")
    expect(() => db(actor("INSERT INTO public.inventory_transfer_stock_events DEFAULT VALUES;"))).toThrow(/permission denied/)
    expect(() => db("DELETE FROM public.inventory_transfer_stock_events;")).toThrow(/immutable/)
    expect(() => db(actor("SELECT * FROM public.inventory_transfer_stock_events;", null, "anon"))).toThrow(/permission denied/)
    expect(db("SELECT has_function_privilege('authenticated','public.inventory_transfer_project_stock_event()','EXECUTE');")).toBe("f")
    db(`INSERT INTO public.site_member_location_restrictions VALUES ('${ids.site}','${receivers.memberRow}','${ids.target}');`)
    // The actual production location helper enforces restriction rows; model
    // its denied result in this isolated permission fixture, including ledger reads.
    db(`CREATE OR REPLACE FUNCTION public.user_can_access_location(site uuid, location uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT auth.uid()<>'${receivers.member}' AND public.user_can(site,'select'); $$;`)
    expect(db(actor("SELECT count(*) FROM public.inventory_transfer_stock_events;", receivers.member))).toBe("0")
  })

  it("serializes duplicate creation and concurrent expected-revision receipts without duplicate stock", async () => {
    const socket = db("SHOW unix_socket_directories;")
    const creations = await Promise.all([0, 1].map(() => concurrentSql(socket, actor(createSql(transferInput())))))
    const responses = creations.map(value => JSON.parse(value))
    expect(responses[0].orderId).toBe(responses[1].orderId)
    expect(responses.filter(value => value.alreadyApplied)).toHaveLength(1)
    expect(db("SELECT count(*) FROM public.inventory_transfer_orders;")).toBe("1")
    const orderId = responses[0].orderId
    const lineId = lines(orderId)[0].id
    transition(orderId, { action: "approve", revision: 0 })
    transition(orderId, { action: "dispatch", revision: 1, lines: [{ lineId, quantity: 6 }] }, uuid(302))
    const receipt = { action: "receive", revision: 2, lines: [{ lineId, quantity: 4 }] }
    const outcomes = await Promise.allSettled([303, 304].map(request => concurrentSql(socket,
      actor(transitionSql(orderId, receipt, uuid(request)), receivers.member))))
    expect(outcomes.filter(value => value.status === "fulfilled")).toHaveLength(1)
    const failed = outcomes.find(value => value.status === "rejected") as PromiseRejectedResult
    expect(String(failed.reason)).toMatch(/revision conflict/)
    expect(quantity(ids.target)).toBe(6)
    expect(lines(orderId)[0].received_quantity).toBe(4)
    expect(document(orderId).revision).toBe(3)
    expect(db("SELECT count(*) FROM public.inventory_transfer_events;")).toBe("4")
  })

  it("rolls stock and lifecycle back together when ledger projection fails", () => {
    const { orderId, lineId } = dispatched()
    db(`CREATE FUNCTION public.reject_test_stock_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Test ledger unavailable'; END; $$;
      CREATE TRIGGER reject_test_stock_event BEFORE INSERT ON public.inventory_transfer_stock_events
        FOR EACH ROW EXECUTE FUNCTION public.reject_test_stock_event();`)
    rejected(() => transition(orderId, { action: "receive", revision: 2,
      lines: [{ lineId, quantity: 1 }] }, uuid(303)), /Test ledger unavailable/)
    expect(quantity(ids.target)).toBe(2)
    expect(document(orderId).revision).toBe(2)
    expect(db("SELECT count(*) FROM public.inventory_transfer_stock_events;")).toBe("1")
  })
})