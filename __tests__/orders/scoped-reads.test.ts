/** @jest-environment node */
import { queryOrders } from "@/app/orders/query-orders"
import { createClient } from "@/lib/supabase/server"
import { commerceTables, readFixture } from "./read-fixture"
import { readBatches, settledReads, searchValue, CommerceReadError } from "@/app/orders/scoped-read"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
let fixture: ReturnType<typeof readFixture>
beforeEach(() => {
  fixture = readFixture(commerceTables())
  fixture.hidden.add("order-6")
  jest.mocked(createClient).mockResolvedValue(fixture.client as never)
})

it("filters unpaid before exact count/page and hydrates only selected page IDs", async () => {
  const result = await queryOrders({ siteId: "site", paymentStatus: "unpaid", pageSize: 1, page: 2, sort: "oldest" })
  expect(result.error).toBeUndefined()
  expect(result.count).toBe(3)
  expect(result.data.map(row => row.id)).toEqual(["order-2"])
  expect(result.data[0].sales?.amount_due).toBe(12)
  expect(result.data[0].leads?.name).toBe("Customer 2")
  expect(result.data[0].sale_order_items?.[0].name).toBe("Matching product")
  expect(result.data[0]).toMatchObject({ metadata: { marketplace: { provider: "synthetic" } }, shipping_address: { city: "Test" }, scheduled_for: "2026-01-09", items: [] })
  expect(fixture.calls[0].select).toContain("sales!inner(amount_due)")
  expect(fixture.calls[0].count).toBe("exact")
  for (const call of fixture.calls.slice(1)) {
    expect(call.ops).toContainEqual(["eq", "site_id", "site"])
    expect(call.select).not.toMatch(/\*|public_token/)
    expect(call.signal).toBe(fixture.calls[0].signal)
  }
  expect(fixture.calls[1].ops).toContainEqual(["in", "sale_order_id", ["order-2"]])
})

it.each([
  [{ q: "Matching" }, ["order-2"], 1],
  [{ q: "MATCH" }, ["order-4", "order-2"], 2],
  [{ status: "draft" }, ["order-5"], 1],
  [{ status: "draft,pending", startDate: "2026-01-03", endDate: "2026-01-04", locationId: "location" }, ["order-3", "order-2"], 2],
  [{ locationId: "hidden-location" }, [], 0],
])("preserves filter/search boundary %p", async (filters, ids, count) => {
  const result = await queryOrders({ siteId: "site", ...filters })
  expect(result.error).toBeUndefined()
  expect(result.data.map(row => row.id)).toEqual(ids)
  expect(result.count).toBe(count)
})

it("keeps out-of-range page count and no hydration", async () => {
  const result = await queryOrders({ siteId: "site", page: 999 })
  expect(result).toEqual({ data: [], count: 6 })
  expect(fixture.calls).toHaveLength(1)
})

it("does not hydrate hidden or cross-site leads", async () => {
  fixture.hidden.add("lead-2")
  const result = await queryOrders({ siteId: "site", q: "Matching" })
  expect(result.data[0].leads).toBeNull()
  expect(result.data[0].sales?.leads).toBeNull()
  expect(result.data.map(row => row.id)).not.toContain("order-7")
})

it("a mismatched cross-site sale FK cannot hydrate another tenant's sale or lead", async () => {
  const tables = commerceTables()
  tables.sale_orders[2].sale_id = "sale-7"
  fixture = readFixture(tables)
  jest.mocked(createClient).mockResolvedValue(fixture.client as never)
  const result = await queryOrders({ siteId: "site", q: "Matching" })
  expect(result.count).toBe(1)
  expect(result.data[0].sales).toBeNull()
  expect(result.data[0].leads).toBeNull()
  expect(fixture.calls.some(call => call.table === "leads")).toBe(false)
})

it("propagates real provider codes without exposing provider details", async () => {
  fixture.failures.set("sales", { code: "42501", message: "private provider data" })
  const result = await queryOrders({ siteId: "site" })
  expect(result.errorCode).toBe("42501")
  expect(result.error).not.toContain("private")
  expect(result.data).toEqual([])
})

it("quotes untrusted logic values", () => {
  expect(searchValue('\",site_id.eq.other)\\')).toBe('"%\\",site_id.eq.other)\\\\%"')
})

it("allSettled holds failures until remaining work settles", async () => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  let finished = false
  const result = settledReads([Promise.reject(new CommerceReadError("42501")), pending])
    .catch(error => { finished = true; return error })
  await Promise.resolve(); await Promise.resolve()
  expect(finished).toBe(false)
  release()
  expect(await result).toBeInstanceOf(CommerceReadError)
})

it("an 8s total SDK deadline covers base and hydration rather than restarting per stage", async () => {
  const controller = new AbortController()
  const timeout = jest.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal)
  fixture.setWait(async call => { if (call.table === "sales") controller.abort() })
  try {
    const result = await queryOrders({ siteId: "site" })
    expect(timeout).toHaveBeenCalledTimes(1)
    expect(timeout).toHaveBeenCalledWith(8000)
    expect(result.errorCode).toBe("READ_TIMEOUT")
    expect(result.data).toEqual([])
    expect(fixture.calls.every(call => call.signal === controller.signal)).toBe(true)
  } finally {
    timeout.mockRestore()
  }
})

it("a failed fanout does not finish while sibling SDK reads remain pending", async () => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let finished = false
  fixture.failures.set("sales", { code: "42501" })
  fixture.setWait(async call => { if (call.table === "sale_order_items") await gate })
  const pending = queryOrders({ siteId: "site" }).then(result => { finished = true; return result })
  await new Promise(resolve => setImmediate(resolve))
  expect(finished).toBe(false)
  release()
  expect((await pending).errorCode).toBe("42501")
})

it("batches 100 IDs and pages children beyond a single server window", async () => {
  const rows = Array.from({ length: 502 }, (_, i) => ({ id: `child-${String(i).padStart(4, "0")}`, site_id: "site", parent: "parent" }))
  const batchFixture = readFixture({ children: rows })
  const result = await readBatches(batchFixture.client as never, "site", "children", "id", "parent", ["parent"], AbortSignal.timeout(8000))
  expect(result).toHaveLength(502)
  expect(batchFixture.calls.map(call => call.ops.find(op => op[0] === "range"))).toEqual([["range", 0, 499], ["range", 500, 999]])
  await readBatches(batchFixture.client as never, "site", "children", "id", "id", Array.from({ length: 205 }, (_, i) => `id-${i}`), AbortSignal.timeout(8000))
  expect(batchFixture.calls.slice(2).map(call => (call.ops.find(op => op[0] === "in")?.[2] as string[]).length)).toEqual([100, 100, 5])
})