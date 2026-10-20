import * as registry from "@/lib/demo-data"
import { attachDemoAnalytics } from "@/lib/demo-data/analytics-seed"
import { loadDemoAnalyticsDistribution, loadDemoCohortReport } from "@/lib/demo-data/analytics-report"
import { distributionData, distributionTotal } from "@/app/components/dashboard/report-query"
import { parseCohortReport } from "@/app/components/dashboard/cohort-report-data"
import { shiftDay } from "@/lib/sales/report-period"
import type { DemoReportRow } from "@/lib/demo-data/report-types"
import { demoReportContext } from "@/lib/demo-data/report-context"

jest.mock("@/lib/demo-data/report-context", () => {
  const actual = jest.requireActual("@/lib/demo-data/report-context")
  return { ...actual, demoReportContext: jest.fn(actual.demoReportContext) }
})

const today = new Date().toISOString().slice(0, 10)
const endpoints = ["clients-by-segment", "clients-by-campaign", "revenue-by-segment", "revenue-by-campaign"]
const filters = (siteId: string, segmentId = "all", startDate = shiftDay(today, -29), endDate = today) =>
  new URLSearchParams({ siteId, segmentId, startDate, endDate })

beforeEach(() => {
  (fetch as jest.Mock).mockReset()
  jest.mocked(demoReportContext).mockReset().mockImplementation(jest.requireActual("@/lib/demo-data/report-context").demoReportContext)
})

function useRecords(data: Record<string, DemoReportRow[]>) {
  jest.mocked(demoReportContext).mockImplementationOnce(async params => {
    const context = await jest.requireActual("@/lib/demo-data/report-context").demoReportContext(params)
    const rows = (table: string) => (data[table] || []).filter(row => row.site_id === context.siteId)
    return { ...context, data, rows, scoped: (table: string) => rows(table).filter(row =>
      context.segmentId === "all" || (row.segment_id || context.leadMap.get(row.lead_id || "")?.segment_id) === context.segmentId) }
  })
}

