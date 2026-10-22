/** @jest-environment node */
import { queryOrderLines } from "@/app/order-lines/query-order-lines"
import { createClient } from "@/lib/supabase/server"
import { commerceTables, readFixture } from "../orders/read-fixture"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
let fixture: ReturnType<typeof readFixture>
beforeEach(() => {
  const tables = commerceTables()
  tables.sale_order_items.push({ ...tables.sale_order_items[2], id: "modifier", name: "Extra",
    parent_sale_order_item_id: "item-2", quantity: 1 } as never)
  fixture = readFixture(tables)
  fixture.hidden.add("order-6")
  jest.mocked(createClient).mockResolvedValue(fixture.client as never)
})

it("minimal count join excludes sales/leads and hydrates modifiers, shipment, customer", async () => {
  const result = await queryOrderLines({ siteId: "site", q: "Matching", locationId: "location" })
  expect(result.error).toBeUndefined()
  expect(result.count).toBe(1)
  expect(result.data[0]).toMatchObject({ id: "unit-2", name: "Matching product", description: "Description",
    unitPrice: 6, subtotal: 6, unitCount: 2, assigneeId: "worker", deliveredAt: "2026-01-03",
    order: { id: "order-2", source: "pos", customer: { name: "Customer 2" } },
    shipment: { status: "delivered" }, modifiers: [{ id: "modifier", name: "Extra" }],
  })
  expect(fixture.calls[0].select).toContain("sale_order_items!inner")
  expect(fixture.calls[0].select).toContain("sale_orders!inner(id)")
  expect(fixture.calls[0].select).not.toMatch(/sales\s*\(|leads\s*\(|\*/)
  expect(fixture.calls[0].ops).toContainEqual(["or", 'name.ilike."%Matching%",matching_order.not.is.null', { referencedTable: "sale_order_items" }])
  for (const call of fixture.calls) {
    expect(call.ops).toContainEqual(["eq", "site_id", "site"])
    expect(call.signal).toBe(fixture.calls[0].signal)
  }
})

it("count uses search, unit status/date and order location before pagination", async () => {
  const result = await queryOrderLines({ siteId: "site", status: "all", q: "MATCH", pageSize: 1, page: 2,
    startDate: "2026-01-03", endDate: "2026-01-05", locationId: "location" })
  expect(result.error).toBeUndefined()
  expect(result.count).toBe(2)
  expect(result.data.map(row => row.id)).toEqual(["unit-2"])
  const noMatches = await queryOrderLines({ siteId: "site", status: "completed" })
  expect(noMatches).toEqual({ data: [], count: 0 })
  expect(fixture.calls.at(-1)?.ops.some(op => op[0] === "in" && op[1] === "status")).toBe(true)
})

it("never exposes hidden order/location or another site's rows", async () => {
  const result = await queryOrderLines({ siteId: "site" })
  expect(result.count).toBe(6)
  expect(result.data.map(row => row.id)).not.toEqual(expect.arrayContaining(["unit-6", "unit-7"]))
  fixture.hidden.add("lead-2")
  const hiddenLead = await queryOrderLines({ siteId: "site", q: "Matching" })
  expect(hiddenLead.data[0].order.customer).toBeNull()
})

it("a missing hydration relation returns an error instead of silently shrinking the counted page", async () => {
  fixture.setWait(async call => { if (call.table === "sale_orders") fixture.hidden.add("order-2") })
  const result = await queryOrderLines({ siteId: "site", q: "Matching" })
  expect(result.errorCode).toBe("READ_CHANGED")
  expect(result.data).toEqual([])
})

it("returns child read errors and not a partially hydrated page", async () => {
  fixture.failures.set("shipments", { code: "57014", message: "private SQL" })
  const result = await queryOrderLines({ siteId: "site", q: "Matching" })
  expect(result.errorCode).toBe("57014")
  expect(result.error).not.toContain("private")
  expect(result.data).toEqual([])
})