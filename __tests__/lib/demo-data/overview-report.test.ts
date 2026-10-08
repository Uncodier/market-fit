import { availableDemos, getDemoData, isKnownDemoSite } from "@/lib/demo-data"
import { loadDemoDashboardBatch } from "@/lib/demo-data/overview-report"
import { loadDemoRecentActivity } from "@/lib/demo-data/activity-report"
import { attachDemoOverview } from "@/lib/demo-data/overview-seed"
import { buildOverviewEconomics } from "@/app/dashboard/overview-economics-data"
import { reportMetricKeys, isReportBatch } from "@/lib/dashboard/report-groups"
import { shiftDay } from "@/lib/sales/report-period"

const today = new Date().toISOString().slice(0, 10)
const filters = (siteId: string, group: string, segmentId = "all", startDate = shiftDay(today, -29), endDate = today) =>
  new URLSearchParams({ siteId, group, segmentId, startDate, endDate })

describe.each(availableDemos)("Overview fixtures: $id", ({ id }) => {
  it("populates every summary metric and reconciles the daily sales trend", async () => {
    const batch = await loadDemoDashboardBatch("overview", filters(id, "summary"))
    expect(isReportBatch(batch, reportMetricKeys("overview", "summary")!)).toBe(true)
    for (const key of ["active-users", "active-segments", "active-campaigns"]) {
      expect(batch[key].actual).toBeGreaterThan(0)
    }
    const total = batch.revenue.totalSales as { actual: number }
    const daily = batch.revenue.dailyData as { totalSales: number }[]
    expect(total.actual).toBeGreaterThan(0)
    expect(daily).toHaveLength(30)
    expect(daily.reduce((sum, row) => sum + row.totalSales, 0)).toBeCloseTo(total.actual)
    expect(daily.filter(row => row.totalSales > 0).length).toBeGreaterThan(3)
  })

  it("populates economics and both activity sources", async () => {
    const economics = buildOverviewEconomics(await loadDemoDashboardBatch("overview", filters(id, "economics")))
    expect(economics.ltv.value).toBeGreaterThan(0)
    expect(economics.cac.value).toBeGreaterThan(0)
    expect(economics.cpl.value).toBeGreaterThan(0)
    expect(economics.roi).not.toBeNull()
    expect(economics.valueBars).toHaveLength(2)
    expect(economics.returnBars).toHaveLength(2)
    const batch = await loadDemoDashboardBatch("performance", filters(id, "outcomes"))
    expect(isReportBatch(batch, reportMetricKeys("performance", "outcomes")!)).toBe(true)
    const breakdown = batch["metrics-overview"].breakdown as Record<string, number>
    for (const metric of ["sales", "meetings", "engagement", "conversations"]) expect(breakdown[metric]).toBeGreaterThan(0)
    const { activities } = await loadDemoRecentActivity(filters(id, "activity"))
    expect(activities).toHaveLength(6)
    expect(activities.some(row => row.kind === "task")).toBe(true)
    expect(activities.some(row => row.kind === "sale")).toBe(true)
    expect(activities.every(row => row.date.slice(0, 10) >= shiftDay(today, -29))).toBe(true)
  })

  it("covers every selectable segment and respects empty filters", async () => {
    const data = await getDemoData(id)
    for (const segment of data!.segments) {
      const batch = await loadDemoDashboardBatch("overview", filters(id, "summary", segment.id))
      expect((batch.revenue.totalSales as { actual: number }).actual).toBeGreaterThan(0)
      expect(batch["active-users"].actual).toBeGreaterThan(0)
      const economics = buildOverviewEconomics(await loadDemoDashboardBatch("overview", filters(id, "economics", segment.id)))
      expect(economics.cpl.value).toBeGreaterThan(0)
    }
    const empty = await loadDemoDashboardBatch("overview", filters(id, "summary", "missing-segment"))
    expect((empty.revenue.totalSales as { actual: number }).actual).toBe(0)
    expect(empty["active-users"].actual).toBe(0)
    const future = filters(id, "summary", "all", shiftDay(today, 365), shiftDay(today, 394))
    const futureBatch = await loadDemoDashboardBatch("overview", future)
    expect((futureBatch.revenue.totalSales as { actual: number }).actual).toBe(0)
    expect((await loadDemoRecentActivity(future)).activities).toEqual([])
  })

  it("refreshes linked sample records without duplicating or mutating its input", async () => {
    const data = await getDemoData(id)
    const before = JSON.stringify(data)
    const refreshed = attachDemoOverview(data!, new Date(`${shiftDay(today, 365)}T12:00:00Z`))
    expect(JSON.stringify(data)).toBe(before)
    expect(refreshed.sales).toHaveLength(data!.sales.length)
    const sample = refreshed.sales.filter((row: { id: string }) => row.id.includes(`${id}-overview-`))
    expect(sample.some(row => row.sale_date === shiftDay(today, 365))).toBe(true)
    expect(sample.every(row => refreshed.leads.some(lead => lead.id === row.lead_id))).toBe(true)
  })
})

it("rejects unknown demos, real sites, invalid dates and oversized ranges", async () => {
  for (const id of ["demo-unknown", "real-site", ""]) {
    expect(isKnownDemoSite(id)).toBe(false)
    await expect(loadDemoDashboardBatch("overview", filters(id, "summary"))).rejects.toThrow("Unknown demo site")
  }
  await expect(loadDemoDashboardBatch("overview", filters(availableDemos[0].id, "summary", "all", "bad-date"))).rejects.toThrow()
  await expect(loadDemoDashboardBatch("overview", filters(availableDemos[0].id, "summary", "all", shiftDay(today, -100)))).rejects.toThrow("too large")
})

it("keeps HabitUall's MXN and USD sales separate when changing reporting currency", async () => {
  const params = filters("demo-habituall", "summary", "all", shiftDay(today, -92))
  const mxn = await loadDemoDashboardBatch("overview", params)
  params.set("currency", "USD")
  const usd = await loadDemoDashboardBatch("overview", params)
  expect(mxn.revenue.currency).toBe("MXN")
  expect(usd.revenue.currency).toBe("USD")
  expect(mxn.revenue.availableCurrencies).toEqual(expect.arrayContaining(["MXN", "USD"]))
  const mxnSales = (mxn.revenue.totalSales as { actual: number }).actual
  const usdSales = (usd.revenue.totalSales as { actual: number }).actual
  expect(mxnSales).toBeGreaterThan(0)
  expect(usdSales).toBeGreaterThan(0)
  expect(mxnSales).not.toBe(usdSales)
})