/** @jest-environment node */
import {
  actor, call, disposablePostgres, ids, migration, postgresAvailable, receipt, uuid,
} from "./movements-postgres"
import { coordination, receivers, receiving } from "./receiving-responsibility-postgres"
import {
  concurrentSql, ordersMigration, projectionMigration, transferBootstrap, transferSql,
} from "./transfer-orders-postgres"

const partial = transferSql("20261113210200_partial_bill_inventory_receipts.sql")
const lines = (quantity = 1) => [{ purchaseItemId: uuid(50), quantity }]
const receiveSql = (input: unknown = lines(), request = uuid(500), location = ids.target,
  receiver: string | null = receivers.member, bill = ids.bill, site = ids.site) =>
  `SELECT public.receive_bill_inventory_lines('${site}','${bill}','${request}','${location}',
    ${receiver ? `'${receiver}'` : "NULL"},'${JSON.stringify(input).replace(/'/g, "''")}'::jsonb);`

describe("partial bill receipt migration contract", () => {
  it("is forward-only, bounded, scoped and private except the authenticated RPC", () => {
    expect(partial.split("\n").length).toBeLessThan(500)
    expect(partial).toContain("purchase_inventory_receipts ENABLE ROW LEVEL SECURITY")
    expect(partial).toContain("jsonb_array_length(p_lines) NOT BETWEEN 1 AND 100")
    expect(partial).toContain("SET search_path = public, pg_temp")
    expect(partial).toContain("GRANT EXECUTE ON FUNCTION public.receive_bill_inventory_lines(uuid,uuid,uuid,uuid,uuid,jsonb) TO authenticated")
    expect(partial).not.toMatch(/GRANT .* TO service_role/)
  })
})

