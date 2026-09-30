/** @jest-environment node */

import { GET } from "@/app/api/revenue/route"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createClient } from "@/lib/supabase/server"
import { formatSalesMoney } from "@/lib/sales/report-format"
import { salesTestClient } from "./sales-test-client"

jest.mock("@/lib/auth/api-analytics-access", () => ({ requireAnalyticsAccess: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const otherSiteId = "00000000-0000-4000-8000-000000000002"
const settings = [{ site_id: otherSiteId, currency: "EUR" }, { site_id: siteId, currency: " mxn " }]
const request = (extra: Record<string, string> = {}) => new Request(`http://localhost/api/revenue?${new URLSearchParams({
  siteId, startDate: "2026-08-31", endDate: "2026-09-29", includeCategories: "false", ...extra,
})}`)

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireAnalyticsAccess).mockResolvedValue({
    siteId, userId: "authorized-user", startDate: new Date("2026-08-31"), endDate: new Date("2026-09-29"),
  })
})

it("uses the authorized site's saved currency for empty current and prior periods", async () => {
  const client = salesTestClient({ settings })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(request({ siteId: otherSiteId, siteCurrency: "GBP" }))
  const report = await response.json()

  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(report).toMatchObject({
    currency: "MXN", availableCurrencies: [], noData: true,
    totalSales: { actual: 0, previous: 0, percentChange: 0 },
    transactions: { actual: 0, previous: 0 },
    metadata: { trendCoverage: { startDate: "2026-08-31", endDate: "2026-09-29", complete: true } },
  })
  expect(formatSalesMoney(report.totalSales.actual, report.currency)).toMatch(/MXN\s0\.00/)
  expect(report.dailyData).toHaveLength(30)
  expect(report.dailyData.every((point: { totalSales: number }) => point.totalSales === 0)).toBe(true)
  expect(client.calls.filter(call => call.table === "settings")).toEqual([
    { table: "settings", method: "select", args: ["currency"] },
    { table: "settings", method: "eq", args: ["site_id", siteId] },
    { table: "settings", method: "maybeSingle", args: [] },
  ])
  expect(createClient).toHaveBeenCalledWith(true)
})

it.each([undefined, null, "", "   ", "not-a-currency"])("does not invent a site currency when it is %s", async currency => {
  jest.mocked(createClient).mockResolvedValue(salesTestClient({
    settings: [{ site_id: otherSiteId, currency: "EUR" }, ...(currency === undefined ? [] : [{ site_id: siteId, currency }])],
  }))
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ currency: "UNSPECIFIED", noData: true, totalSales: { actual: 0 } })
})

it.each(["USD", "UNSPECIFIED"])("preserves the explicit %s selection without reading fallback settings", async currency => {
  const client = salesTestClient({ settings }, 500, "settings")
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(request({ currency }))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ currency, noData: true })
  expect(client.from).not.toHaveBeenCalledWith("settings")
})

it.each([
  ["2026-09-01", "EUR"], ["2026-08-30", "USD"], ["2026-09-01", null],
] as const)("preserves recorded sales currency %s / %s instead of relabeling amounts", async (date, currency) => {
  const client = salesTestClient({ settings, sales: [{
    id: "sale", site_id: siteId, status: "completed", sale_date: date, amount: 100, currency,
  }] }, 500, "settings")
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(request())
  const current = date >= "2026-08-31"
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    currency: currency ?? "UNSPECIFIED",
    totalSales: { actual: current ? 100 : 0, previous: current ? 0 : 100 },
  })
  expect(client.from).not.toHaveBeenCalledWith("settings")
})

it("still requires a selection for mixed currencies even if the site has a currency", async () => {
  const client = salesTestClient({ settings, sales: ["USD", "EUR"].map(currency => ({
    id: currency, site_id: siteId, status: "completed", sale_date: "2026-09-01", amount: 10, currency,
  })) })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(request())
  expect(response.status).toBe(422)
  expect(await response.json()).toMatchObject({ availableCurrencies: ["EUR", "USD"] })
  expect(client.from).not.toHaveBeenCalledWith("settings")
})

it("reports a settings query failure instead of returning a misleading empty success", async () => {
  jest.mocked(createClient).mockResolvedValue(salesTestClient({ settings }, 500, "settings"))
  const response = await GET(request())
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: "Failed to load the sales report. Please try again." })
})