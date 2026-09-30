/** @jest-environment node */

import { GET } from "@/app/api/revenue/route"
import { loadSalesReportSources } from "@/app/api/revenue/report-sources"
import { queryReportSales } from "@/app/api/sales/sales-query"
import { createClient } from "@/lib/supabase/server"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { salesReportPeriod } from "@/lib/sales/report-period"
import { salesTestClient } from "./sales-test-client"

jest.mock("@/lib/auth/api-analytics-access", () => ({ requireAnalyticsAccess: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const segmentId = "00000000-0000-4000-8000-000000000002"
const params = new URLSearchParams({ siteId, segmentId, startDate: "2026-09-01", endDate: "2026-09-02", includeCategories: "false" })
const period = salesReportPeriod(params)
const sale = (id: string, extra = {}) => ({
  id, site_id: siteId, segment_id: segmentId, amount: 100, amount_due: 100, payments: [],
  status: "pending", currency: "USD", sale_date: "2026-09-01", created_at: "2026-09-01T12:00:00Z", ...extra,
})
const request = () => new Request(`http://localhost/api/revenue?${params}`)

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireAnalyticsAccess).mockResolvedValue({
    siteId, userId: "user", startDate: new Date(period.start), endDate: new Date(period.end),
  })
})

const owner = [{ id: siteId, user_id: "user" }]

it("reads order cancellation and dated refunds with explicit tenant filters, without category queries", async () => {
  const client = salesTestClient({
    sites: owner,
    sales: [sale("active"), sale("cancelled", { amount_due: 80, payments: [{ amount: 20, date: "2026-09-01" }] }),
      sale("prior", { sale_date: "2025-01-01", amount_due: 0, payments: [{ amount: 100, date: "2026-09-01" }] }),
      sale("foreign", { site_id: "foreign" }), sale("other-segment", { segment_id: "other" })],
    sale_orders: [
      { id: "o1", site_id: siteId, sale_id: "cancelled", status: "cancelled" },
      { id: "foreign", site_id: "foreign", sale_id: "active", status: "cancelled" },
    ],
    accounting_sale_refunds: [
      { id: "re_1", site_id: siteId, sale_id: "prior", amount: 30, currency: "USD", refunded_at: "2026-09-02T12:00:00Z" },
      { id: "re_foreign", site_id: "foreign", sale_id: "prior", amount: 999, currency: "USD", refunded_at: "2026-09-02T12:00:00Z" },
    ],
  }, 1)
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    totalSales: { actual: 100 }, transactions: { actual: 1 },
    financialSummary: { receipts: { actual: 120 }, refunds: { actual: 30 }, netCollected: { actual: 90 },
      outstanding: { amount: 100 }, excluded: { count: 1, amount: 100 } },
  })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(client.from).not.toHaveBeenCalledWith("sale_order_items")
  for (const table of ["sales", "sale_orders", "accounting_sale_refunds"]) {
    expect(client.calls).toContainEqual({ table, method: "eq", args: ["site_id", siteId] })
  }
  expect(client.calls).toContainEqual({ table: "sales", method: "eq", args: ["segment_id", segmentId] })
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
})

it("continues after short pages in both relation tables and across ID batches", async () => {
  const sales = Array.from({ length: 105 }, (_, i) => sale(String(i)))
  const client = salesTestClient({
    sales,
    sale_orders: sales.flatMap(sale => [0, 1].map(i => ({ id: `o-${sale.id}-${i}`, sale_id: sale.id, site_id: siteId, status: i ? "cancelled" : "pending" }))),
    accounting_sale_refunds: sales.map(sale => ({ id: `re_${sale.id}`, sale_id: sale.id, site_id: siteId, amount: 1, currency: "USD", refunded_at: "2026-09-01" })),
  }, 10)
  const result = await loadSalesReportSources(client, siteId, segmentId, period)
  expect(result).toHaveLength(105)
  expect(result.every(sale => sale.order_statuses.length === 2 && sale.refunds.length === 1)).toBe(true)
  expect(result.at(-1)?.order_statuses).toContain("cancelled")
})

it.each(["sale_orders", "accounting_sale_refunds"])("fails closed when the %s source is unavailable", async table => {
  jest.mocked(createClient).mockResolvedValue(salesTestClient({ sites: owner, sales: [sale("sale")] }, 500, table))
  const response = await GET(request())
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: "Failed to load the sales report. Please try again." })
})

it("fails explicitly when complete payment history exceeds the scan ceiling", async () => {
  const client = salesTestClient({ sales: [sale("one"), sale("two")] }, 1)
  await expect(queryReportSales(client, siteId, segmentId, 1)).rejects.toThrow("complete sales history")
})

it("uses site currency when historical rows have no activity in either period", async () => {
  const client = salesTestClient({ sites: owner, sales: [sale("old", { sale_date: "2025-01-01" })], settings: [{ site_id: siteId, currency: "MXN" }] })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ currency: "MXN", availableCurrencies: [], financialSummary: { netCollected: { actual: 0 } } })
})

it("does not hide missing historical receipts by narrowing the sale-date range", async () => {
  jest.mocked(createClient).mockResolvedValue(salesTestClient({
    sites: owner,
    sales: [sale("legacy", { sale_date: "2025-01-01", amount_due: 0 })],
  }))
  const response = await GET(request())
  expect(await response.json()).toMatchObject({
    totalSales: { actual: 0 }, financialSummary: { receipts: null, netCollected: null, cashIssues: 1 },
  })
})

it.each([true, null, undefined])("denies incomplete assigned-only visibility (%s) before reading money", async restriction => {
  const client = salesTestClient({
    site_members: [{ site_id: siteId, user_id: "user", status: "active", restrict_to_assigned_only: restriction }],
    // The linked cancelled order is hidden by RLS; a visible active order cannot prove completeness.
    sales: [sale("visible")], sale_orders: [{ id: "visible-order", sale_id: "visible", site_id: siteId, status: "pending" }],
  })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(request())
  expect(response.status).toBe(403)
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("record visibility") })
  expect(client.from).not.toHaveBeenCalledWith("sales")
})

it.each(["member", "co-owner"])("permits complete %s visibility without elevating the report client", async kind => {
  const client = salesTestClient({
    site_members: [{ site_id: siteId, user_id: "user", status: "active", restrict_to_assigned_only: kind !== "member" }],
    site_ownership: kind === "co-owner" ? [{ site_id: siteId, user_id: "user" }] : [],
    sales: [sale("visible")],
  })
  jest.mocked(createClient).mockResolvedValue(client)
  expect((await GET(request())).status).toBe(200)
  expect(createClient).toHaveBeenCalledWith(true)
})

it("does not accept ownership or unrestricted membership from another site", async () => {
  const client = salesTestClient({
    sites: [{ id: "foreign", user_id: "user" }],
    site_ownership: [{ site_id: "foreign", user_id: "user" }],
    site_members: [{ site_id: "foreign", user_id: "user", status: "active", restrict_to_assigned_only: false }],
  })
  jest.mocked(createClient).mockResolvedValue(client)
  expect((await GET(request())).status).toBe(403)
  expect(client.from).not.toHaveBeenCalledWith("sales")
})