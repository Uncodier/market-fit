import { buildSalesReport, SalesCurrencyRequiredError } from "@/app/api/revenue/build-sales-report"
import { aggregateSalesByCategory } from "@/app/api/revenue/revenue-aggregations"
import { queryReportSales, readSalesPages, SALES_FINANCIAL_FIELDS, type ReportSale } from "@/app/api/sales/sales-query"
import { salesReportPeriod, salesReportFilters } from "@/lib/sales/report-period"
import { formatSalesMoney } from "@/lib/sales/report-format"
import { salesTestClient } from "./sales-test-client"

const siteId = "00000000-0000-4000-8000-000000000001"
const segmentId = "00000000-0000-4000-8000-000000000002"
const period = salesReportPeriod(new URLSearchParams({ startDate: "2025-02-01", endDate: "2025-02-02" }))
const sale = (id: string, date: string, amount: number, extra = {}): ReportSale => ({
  id, amount, sale_date: date, created_at: `${date}T12:00:00Z`, status: "completed", currency: "USD", ...extra,
})
const options = { currency: null, segmentId: "all", includeCategories: false }

describe("sales report periods and filters", () => {
  it("uses equally sized inclusive nonoverlapping calendar periods", () => {
    expect(period).toMatchObject({ days: 2, start: "2025-02-01", endExclusive: "2025-02-03", previousStart: "2025-01-30", previousEnd: "2025-01-31" })
    expect(salesReportPeriod(new URLSearchParams({ startDate: "2024-03-01", endDate: "2024-03-01" }))).toMatchObject({ days: 1, previousStart: "2024-02-29", previousEnd: "2024-02-29" })
  })
  it.each(["2025-02-30", "not-a-date", "2025-13-01"])("rejects malformed dates %s", (startDate) => {
    expect(() => salesReportPeriod(new URLSearchParams({ startDate, endDate: "2025-03-01" }))).toThrow()
  })
  it("rejects reversed dates and invalid segment filters", () => {
    expect(() => salesReportPeriod(new URLSearchParams({ startDate: "2025-03-02", endDate: "2025-03-01" }))).toThrow()
    expect(() => salesReportFilters(new URLSearchParams({ siteId, segmentId: "malformed" }))).toThrow("Invalid segment")
  })
})

describe("complete and scoped sales queries", () => {
  it("paginates beyond the provider cap using explicit fields and filters", async () => {
    const rows = Array.from({ length: 1201 }, (_, i) => ({ ...sale(String(i), "2025-02-01", 1), site_id: siteId, segment_id: segmentId }))
    const client = salesTestClient({ sales: rows }, 300)
    const result = await queryReportSales(client, siteId, segmentId)
    expect(result).toHaveLength(1201)
    expect(client.calls.filter((call) => call.method === "select").every((call) => call.args[0] === SALES_FINANCIAL_FIELDS)).toBe(true)
    expect(client.calls.filter((call) => call.method === "eq")).toContainEqual({ table: "sales", method: "eq", args: ["segment_id", segmentId] })
    expect(client.calls.filter((call) => call.method === "range").length).toBeGreaterThan(4)
  })
  it("loads all scoped history including cancelled and older sales for receipt-date reporting", async () => {
    const rows = [
      sale("dated", "2025-02-01", 10), sale("next", "2025-02-03", 10),
      sale("wrong-sale-date", "2025-01-01", 10, { created_at: "2025-02-01T00:00:00Z" }),
      sale("fallback", "2025-02-01", 10, { sale_date: null }),
      sale("cancelled", "2025-02-01", 10, { status: "cancelled" }),
      sale("pending", "2025-02-01", 10, { status: "pending" }),
    ].map((row) => ({ ...row, site_id: siteId }))
    rows.push({ ...sale("foreign", "2025-02-01", 10), site_id: "foreign" })
    expect((await queryReportSales(salesTestClient({ sales: rows }), siteId, "all")).map((row) => row.id))
      .toEqual(["cancelled", "dated", "fallback", "next", "pending", "wrong-sale-date"])
  })
  it("fails on query errors and safety limits instead of returning partial totals", async () => {
    await expect(queryReportSales(salesTestClient({}, 500, "sales"), siteId, "all")).rejects.toThrow("query failed")
    const client = salesTestClient({ sales: [{ id: "1" }, { id: "2" }] })
    await expect(readSalesPages(() => client.from("sales").select("id"), 1)).rejects.toThrow("Too many")
  })
})

