/** @jest-environment node */

import { GET } from "@/app/api/revenue/route"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createClient } from "@/lib/supabase/server"
import { salesTestClient } from "./sales-test-client"

jest.mock("@/lib/auth/api-analytics-access", () => ({ requireAnalyticsAccess: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/api/revenue/report-visibility", () => ({
  ...jest.requireActual("@/app/api/revenue/report-visibility"), requireSalesReportVisibility: jest.fn(),
}))

const siteId = "00000000-0000-4000-8000-000000000001"
const auth = requireAnalyticsAccess as jest.Mock
const create = createClient as jest.Mock
const request = (extra: Record<string, string> = {}) => new Request(`http://localhost/api/revenue?${new URLSearchParams({
  siteId, startDate: "2025-02-01", endDate: "2025-02-02", includeCategories: "false", ...extra,
})}`)

describe("revenue route contract", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    auth.mockResolvedValue({ siteId, userId: "authorized-user" })
    create.mockResolvedValue(salesTestClient({}))
  })

  it("requires a site and validates dates and segment before querying data", async () => {
    const invalidRequests: Record<string, string>[] = [{ siteId: "" }, { segmentId: "invalid" }, { startDate: "2025-02-30" }, { endDate: "2025-01-01" }]
    for (const params of invalidRequests) {
      expect((await GET(request(params))).status).toBe(400)
    }
    expect(create).not.toHaveBeenCalled()
  })

  it.each([401, 403, 429])("does not create a data client when authorization returns %s", async (status) => {
    auth.mockResolvedValue({ error: Response.json({ error: "Denied" }, { status }) })
    expect((await GET(request())).status).toBe(status)
    expect(create).not.toHaveBeenCalled()
  })

  it("returns complete prior-period data and equal date metadata even without current sales", async () => {
    const client = salesTestClient({ sales: [{ id: "old", site_id: siteId, status: "pending", amount: "20.25", currency: "EUR", sale_date: "2025-01-31" }] })
    create.mockResolvedValue(client)
    const response = await GET(request())
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(data).toMatchObject({ currency: "EUR", noData: true, totalSales: { actual: 0, previous: 20.25, percentChange: -100 }, metadata: { prevStartDate: "2025-01-30", prevEndDate: "2025-01-31" } })
    expect(create).toHaveBeenCalledWith(true)
    expect(auth).toHaveBeenCalledTimes(1)
  })

  it("returns an actionable currency selection contract for mixed amounts", async () => {
    create.mockResolvedValue(salesTestClient({ sales: ["USD", "EUR"].map((currency) => ({ id: currency, currency, amount: 10, site_id: siteId, status: "completed", sale_date: "2025-02-01" })) }))
    const response = await GET(request())
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ availableCurrencies: ["EUR", "USD"] })
    const selected = await GET(request({ currency: "EUR" }))
    expect(await selected.json()).toMatchObject({ currency: "EUR", totalSales: { actual: 10 } })
  })

  it("returns sanitized errors rather than a successful empty response", async () => {
    create.mockResolvedValue(salesTestClient({}, 500, "sales"))
    const response = await GET(request())
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain("private database details")
  })
})