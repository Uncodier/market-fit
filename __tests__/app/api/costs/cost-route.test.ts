/** @jest-environment node */
import { GET } from "@/app/api/costs/route"
import { createClient } from "@/lib/supabase/server"
import { costClient, costRequest, SITE, SEGMENT, CAMPAIGN, purchase, transaction } from "./cost-test-client"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
beforeEach(() => jest.clearAllMocks())

it("includes the end day only, with an equal-length previous period and a single union scan", async () => {
  const client = costClient({ transactions: [
    transaction("a", "2026-06-30", { amount: 99 }),
    transaction("b", "2026-07-01", { amount: 5 }),
    transaction("c", "2026-07-31", { amount: 7 }),
    transaction("d", "2026-08-01", { amount: 11 }),
    transaction("e", "2026-08-31", { amount: 13 }),
    transaction("f", "2026-09-01", { amount: 999 }),
  ] })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest())
  const data = await response.json()
  expect(response.status).toBe(200)
  expect(data.totalCosts).toMatchObject({ actual: 24, previous: 12, percentChange: 100 })
  expect(data.metadata).toMatchObject({
    prevStartDate: "2026-07-01T00:00:00.000Z", prevEndDate: "2026-07-31T00:00:00.000Z",
    endExclusive: "2026-09-01", days: 31,
  })
  expect(data.monthlyData).toEqual(expect.arrayContaining([
    { month: "Jun", fixedCosts: 0, variableCosts: 99 },
    { month: "Jul", fixedCosts: 0, variableCosts: 12 },
    { month: "Aug", fixedCosts: 0, variableCosts: 24 },
  ]))
  const queries = client.queries.filter((query) => query.table === "transactions")
  expect(queries).toHaveLength(2) // One data page and one empty completion probe, not three scans.
  for (const query of queries) {
    expect(query.filters).toEqual(expect.arrayContaining([
      { op: "gte", column: "date", value: "2026-03-01" },
      { op: "lt", column: "date", value: "2026-09-01" },
    ]))
    expect(query.columns).not.toContain("*")
  }
  expect(data.currency).toBe("USD")
  expect(data.availableCurrencies).toEqual(["USD"])
})

it("retains previous-only totals/categories even when current and monthly history are empty", async () => {
  const client = costClient({ transactions: [transaction("a", "2025-12-31", { amount: 40 })] })
  jest.mocked(createClient).mockResolvedValue(client)
  const data = await (await GET(costRequest({ startDate: "2026-01-01", endDate: "2026-12-31" }))).json()
  expect(data.totalCosts).toMatchObject({ actual: 0, previous: 40, percentChange: -100 })
  expect(data.costCategories).toEqual([{ name: "Technology", amount: 0, prevAmount: 40, percentChange: -100 }])
  expect(data.noData).toBe(true)
  expect(data.monthlyData).toHaveLength(6)
  expect(data.monthlyData.every((month: { variableCosts: number }) => month.variableCosts === 0)).toBe(true)
})

it("keeps pending/completed bill amounts, COGS splitting and operations remainder", async () => {
  const client = costClient({
    purchases: [
      purchase("a"), purchase("b", { amount: 50, status: "completed", purchase_date: "2026-07-31" }),
      purchase("c", { status: "draft" }), purchase("d", { status: "cancelled" }),
      purchase("e", { purchase_date: "2026-09-01" }),
    ],
    purchase_items: [
      { id: "i1", site_id: SITE, purchase_id: "a", catalog_item_id: "product", subtotal: 60, catalog_items: { kind: "product" } },
      { id: "i2", site_id: SITE, purchase_id: "a", catalog_item_id: "service", subtotal: 40, catalog_items: { kind: "service" } },
    ],
  })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest())
  const data = await response.json()
  expect(response.status).toBe(200)
  expect(data.totalCosts).toMatchObject({ actual: 100, previous: 50 })
  expect(data.costCategories).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Cost of goods sold", amount: 60 }),
    expect.objectContaining({ name: "Operations", amount: 40, prevAmount: 50 }),
  ]))
  expect(client.queries.find((q) => q.table === "purchases")?.filters).toEqual(expect.arrayContaining([
    { op: "in", column: "status", value: ["pending", "completed"] },
    { op: "lt", column: "purchase_date", value: "2026-09-01" },
  ]))
})

it("retains direct segment OR linked-campaign attribution without duplicate totals or bill attribution", async () => {
  const client = costClient({
    segments: [{ id: SEGMENT, site_id: SITE }],
    campaign_segments: [{ campaign_id: CAMPAIGN, segment_id: SEGMENT, "campaigns.site_id": SITE }],
    transactions: [
      transaction("a", undefined, { segment_id: SEGMENT }),
      transaction("b", undefined, { campaign_id: CAMPAIGN }),
      transaction("c", undefined, { segment_id: SEGMENT, campaign_id: CAMPAIGN }),
      transaction("d"),
    ],
    purchases: [purchase("a")],
  })
  jest.mocked(createClient).mockResolvedValue(client)
  const data = await (await GET(costRequest({ segmentId: SEGMENT }))).json()
  expect(data.totalCosts.actual).toBe(30)
  expect(client.from).not.toHaveBeenCalledWith("purchases")
  expect(client.queries.filter((q) => q.table === "campaign_segments").every((q) =>
    q.filters.some((f) => f.column === "campaigns.site_id" && f.value === SITE))).toBe(true)
})

it("intersects campaign and segment filters and does not attribute bills", async () => {
  const client = costClient({
    segments: [{ id: SEGMENT, site_id: SITE }], campaigns: [{ id: CAMPAIGN, site_id: SITE }],
    transactions: [transaction("a", undefined, { campaign_id: CAMPAIGN, segment_id: SEGMENT }), transaction("b")],
  })
  jest.mocked(createClient).mockResolvedValue(client)
  const data = await (await GET(costRequest({ campaignId: CAMPAIGN, segmentId: SEGMENT }))).json()
  expect(data.totalCosts.actual).toBe(10)
  expect(client.from).not.toHaveBeenCalledWith("purchases")
})

it.each([
  { transactions: [transaction("a"), transaction("b", "2026-07-31", { currency: "EUR" })] },
  { transactions: [transaction("a")], purchases: [purchase("a", { currency: "EUR" })] },
  { transactions: [transaction("a")], purchases: [purchase("a", { currency: null })] },
])("requires a currency choice rather than publishing mixed currency totals: %j", async (tables) => {
  jest.mocked(createClient).mockResolvedValue(costClient(tables))
  const response = await GET(costRequest())
  expect(response.status).toBe(422)
  const data = await response.json()
  expect(data).not.toHaveProperty("totalCosts")
  expect(data.availableCurrencies).toHaveLength(2)
  expect(data.availableCurrencies).toContain("USD")
})

it("returns an empty report without inventing a currency", async () => {
  jest.mocked(createClient).mockResolvedValue(costClient())
  const data = await (await GET(costRequest())).json()
  expect(data).toMatchObject({ noData: true, currency: null, availableCurrencies: [], costCategories: [], costDistribution: [] })
  expect(data.totalCosts).toMatchObject({ actual: 0, previous: 0 })
})