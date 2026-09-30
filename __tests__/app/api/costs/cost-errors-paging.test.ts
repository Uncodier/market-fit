/** @jest-environment node */
import { GET } from "@/app/api/costs/route"
import { createClient } from "@/lib/supabase/server"
import { COST_ITEM_BATCH_SIZE, COST_PAGE_SIZE, MAX_COST_ROWS, readCostPages } from "@/app/api/costs/cost-paging"
import { costClient, costRequest, SITE, SEGMENT, CAMPAIGN, purchase, transaction } from "./cost-test-client"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
beforeEach(() => jest.clearAllMocks())

it.each(["transactions", "purchases", "purchase_items", "campaign_segments", "segments", "campaigns"])(
  "fails safely on %s errors rather than returning partial/empty success", async (table) => {
    const client = costClient({
      segments: [{ id: SEGMENT, site_id: SITE }], campaigns: [{ id: CAMPAIGN, site_id: SITE }],
      purchases: [purchase("a")],
    }, { failure: (q) => q.table === table ? "error" : undefined })
    jest.mocked(createClient).mockResolvedValue(client)
    const filters = ["segments", "campaign_segments"].includes(table) ? { segmentId: SEGMENT }
      : table === "campaigns" ? { campaignId: CAMPAIGN } : {}
    const response = await GET(costRequest(filters))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain("secret provider")
  },
)

it.each(["error", "throw", "null"] as const)("does not ignore a later union page failure: %s", async (failure) => {
  const client = costClient({ transactions: [transaction("a", "2026-03-01"), transaction("b", "2026-07-31")] }, {
    serverLimit: 1,
    failure: (q) => q.filters.some((f) => f.op === "gt") ? failure : undefined,
  })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest())
  expect(response.status).toBe(500)
  expect(await response.text()).not.toContain("secret provider")
})

it("pages beyond the provider's smaller row limit with a unique stable cursor", async () => {
  const rows = Array.from({ length: COST_PAGE_SIZE + 3 }, (_, index) => transaction(String(index).padStart(5, "0")))
  const client = costClient({ transactions: rows.reverse() }, { serverLimit: 100 })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest())
  expect(response.status).toBe(200)
  expect((await response.json()).totalCosts.actual).toBe((COST_PAGE_SIZE + 3) * 10)
  const pages = client.queries.filter((q) => q.table === "transactions")
  expect(pages).toHaveLength(7)
  expect(pages.every((q) => q.order === "id" && q.limit <= COST_PAGE_SIZE)).toBe(true)
  expect(pages[1].filters).toContainEqual({ op: "gt", column: "id", value: "00099" })
})

it("rejects cap overflow instead of returning a truncated transaction report", async () => {
  const rows = Array.from({ length: MAX_COST_ROWS + 1 }, (_, i) => transaction(String(i).padStart(5, "0")))
  const client = costClient({ transactions: rows })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest())
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: expect.stringContaining("too large") })
  expect(client.from).not.toHaveBeenCalledWith("purchases")
})

it("batches purchase IDs and pages their items with explicit site scope", async () => {
  const bills = Array.from({ length: COST_ITEM_BATCH_SIZE + 1 }, (_, i) => purchase(String(i).padStart(5, "0")))
  const items = Array.from({ length: COST_PAGE_SIZE + 1 }, (_, i) => ({
    id: String(i).padStart(5, "0"), site_id: SITE, purchase_id: "00000", catalog_item_id: "product",
    subtotal: 0.1, catalog_items: { kind: "product" },
  }))
  const client = costClient({ purchases: bills, purchase_items: items })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest())
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data.totalCosts.actual).toBeCloseTo(bills.length * 100)
  expect(data.costCategories.find((row: { name: string }) => row.name === "Cost of goods sold").amount).toBeCloseTo(50.1)
  const pages = client.queries.filter((q) => q.table === "purchase_items")
  expect(pages).toHaveLength(4)
  for (const page of pages) {
    const ids = page.filters.find((filter) => filter.column === "purchase_id")?.value as string[]
    expect(ids.length).toBeLessThanOrEqual(COST_ITEM_BATCH_SIZE)
    expect(page.filters).toContainEqual({ op: "eq", column: "site_id", value: SITE })
    expect(page.columns).not.toContain("*")
  }
})

it("fails safely when a later item batch fails", async () => {
  const bills = Array.from({ length: COST_ITEM_BATCH_SIZE + 1 }, (_, i) => purchase(String(i).padStart(5, "0")))
  const client = costClient({ purchases: bills }, {
    failure: (q) => q.table === "purchase_items" && q.filters.some((f) =>
      f.column === "purchase_id" && (f.value as string[]).includes("00100")) ? "error" : undefined,
  })
  jest.mocked(createClient).mockResolvedValue(client)
  expect((await GET(costRequest())).status).toBe(500)
})

describe("bounded page reader", () => {
  it("accepts exactly the cap only after an empty completion probe", async () => {
    const page = jest.fn().mockResolvedValueOnce({ data: [{ id: "a" }, { id: "b" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    expect(await readCostPages(page, (row: { id: string }) => row.id, { remaining: 3 }, 2)).toHaveLength(2)
    expect(page).toHaveBeenLastCalledWith("b", 1)
  })

  it("fails a stalled or repeated cursor", async () => {
    const page = jest.fn().mockResolvedValue({ data: [{ id: "a" }], error: null })
    await expect(readCostPages(page, (row: { id: string }) => row.id, { remaining: 5 })).rejects.toThrow("complete")
    expect(page).toHaveBeenCalledTimes(2)
  })

  it("bounds requests even when the provider returns tiny pages", async () => {
    let cursor = 0
    const page = jest.fn(async () => ({ data: [{ id: String(++cursor) }], error: null }))
    await expect(readCostPages(page, (row) => row.id, { remaining: 2 })).rejects.toThrow("too large")
    expect(page).toHaveBeenCalledTimes(2)
  })
})