describe("sales report aggregation", () => {
  it("keeps previous data when current is empty and does not fetch category relations for summary", async () => {
    const client = salesTestClient({})
    const report = await buildSalesReport(client, [sale("previous", "2025-01-31", 100)], period, options)
    expect(report.totalSales).toMatchObject({ actual: 0, previous: 100, percentChange: -100 })
    expect(report.noData).toBe(true)
    expect(report.transactions).toMatchObject({ actual: 0, previous: 1 })
    expect(report.monthlyData.map((row) => row.month)).toEqual(["2025-02"])
    expect(client.from).not.toHaveBeenCalled()
  })
  it("includes all sources in channel totals and historical trend buckets", async () => {
    const report = await buildSalesReport(salesTestClient({}), [
      sale("1", "2025-02-01", 10, { source: "shop" }), sale("2", "2025-02-01", 20, { source: "pos" }),
      sale("3", "2025-02-02", 30, { source: "quote" }),
    ], period, options)
    expect(report.totalSales.percentChange).toBeNull()
    expect(report.monthlyData[0]).toEqual({ month: "2025-02", onlineSales: 10, retailSales: 20, otherSales: 30, totalSales: 60 })
    expect(report.salesDistribution.reduce((sum, row) => sum + row.amount, 0)).toBe(60)
    expect(report.averageOrderValue.actual).toBe(20)
  })
  it("never sums mixed currencies, and compares only the selected currency", async () => {
    const sales = [sale("1", "2025-02-01", 10), sale("2", "2025-01-31", 999, { currency: "EUR" })]
    await expect(buildSalesReport(salesTestClient({}), sales, period, options)).rejects.toBeInstanceOf(SalesCurrencyRequiredError)
    const report = await buildSalesReport(salesTestClient({}), sales, period, { ...options, currency: "USD" })
    expect(report.totalSales).toMatchObject({ actual: 10, previous: 0, percentChange: null })
    expect(report.availableCurrencies).toEqual(["EUR", "USD"])
    expect(formatSalesMoney(1234.56, "EUR")).toContain("1,234.56")
    expect(formatSalesMoney(123, "UNSPECIFIED")).not.toContain("$")
  })
  it("includes previous-only categories and the accurate total change", async () => {
    const report = await buildSalesReport(salesTestClient({}), [sale("1", "2025-02-01", 50, { product_type: "New" }), sale("2", "2025-01-31", 100, { product_type: "Old" })], period, { ...options, includeCategories: true })
    expect(report.salesCategories).toEqual([
      { name: "New", amount: 50, prevAmount: 0, percentChange: null },
      { name: "Old", amount: 0, prevAmount: 100, percentChange: -100 },
    ])
  })
  it("allocates multiple orders per sale without truncation and propagates relation errors", async () => {
    const client = salesTestClient({
      sale_orders: [{ id: "o1", sale_id: "s" }, { id: "o2", sale_id: "s" }],
      sale_order_items: [
        { id: "i1", sale_order_id: "o1", subtotal: 20, catalog_item: { category: { name: "A" } } },
        { id: "i2", sale_order_id: "o2", subtotal: 80, catalog_item: { category: { name: "B" } } },
        { id: "child", sale_order_id: "o2", subtotal: 1000, parent_sale_order_item_id: "i2" },
      ],
    }, 1)
    expect(await aggregateSalesByCategory(client, [sale("s", "2025-02-01", 200)])).toEqual(new Map([["A", 40], ["B", 160]]))
    await expect(aggregateSalesByCategory(salesTestClient({}, 500, "sale_orders"), [sale("s", "2025-02-01", 1)])).rejects.toThrow()
  })
})