const suite = postgresAvailable ? describe : describe.skip
suite("partial bill receipts in disposable local socket-only PostgreSQL", () => {
  const postgres = disposablePostgres()
  const db = postgres.db
  const setup = () => {
    db(transferBootstrap); db(migration()); db(coordination); db(receiving)
    db(ordersMigration); db(projectionMigration)
  }
  const receive = (input: unknown = lines(), request = uuid(500), location = ids.target,
    receiver: string | null = receivers.member, user: string | null = ids.owner) =>
    JSON.parse(db(actor(receiveSql(input, request, location, receiver), user)))
  const quantity = () => Number(db(`SELECT quantity FROM public.inventory_levels
    WHERE catalog_item_id='${ids.product}' AND location_id='${ids.target}';`))
  const received = (item = uuid(50)) => Number(db(`SELECT received_quantity FROM public.purchase_items WHERE id='${item}';`))
  const complete = () => db(`SELECT stock_received FROM public.purchases WHERE id='${ids.bill}';`)
  const snapshot = () => db(`SELECT jsonb_build_object(
    'bills',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.purchases p),
    'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.purchase_items i),
    'levels',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.inventory_levels i),
    'movements',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.inventory_movements m),
    'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.purchase_inventory_receipts r),
    'requests',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_id) FROM public.inventory_operation_requests r));`)
  const rejected = (fn: () => unknown, error: RegExp) => {
    const before = snapshot()
    expect(fn).toThrow(error)
    expect(snapshot()).toBe(before)
  }
  beforeAll(() => postgres.start(), 30000)
  afterAll(() => postgres.stop())
  beforeEach(() => { setup(); db(partial) })

  it("receives incremental line quantities, records authorized receiver snapshots and completes only every product line", () => {
    const first = receive([{ purchaseItemId: uuid(50), quantity: 1.5 }, { purchaseItemId: uuid(51), quantity: 1 }])
    expect(first).toEqual({ success: true, requestId: uuid(500), movementIds: [expect.any(String), expect.any(String)], alreadyApplied: false })
    expect(quantity()).toBe(4.5)
    expect(received()).toBe(1.5)
    expect(received(uuid(51))).toBe(1)
    expect(complete()).toBe("f")
    const history = JSON.parse(db("SELECT jsonb_agg(to_jsonb(r) ORDER BY purchase_item_id) FROM public.purchase_inventory_receipts r;"))
    expect(history[0]).toMatchObject({ receiving_user_id: receivers.member, receiving_user_name: "Receiver name",
      actor_id: ids.owner, item_name: "Widget", location_name: "Shop", quantity: 1.5, purchase_item_id: uuid(50) })
    expect(db("SELECT bool_and(kind='receipt' AND purchase_item_id IS NOT NULL AND receiving_user_name='Receiver name') FROM public.inventory_movements;")).toBe("t")
    receive([{ purchaseItemId: uuid(50), quantity: 2.5 }, { purchaseItemId: uuid(51), quantity: 1.5 }], uuid(501))
    expect(complete()).toBe("f")
    receive([{ purchaseItemId: uuid(52), quantity: 3 }], uuid(502))
    expect(complete()).toBe("t")
    expect(received(uuid(53))).toBe(0)
    expect(quantity()).toBe(8.5)
    rejected(() => receive(lines(), uuid(503)), /fully received/)
  })

  it("replays the exact original result even after completion and rejects actor/payload and legacy request collisions", () => {
    const input = [{ purchaseItemId: uuid(50), quantity: 4 }, { purchaseItemId: uuid(51), quantity: 2.5 },
      { purchaseItemId: uuid(52), quantity: 3 }]
    const first = receive(input)
    const before = snapshot()
    expect(receive(input)).toEqual({ ...first, alreadyApplied: true })
    expect(snapshot()).toBe(before)
    rejected(() => receive(lines()), /Request ID conflict/)
    rejected(() => receive(input, uuid(500), ids.target, receivers.member, receivers.member), /Request ID conflict/)
    rejected(() => db(actor(call([receipt()], uuid(500)))), /Request ID conflict/)
    setup(); db(partial)
    db(actor(call([{ kind: "adjustment", catalogItemId: ids.product, toLocationId: ids.target, quantity: 1 }], uuid(500))))
    rejected(() => receive(), /Request ID conflict/)
  })

  it("rolls back all stock, request and history effects on later-line overflow or invalid product identity", () => {
    for (const input of [
      [{ purchaseItemId: uuid(50), quantity: 1 }, { purchaseItemId: uuid(51), quantity: 3 }],
      [{ purchaseItemId: uuid(50), quantity: 1 }, { purchaseItemId: uuid(53), quantity: 1 }],
      [{ purchaseItemId: uuid(50), quantity: 1 }, { purchaseItemId: uuid(55), quantity: 1 }],
    ]) rejected(() => receive(input), /remaining quantity|Invalid bill product line/)
    receive(lines(3))
    rejected(() => receive(lines(2), uuid(501)), /remaining quantity/)
  })

  it("requires a receiver and rejects duplicate lines, excess count, nonpositive quantities and client catalog/price fields", () => {
    rejected(() => receive(lines(), uuid(500), ids.target, null), /Invalid bill receipt/)
    for (const input of [lines(0), lines(-1), lines(1000000001),
      [{ purchaseItemId: uuid(50), quantity: "1" }],
      [{ purchaseItemId: uuid(50), quantity: 1, catalogItemId: ids.product }],
      [{ purchaseItemId: uuid(50), quantity: 1, price: 1 }], [], Array.from({ length: 101 }, () => lines()[0]),
    ]) rejected(() => receive(input), /Invalid receipt/)
    rejected(() => receive([...lines(), ...lines()]), /Duplicate receipt line/)
  })

  it("denies unauthenticated, read-only, cross-tenant, inaccessible bill and inactive destination requests", () => {
    for (const user of [null, ids.viewer, ids.foreign]) rejected(() => receive(lines(), uuid(500), ids.target, receivers.member, user), /access denied/)
    rejected(() => db(actor(receiveSql(lines(), uuid(500), ids.target, receivers.member, ids.foreignBill))), /Bill access denied/)
    rejected(() => receive(lines(), uuid(500), ids.inactive), /Invalid destination/)
    rejected(() => receive(lines(), uuid(500), ids.foreignLocation), /Invalid destination/)
    db(`UPDATE public.purchases SET location_id='${ids.hidden}' WHERE id='${ids.bill}';`)
    rejected(() => receive(lines(), uuid(500), ids.target, receivers.member, ids.restricted), /Bill access denied/)
    rejected(() => db(actor(receiveSql(lines(), uuid(500), ids.target, receivers.member, ids.cancelled))), /cancelled/)
  })

  it("rejects pending, disabled, suspended, foreign and destination-restricted receivers", () => {
    for (const receiver of [receivers.pending, receivers.disabled, receivers.suspended, receivers.foreign, uuid(999)]) {
      rejected(() => receive(lines(), uuid(500), ids.target, receiver), /responsible person is unavailable/)
    }
    db(`INSERT INTO public.site_member_location_restrictions VALUES ('${ids.site}','${receivers.memberRow}','${ids.target}');`)
    rejected(() => receive(), /cannot access destination/)
    expect(receive(lines(), uuid(500), ids.target, ids.owner).success).toBe(true)
  })

  it("locks the first destination and prevents legacy bulk receipts or receipt-line structural changes after partial receipt", () => {
    receive()
    rejected(() => receive(lines(), uuid(501), ids.source), /destination is immutable/)
    rejected(() => db(actor(call([receipt()], uuid(501)))), /partial receipts/)
    for (const sql of [
      `UPDATE public.purchase_items SET quantity=5 WHERE id='${uuid(50)}';`,
      `UPDATE public.purchase_items SET catalog_item_id='${ids.secondProduct}' WHERE id='${uuid(51)}';`,
      `DELETE FROM public.purchase_items WHERE id='${uuid(53)}';`,
      `INSERT INTO public.purchase_items(id,purchase_id,site_id,catalog_item_id,quantity) VALUES ('${uuid(599)}','${ids.bill}','${ids.site}','${ids.product}',1);`,
      `UPDATE public.purchases SET stock_received=true WHERE id='${ids.bill}';`,
      `UPDATE public.purchases SET location_id='${ids.source}' WHERE id='${ids.bill}';`,
    ]) rejected(() => db(sql), /immutable|partial receipts/)
    rejected(() => db(`UPDATE public.purchase_items SET received_quantity=0 WHERE id='${uuid(50)}';`), /immutable/)
    rejected(() => db("DELETE FROM public.purchase_inventory_receipts;"), /immutable/)
  })

  it("backfills historic fully received bills without stock credit or invented receipt history and synchronizes new legacy full receipts", () => {
    setup()
    db(actor(call([receipt()])))
    const before = quantity()
    db(partial)
    expect(quantity()).toBe(before)
    expect(received()).toBe(4)
    expect(received(uuid(51))).toBe(2.5)
    expect(received(uuid(53))).toBe(0)
    expect(db("SELECT count(*) FROM public.purchase_inventory_receipts;")).toBe("0")
    rejected(() => db(`DELETE FROM public.purchase_items WHERE id='${uuid(51)}';`), /immutable/)
    setup(); db(partial)
    const legacy = JSON.parse(db(actor(call([receipt()]))))
    expect(received()).toBe(4)
    expect(complete()).toBe("t")
    expect(quantity()).toBe(8.5)
    expect(JSON.parse(db(actor(call([receipt()]))))).toEqual({ ...legacy, alreadyApplied: true })
    rejected(() => receive(lines(), uuid(501)), /fully received/)
  })

  it("keeps receipt writes and private functions unavailable via Data API and scopes history reads", () => {
    receive()
    // Core table grants/RLS predate the migration history and are not in this bootstrap.
    db("GRANT SELECT ON public.purchases TO authenticated;")
    expect(db(actor("SELECT count(*) FROM public.purchase_inventory_receipts;"))).toBe("1")
    expect(db(actor("SELECT count(*) FROM public.purchase_inventory_receipts;", ids.foreign))).toBe("0")
    for (const role of ["authenticated", "anon", "service_role"]) {
      expect(db(`SELECT has_table_privilege('${role}','public.purchase_inventory_receipts','INSERT');`)).toBe("f")
      expect(db(`SELECT has_function_privilege('${role}','public.purchase_inventory_legacy_complete()','EXECUTE');`)).toBe("f")
    }
    for (const role of ["anon", "service_role"]) {
      expect(() => db(actor(receiveSql(), ids.owner, role))).toThrow(/permission denied/)
    }
  })

  it("serializes concurrent exact retries and distinct requests against the remaining line budget", async () => {
    const socket = db("SHOW unix_socket_directories;")
    const replies = await Promise.all([0, 1].map(() => concurrentSql(socket, actor(receiveSql(lines(1))))))
    const results = replies.map(value => JSON.parse(value))
    expect(results[0].movementIds).toEqual(results[1].movementIds)
    expect(results.filter(value => value.alreadyApplied)).toHaveLength(1)
    expect(received()).toBe(1)
    const outcomes = await Promise.allSettled([501, 502].map(request => concurrentSql(socket,
      actor(receiveSql(lines(2), uuid(request))))))
    expect(outcomes.filter(value => value.status === "fulfilled")).toHaveLength(1)
    expect(String((outcomes.find(value => value.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/remaining quantity/)
    expect(received()).toBe(3)
    expect(quantity()).toBe(5)
    expect(db("SELECT count(*) FROM public.purchase_inventory_receipts;")).toBe("2")
  })

  it("serializes partial receipts against the legacy full receipt path without double credits", async () => {
    const socket = db("SHOW unix_socket_directories;")
    const outcomes = await Promise.allSettled([
      concurrentSql(socket, actor(receiveSql(lines(1)))),
      concurrentSql(socket, actor(call([receipt()], uuid(501)))),
    ])
    expect(outcomes.filter(value => value.status === "fulfilled")).toHaveLength(1)
    if (complete()==="t") {
      expect(quantity()).toBe(8.5)
      expect(received()).toBe(4)
    } else {
      expect(quantity()).toBe(3)
      expect(received()).toBe(1)
    }
  })

  it("rejects direct authenticated budget increases and cross-tenant or invalid unselected product lines", () => {
    db("GRANT SELECT,UPDATE ON public.purchase_items TO authenticated; GRANT SELECT,UPDATE ON public.purchases TO authenticated;")
    rejected(() => db(actor(`UPDATE public.purchase_items SET received_quantity=1 WHERE id='${uuid(50)}';`)), /immutable/)
    db(`UPDATE public.purchase_items SET site_id='${ids.otherSite}' WHERE id='${uuid(52)}';`)
    rejected(() => receive(), /Invalid bill item tenant/)
    db(`UPDATE public.purchase_items SET site_id='${ids.site}',quantity=0 WHERE id='${uuid(52)}';`)
    rejected(() => receive(), /Invalid bill product quantity/)
  })

  it("rechecks permissions after waiting for the license lock", async () => {
    db(`CREATE OR REPLACE FUNCTION public.lock_site_license(site uuid) RETURNS void LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_advisory_xact_lock(987654321); END; $$;`)
    const socket = db("SHOW unix_socket_directories;")
    const blocker = concurrentSql(socket, `BEGIN; SELECT pg_advisory_xact_lock(987654321);
      UPDATE public.site_members SET license_suspended=true WHERE user_id='${receivers.member}';
      SELECT pg_sleep(0.5); COMMIT;`)
    // Poll server lock state rather than relying on an arbitrary client delay.
    for (let n = 0; n < 50; n++) {
      if (db("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=987654321 AND granted;")==="1") break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    await expect(concurrentSql(socket, actor(receiveSql()))).rejects.toThrow(/responsible person is unavailable/)
    await blocker
    expect(received()).toBe(0)
    expect(quantity()).toBe(2)
    expect(db("SELECT count(*) FROM public.inventory_operation_requests;")).toBe("0")
  })
})