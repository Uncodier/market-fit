/** @jest-environment node */
import {
  actor, adjustment, call, disposablePostgres, ids, migration,
  postgresAvailable, receipt, transfer, uuid,
} from "./movements-postgres"
import { coordination, receivers, receiving, receivingBootstrap } from "./receiving-responsibility-postgres"

const suite = postgresAvailable ? describe : describe.skip
const markers = [
  "ARRAY['kind','catalogItemId','fromLocationId','toLocationId','quantity','notes']",
  "quantity,notes,purchase_id)",
  "source_label,target_label,qty,op->>'notes',(op->>'purchaseId')::uuid)",
]
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`

suite("receiving responsibility after original + coordination in socket-only PostgreSQL", () => {
  const postgres = disposablePostgres()
  const db = postgres.db
  const installPrerequisites = () => { db(receivingBootstrap); db(migration()); db(coordination) }
  const apply = (operations: unknown, request = uuid(100), user = ids.owner) =>
    JSON.parse(db(actor(call(operations, request), user)))
  const assigned = (quantity = 3, receivingUserId = receivers.member, overrides = {}) =>
    transfer(quantity, { receivingUserId, ...overrides })
  const counts = () => db(`SELECT (SELECT count(*) FROM public.inventory_operation_requests),
    (SELECT count(*) FROM public.inventory_movements);`)
  const quantity = (location = ids.target) => Number(db(`SELECT quantity FROM public.inventory_levels
    WHERE catalog_item_id='${ids.product}' AND location_id='${location}';`))
  const snapshot = () => db(`SELECT jsonb_build_object(
    'levels',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.inventory_levels i),
    'purchases',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.purchases p),
    'requests',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_id) FROM public.inventory_operation_requests r),
    'movements',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.inventory_movements m));`)
  const rows = () => JSON.parse(db(`SELECT jsonb_agg(jsonb_build_object(
    'actor',actor_id,'receiver',receiving_user_id,'name',receiving_user_name,'quantity',quantity)
    ORDER BY quantity) FROM public.inventory_movements;`))
  const rejected = (operations: unknown, error: RegExp, user = ids.owner) => {
    const before = snapshot()
    expect(() => apply(operations, uuid(100), user)).toThrow(error)
    expect(snapshot()).toBe(before)
    expect(counts()).toBe("0|0")
  }

  beforeAll(() => postgres.start(), 30000)
  afterAll(() => postgres.stop())
  beforeEach(() => { installPrerequisites(); db(receiving) })

  it("patches the actual pg_get_functiondef markers and compiles the resulting implementation", () => {
    installPrerequisites()
    const source = db("SELECT pg_get_functiondef('public.apply_inventory_operations_locked(uuid,uuid,jsonb)'::regprocedure);")
    markers.forEach(marker => expect(source).toContain(marker))
    db(receiving)
    const patched = db("SELECT pg_get_functiondef('public.apply_inventory_operations_locked(uuid,uuid,jsonb)'::regprocedure);")
    expect(patched).toContain("'notes','receivingUserId']")
    expect(patched).toContain("purchase_id,receiving_user_id,receiving_user_name)")
    expect(patched).toContain("public.inventory_receiver_name(p_site_id,(op->>'receivingUserId')::uuid,target_id)")
    expect(apply([assigned()]).success).toBe(true)
    expect(rows()[0].receiver).toBe(receivers.member)
  })

  it.each(markers)("fails closed and rolls back DDL when source marker changes: %s", marker => {
    installPrerequisites()
    const source = db("SELECT pg_get_functiondef('public.apply_inventory_operations_locked(uuid,uuid,jsonb)'::regprocedure);")
    // Whitespace keeps the prerequisite function valid but breaks the exact patch contract.
    const changed = source.replace(marker, marker.replace(",", ", "))
    expect(changed).not.toBe(source)
    db(changed)
    expect(() => db(receiving)).toThrow(/Unexpected inventory implementation; review receiver migration/)
    expect(db(`SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
      AND table_name='inventory_movements' AND column_name LIKE 'receiving_user_%';`)).toBe("0")
    expect(db("SELECT to_regprocedure('public.inventory_receiver_name(uuid,uuid,uuid)') IS NULL;")).toBe("t")
    expect(db("SELECT pg_get_functiondef('public.apply_inventory_operations_locked(uuid,uuid,jsonb)'::regprocedure);")).toBe(changed)
    expect(counts()).toBe("0|0")
  })

  it("records the active, unsuspended, manually enabled same-site member independently of actor", () => {
    expect(apply([assigned()]).alreadyApplied).toBe(false)
    expect(rows()).toEqual([{ actor: ids.owner, receiver: receivers.member, name: "Receiver name", quantity: 3 }])
    expect(quantity(ids.source)).toBe(7)
    expect(quantity()).toBe(5)
    expect(counts()).toBe("1|1")
  })

  it("accepts the site owner without a membership row and snapshots the profile", () => {
    expect(db(`SELECT count(*) FROM public.site_members WHERE user_id='${ids.owner}';`)).toBe("0")
    apply([assigned(3, ids.owner)])
    expect(rows()[0]).toEqual({ actor: ids.owner, receiver: ids.owner, name: "Owner name", quantity: 3 })
  })

  it.each([
    ["foreign-site active member", receivers.foreign], ["foreign owner", ids.foreign],
    ["pending member", receivers.pending], ["license-suspended member", receivers.suspended],
    ["manually disabled member", receivers.disabled], ["unknown user", uuid(299)],
  ])("rejects %s without changing stock, purchases, requests or history", (_label, user) => {
    rejected([assigned(1), receipt(), assigned(2, user)], /Receiving responsible person is unavailable/)
  })

  it("denies a receiver restriction on the destination even when the actor can access it", () => {
    db(`INSERT INTO public.site_member_location_restrictions VALUES
      ('${ids.site}','${receivers.memberRow}','${ids.target}');`)
    rejected([assigned()], /Receiving responsible person cannot access destination/)
  })

  it("does not interpret a restriction on another location as a destination restriction", () => {
    db(`INSERT INTO public.site_member_location_restrictions VALUES
      ('${ids.site}','${receivers.memberRow}','${ids.hidden}');`)
    expect(apply([assigned()]).success).toBe(true)
  })

  it("still enforces the actor's destination access independently of receiver eligibility", () => {
    rejected([assigned(1, ids.owner, { toLocationId: ids.hidden })], /Destination access denied/, ids.restricted)
  })

  it.each([receipt({ receivingUserId: receivers.member }), adjustment(1, { receivingUserId: receivers.member })])(
    "rejects receivingUserId on non-transfers: %j", operation => {
      rejected([assigned(1), operation], /Invalid receiving responsible person/)
    })

  it.each([null, 1, {}, [], true, "not-a-uuid", ""])("rejects malformed receivingUserId %j", receivingUserId => {
    rejected([transfer(1, { receivingUserId })], /Invalid receiving responsible person|invalid input syntax for type uuid/)
  })

  it.each([
    assigned(1, receivers.member, { fake: true }),
    assigned(1, receivers.member, { receivingUserName: "Forged name" }),
    transfer(1, { fake: true }),
  ])("does not widen the allowlist to fake fields or client-supplied receiver names: %j", operation => {
    rejected([assigned(1), operation], /Invalid operation fields/)
  })

  it("commits multiple operations in one request with each transfer's own receiver", () => {
    const result = apply([assigned(1), assigned(2, ids.owner), receipt(), adjustment(-1)])
    expect(result.movementIds).toHaveLength(5)
    expect(counts()).toBe("1|5")
    expect(rows().filter((row: { receiver: string | null }) => row.receiver !== null)).toEqual([
      { actor: ids.owner, receiver: receivers.member, name: "Receiver name", quantity: 1 },
      { actor: ids.owner, receiver: ids.owner, name: "Owner name", quantity: 2 },
    ])
    expect(quantity(ids.source)).toBe(7)
    expect(quantity()).toBe(10.5)
    expect(db(`SELECT stock_received FROM public.purchases WHERE id='${ids.bill}';`)).toBe("t")
  })

  it("rolls back already executed transfers, receipt expansion and attribution on a later stock failure", () => {
    rejected([assigned(1), receipt(), assigned(100, ids.owner)], /Insufficient inventory/)
  })

  it("preserves original no-receiver operations and pre-migration history/replay", () => {
    installPrerequisites()
    const legacy = [transfer(1), receipt(), adjustment(-1)]
    const first = apply(legacy)
    db(receiving)
    expect(apply(legacy)).toEqual({ ...first, alreadyApplied: true })
    expect(rows().every((row: { receiver: unknown; name: unknown }) => row.receiver === null && row.name === null)).toBe(true)
    const next = apply([transfer(1), adjustment(1)], uuid(101))
    expect(next.movementIds).toHaveLength(2)
    expect(counts()).toBe("2|6")
    expect(rows().every((row: { receiver: unknown; name: unknown }) => row.receiver === null && row.name === null)).toBe(true)
  })

  it("replays without duplicate stock/history and retains the original receiver name snapshot", () => {
    const operations = [assigned(1), assigned(2, ids.owner)]
    const first = apply(operations)
    const before = snapshot()
    db(`UPDATE public.site_members SET name='Renamed member'; UPDATE public.profiles SET name='Renamed owner';`)
    expect(apply(operations)).toEqual({ ...first, alreadyApplied: true })
    expect(snapshot()).toBe(before)
    expect(() => apply([assigned(1, ids.owner), assigned(2, ids.owner)])).toThrow(/Request ID conflict/)
    expect(snapshot()).toBe(before)
    expect(counts()).toBe("1|2")
  })

  it("keeps receiver history behind existing RLS and immutable browser grants", () => {
    apply([assigned()])
    expect(db(actor("SELECT receiving_user_id,receiving_user_name FROM public.inventory_movements;")))
      .toBe(`${receivers.member}|Receiver name`)
    expect(db(actor("SELECT count(*) FROM public.inventory_movements;", ids.foreign))).toBe("0")
    apply([assigned(1, ids.owner, { toLocationId: ids.hidden })], uuid(101))
    expect(db(actor("SELECT count(*) FROM public.inventory_movements;", ids.restricted))).toBe("1")
    expect(() => db(actor("UPDATE public.inventory_movements SET receiving_user_name='Forged';"))).toThrow(/permission denied/)
    expect(() => db(actor("SELECT * FROM public.inventory_operation_requests;"))).toThrow(/permission denied/)
    expect(db("SELECT relrowsecurity FROM pg_class WHERE oid='public.inventory_movements'::regclass;")).toBe("t")
  })

  it.each(["anon", "authenticated", "service_role"])("denies %s direct execution of private helpers", role => {
    for (const [name, signature, argumentsSql] of [
      ["inventory_receiver_name", "uuid,uuid,uuid", `'${ids.site}','${receivers.member}','${ids.target}'`],
      ["apply_inventory_operations_locked", "uuid,uuid,jsonb", `'${ids.site}','${uuid(100)}','[]'::jsonb`],
    ]) {
      expect(db(`SELECT has_function_privilege(${literal(role)},${literal(`public.${name}(${signature})`)},'EXECUTE');`)).toBe("f")
      expect(() => db(actor(`SELECT public.${name}(${argumentsSql});`, ids.owner, role))).toThrow(/permission denied for function/)
    }
    expect(counts()).toBe("0|0")
  })
})