describe.each(registry.availableDemos)("Analytics source records: $id", ({ id }) => {
  it.each(endpoints)("populates %s for current and previous dates and every segment", async endpoint => {
    const data = await registry.getDemoData(id)
    for (const [from, to] of [[shiftDay(today, -29), today], [shiftDay(today, -59), shiftDay(today, -30)]]) {
      const all = distributionTotal(distributionData(await loadDemoAnalyticsDistribution(endpoint, filters(id, "all", from, to))))
      expect(all).toBeGreaterThan(0)
      for (const segment of data!.segments) {
        const total = distributionTotal(distributionData(await loadDemoAnalyticsDistribution(endpoint, filters(id, segment.id, from, to))))
        expect(total).toBeGreaterThan(0)
        expect(total).toBeLessThan(all)
      }
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(["customers", "leads"] as const)("has meaningful mature %s cohorts for every segment and prior dates", async kind => {
    const data = await registry.getDemoData(id)
    for (const segmentId of ["all", ...data!.segments.map((row: DemoReportRow) => row.id)]) {
      for (const [from, to] of [[shiftDay(today, -29), today], [shiftDay(today, -59), shiftDay(today, -30)]]) {
        const report = parseCohortReport(await loadDemoCohortReport(kind, filters(id, segmentId, from, to)), kind)
        const rows = kind === "customers" ? report.salesCohorts : report.leadCohorts
        expect(rows.length).toBeGreaterThan(2)
        expect(rows.every(row => row.weeks[0] === 100 && row.size! > 0)).toBe(true)
        expect(rows.some(row => row.weeks.slice(1).some(value => value !== null && value > 0 && value < 100))).toBe(true)
        expect(rows.some(row => row.weeks.includes(null))).toBe(true)
        if (kind === "customers") {
          expect(report.usageCohorts.length).toBe(rows.length)
          expect(report.usageCohorts.some((row, index) => JSON.stringify(row.weeks) !== JSON.stringify(rows[index].weeks))).toBe(true)
        }
        expect(report.metadata?.activityAvailable).toBe(true)
        expect(report.metadata?.weekStartsOn).toBe("Monday")
      }
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it("keeps empty dates and missing segments empty, including each cohort measure", async () => {
    for (const params of [filters(id, "missing-segment"), filters(id, "all", shiftDay(today, 365), shiftDay(today, 394))]) {
      for (const endpoint of endpoints) expect(distributionData(await loadDemoAnalyticsDistribution(endpoint, params))).toEqual([])
      for (const kind of ["customers", "leads"] as const) {
        const report = parseCohortReport(await loadDemoCohortReport(kind, params), kind)
        expect(report.salesCohorts).toEqual([])
        expect(report.usageCohorts).toEqual([])
        expect(report.leadCohorts).toEqual([])
      }
    }
  })

  it("refreshes deterministically without duplicates or changing unrelated records", async () => {
    const data = await registry.getDemoData(id)
    const now = new Date("2026-10-20T12:00:00.000Z")
    const seeded = attachDemoAnalytics(data!, now)
    const repeated = attachDemoAnalytics(seeded, now)
    expect(repeated).toEqual(seeded)
    expect(seeded.segments).toBe(data!.segments)
    expect(seeded.tasks).toBe(data!.tasks)
    for (const table of ["leads", "campaigns", "sales", "sale_orders", "sale_order_items", "conversations", "messages"]) {
      expect(new Set(seeded[table].map(row => row.id)).size).toBe(seeded[table].length)
      const unrelated = data![table].filter((row: DemoReportRow) => !row.id.includes(`${id}-analytics-`))
      expect(seeded[table].filter(row => !row.id.includes(`${id}-analytics-`))).toEqual(unrelated)
    }
    const sales = seeded.sales.filter(row => row.id.includes(`${id}-analytics-`))
    expect(sales.some((sale, index) => sales.findIndex(row => row.lead_id === sale.lead_id) !== index)).toBe(true)
    for (const sale of sales) {
      expect(seeded.leads.some(row => row.id === sale.lead_id)).toBe(true)
      expect(seeded.campaigns.some(row => row.id === sale.campaign_id && row.segment_id === sale.segment_id)).toBe(true)
      const order = seeded.sale_orders.find(row => row.sale_id === sale.id)!
      expect(order.created_at).toBe(sale.created_at)
      expect(seeded.sale_order_items.some(row => row.sale_order_id === order.id)).toBe(true)
    }
  })
})

it("does not select local records for real/unknown sites or unknown endpoints and validates ranges", async () => {
  for (const siteId of ["demo-unknown", "real-site", ""]) {
    for (const endpoint of endpoints) expect(await loadDemoAnalyticsDistribution(endpoint, filters(siteId))).toBeNull()
    for (const kind of ["customers", "leads"] as const) expect(await loadDemoCohortReport(kind, filters(siteId))).toBeNull()
  }
  const id = registry.availableDemos[0].id
  expect(await loadDemoAnalyticsDistribution("unknown", filters(id))).toBeNull()
  for (const start of ["invalid-date", shiftDay(today, -94), shiftDay(today, 1)]) {
    await expect(loadDemoAnalyticsDistribution(endpoints[0], filters(id, "all", start))).rejects.toThrow()
    await expect(loadDemoCohortReport("customers", filters(id, "all", start))).rejects.toThrow()
  }
  expect(fetch).not.toHaveBeenCalled()
})

it("derives retention from messages and purchases and enforces conversation tenancy/linkage", async () => {
  const id = registry.availableDemos[0].id
  const data = await registry.getDemoData(id)
  const params = filters(id, data!.segments[0].id)
  const normal = parseCohortReport(await loadDemoCohortReport("customers", params), "customers")
  const withoutInbound = { ...data!, messages: data!.messages.map((row: DemoReportRow) => ({ ...row, role: "assistant" })) }
  useRecords(withoutInbound)
  const noActivity = parseCohortReport(await loadDemoCohortReport("customers", params), "customers")
  expect(noActivity.salesCohorts).toEqual(normal.salesCohorts)
  expect(noActivity.usageCohorts.every(row => row.weeks.slice(1).every(value => value === 0 || value === null))).toBe(true)
  const member = data!.leads.find((row: DemoReportRow) => row.segment_id === params.get("segmentId") && row.id.includes("-analytics-"))!
  const foreignConversation = { id: "foreign-conversation", site_id: "real-site", lead_id: member.id, created_at: member.created_at }
  const unsafe = { ...withoutInbound, conversations: [...data!.conversations, foreignConversation], messages: [
    { id: "foreign", conversation_id: foreignConversation.id, role: "user", created_at: today },
    { id: "conflict", conversation_id: data!.conversations.find((row: DemoReportRow) => row.lead_id === member.id)!.id,
      lead_id: "other-lead", role: "visitor", created_at: today },
  ] }
  useRecords(unsafe)
  expect(parseCohortReport(await loadDemoCohortReport("customers", params), "customers").usageCohorts).toEqual(noActivity.usageCohorts)
  const firstSales = new Map<string, DemoReportRow>()
  for (const sale of [...data!.sales].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (sale.lead_id && !firstSales.has(sale.lead_id)) firstSales.set(sale.lead_id, sale)
  }
  useRecords({ ...data!, sales: [...firstSales.values()] })
  const noRepeat = parseCohortReport(await loadDemoCohortReport("customers", params), "customers")
  expect(noRepeat.salesCohorts.every(row => row.weeks.slice(1).every(value => value === 0 || value === null))).toBe(true)
})

it("counts linked clients only once and scopes revenue to the reported currency", async () => {
  const id = registry.availableDemos[0].id
  const data = await registry.getDemoData(id)
  const params = filters(id)
  const baseline = distributionTotal(distributionData(await loadDemoAnalyticsDistribution("clients-by-campaign", params)))
  const recent = data!.sales.find((row: DemoReportRow) => row.created_at.slice(0, 10) >= shiftDay(today, -29) && row.lead_id)!
  useRecords({ ...data!, sales: [...data!.sales, { ...recent, id: "duplicate-purchase" }] })
  expect(distributionTotal(distributionData(await loadDemoAnalyticsDistribution("clients-by-campaign", params)))).toBe(baseline)
  const currency = data!.catalog_items[0].currency || "USD"
  params.set("currency", currency)
  const revenue = distributionTotal(distributionData(await loadDemoAnalyticsDistribution("revenue-by-segment", params)))
  useRecords({ ...data!, sales: [...data!.sales, { ...recent, id: "foreign-currency", currency: "ZZZ", amount: 999999 }] })
  const report = await loadDemoAnalyticsDistribution("revenue-by-segment", params)
  expect(report).toHaveProperty("currency", currency)
  expect(distributionTotal(distributionData(report))).toBe(revenue)
})