import { availableDemos } from "@/lib/demo-data"
import { loadDemoDashboardBatch } from "@/lib/demo-data/overview-report"
import { loadDemoRecentActivity } from "@/lib/demo-data/activity-report"
import { loadDemoSalesReport } from "@/lib/demo-data/sales-report"
import { loadDemoCostReport } from "@/lib/demo-data/cost-report"
import { loadDemoTrafficReport } from "@/lib/demo-data/traffic-report"
import { loadDemoAnalyticsDistribution, loadDemoCohortReport } from "@/lib/demo-data/analytics-report"
import { getDemoSocialPerformance, getDemoSocialCommenters } from "@/lib/demo-data/social-report"
import { REPORTS, type ReportId } from "@/app/dashboard/report-sections"
import { reportMetricKeys, isReportBatch } from "@/lib/dashboard/report-groups"
import { parseCohortReport } from "@/app/components/dashboard/cohort-report-data"
import { distributionData } from "@/app/components/dashboard/report-query"
import { parseSessionEvents } from "@/app/components/dashboard/traffic/session-events-data"
import { shiftDay } from "@/lib/sales/report-period"

const today = new Date().toISOString().slice(0, 10)
const start = shiftDay(today, -29)
const sections = Object.entries(REPORTS).flatMap(([report, value]) => value.sections.map(section => ({ report: report as ReportId, section: section.id })))
const fetchMock = fetch as jest.Mock

beforeEach(() => fetchMock.mockReset())

describe.each(availableDemos)("all registered report sections: $id", ({ id }) => {
  it.each(sections)("populates $report / $section without HTTP requests", async ({ report, section }) => {
    const params = new URLSearchParams({ siteId: id, startDate: start, endDate: today, segmentId: "all", group: section })
    if (report === "performance" || (report === "overview" && section !== "activity")) {
      const batch = await loadDemoDashboardBatch(report, params)
      expect(isReportBatch(batch, reportMetricKeys(report, section)!)).toBe(true)
      if (report === "performance") for (const metric of Object.values(batch)) expect(metric.actual).toBeGreaterThan(0)
      else if (section === "summary") expect((batch.revenue.totalSales as { actual: number }).actual).toBeGreaterThan(0)
      else expect(batch.ltv.actual).toBeGreaterThan(0)
    } else if (report === "overview") {
      expect((await loadDemoRecentActivity(params)).activities.length).toBeGreaterThan(0)
    } else if (report === "sales") {
      params.set("includeCategories", String(section === "categories"))
      const data = await loadDemoSalesReport(params)
      expect(data.totalSales.actual).toBeGreaterThan(0)
      if (section === "channels") expect(data.channelSales.online.amount + data.channelSales.retail.amount).toBeGreaterThan(0)
      if (section === "categories") expect(data.salesCategories.length).toBeGreaterThan(0)
    } else if (report === "costs") {
      const data = await loadDemoCostReport(params)
      expect(data.totalCosts.actual).toBeGreaterThan(0)
      expect(data.costCategories.length).toBeGreaterThan(0)
    } else if (report === "analytics") {
      if (section === "distribution") {
        for (const endpoint of ["clients-by-segment", "clients-by-campaign", "revenue-by-segment", "revenue-by-campaign"]) {
          expect(distributionData(await loadDemoAnalyticsDistribution(endpoint, params)).length).toBeGreaterThan(0)
        }
      } else {
        const kind = section === "customers" ? "customers" : "leads"
        const data = parseCohortReport(await loadDemoCohortReport(kind, params), kind)
        expect((kind === "customers" ? data.salesCohorts : data.leadCohorts).length).toBeGreaterThan(0)
      }
    } else if (report === "traffic") {
      if (section === "sessions") {
        expect(parseSessionEvents(await loadDemoTrafficReport("traffic/session-events-combined", params)).totals.pageVisits).toBeGreaterThan(0)
      } else {
        const endpoints = section === "audience" ? ["regions", "devices", "browsers"] : ["pages", "referrals"]
        for (const endpoint of endpoints) expect(distributionData(await loadDemoTrafficReport(`traffic/${endpoint}`, params)).length).toBeGreaterThan(0)
      }
    } else {
      const from = new Date(`${start}T00:00:00Z`)
      const to = new Date(`${today}T23:59:59.999Z`)
      const data = await getDemoSocialPerformance(id, from, to, "UTC")
      expect(data.data.length).toBeGreaterThan(0)
      if (section === "networks") {
        expect(data.networks.length).toBeGreaterThan(0)
        expect((await getDemoSocialCommenters(id, from, to, "UTC")).data.length).toBeGreaterThan(0)
      }
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
})