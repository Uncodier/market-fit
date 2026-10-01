import { REPORTS, type ReportId } from "@/app/dashboard/report-sections"
import { expectedReportResources, reportExportRows, type ReportExportResource, type ReportExportScope } from "@/app/dashboard/export/report-export-data"
import { buildOverviewEconomics } from "@/app/dashboard/overview-economics-data"
import { costEfficiency, percentChange, type CostData } from "@/app/components/dashboard/cost-report-data"
import { marketingFromCategories, overheadFromCategories } from "@/lib/costs/aggregate-costs"
import { PERFORMANCE_GROUPS } from "@/lib/dashboard/report-groups"
import { parseTrafficAttribution } from "@/app/components/dashboard/traffic/attribution-data"

const scope: ReportExportScope = {
  report: "performance", section: "outcomes", siteId: "site-1", siteName: "Example site", userId: "never-export-user",
  segmentId: "all", segmentName: "All segments", startDate: "2026-09-01", endDate: "2026-09-30", timeZone: "UTC",
}
const metric = { actual: 2.123456789012345, previous: 0, percentChange: null, periodType: "monthly" }
const comparison = { actual: 8, previous: 4, percentChange: 100 }
const sales = {
  totalSales: { ...comparison, formattedActual: "Do not export rounded values" },
  transactions: comparison, averageOrderValue: { ...comparison, actual: 1.3333333333333333 },
  channelSales: { online: { amount: 7, prevAmount: 4, percentChange: 75 }, retail: { amount: 1, prevAmount: 0, percentChange: null }, other: { amount: 0, prevAmount: 0, percentChange: null } },
  monthlyData: [{ month: "2026-09", totalSales: 8, onlineSales: 7, retailSales: 1, otherSales: 0 }],
  dailyData: [{ date: "2026-09-02", totalSales: 8, onlineSales: 7, retailSales: 1, otherSales: 0 }],
  monthlyPendingData: [{ month: "2026-09", totalSales: null, onlineSales: null, retailSales: 0, otherSales: 0 }],
  salesDistribution: [{ category: "Online", percentage: 87.5, amount: 7 }],
  salesCategories: [{ name: "Other", amount: 8, prevAmount: 4, percentChange: 100 }],
  financialSummary: { receipts: comparison, refunds: null, netCollected: null,
    outstanding: { amount: null, saleCount: 3, unknownSaleCount: 1 },
    paymentStatus: { paid: { count: 2, amount: 8 }, partial: { count: 0, amount: 0 }, unpaid: { count: 0, amount: 0 }, unknown: { count: 1, amount: 0 } },
    excluded: { count: 2, amount: 10 }, cashIssues: 1 },
  currency: "EUR", availableCurrencies: ["EUR", "USD"], noData: false, periodType: "monthly",
  metadata: { startDate: "2026-09-01", endDate: "2026-09-30", prevStartDate: "2026-08-02", prevEndDate: "2026-08-31",
    basis: "Eligible pending and completed sales", dateBasis: "Sale date", categoriesIncluded: true,
    trendCoverage: { startDate: "2026-09-01", endDate: "2026-09-30", complete: true } },
}
const costs: CostData = {
  totalCosts: { actual: 60, previous: 30 }, currency: "EUR", availableCurrencies: ["EUR"],
  costCategories: [
    { name: "Marketing", amount: 30, prevAmount: 0, percentChange: 100 },
    { name: "Administration", amount: 10, prevAmount: 5, percentChange: 100 },
    { name: "Operations", amount: 20, prevAmount: 25, percentChange: -20 },
  ],
  monthlyData: [{ month: "Apr", fixedCosts: 10, variableCosts: 20 }],
  costDistribution: [{ category: "Marketing", amount: 30, percentage: 50 }],
  metadata: { days: 30, startDate: "2026-09-01", endDate: "2026-09-30", prevStartDate: "2026-08-02", prevEndDate: "2026-08-31" },
}
const performance = {
  ...Object.fromEntries(Object.values(PERFORMANCE_GROUPS).flat().map(key => [key, metric])),
  "metrics-overview": { ...metric, chartData: [{ date: "2026-09-01", leadsCreated: 1, tasks: 2, conversations: 3, engagement: 4, meetings: 5, sales: 6 }],
    breakdown: { leadsCreated: 1, tasks: 2, conversations: 3, engagement: 4, meetings: 5, sales: 6 } },
  tokens: { ...metric, chartData: [{ date: "2026-09-01", commands: 5, instanceLogs: 6, inputTokens: 7, outputTokens: 8 }],
    breakdown: { commands: 5, instanceLogs: 6, inputTokens: 7, outputTokens: 8 } },
}
const economics = {
  ltv: { ...metric, actual: 50, currency: "EUR", details: { dataSource: "purchase_tasks" } },
  cac: { ...metric, actual: -1, noData: true, currency: "EUR", details: { campaignBudget: 100, costSource: "campaign_budget" } },
  cpl: { ...metric, actual: 0, metadata: { leadsCount: 0, totalCosts: 100 } },
  roi: { ...metric, actual: 100, details: { totalRevenue: 10, totalTransactions: 0, campaignBudget: 0 } },
}
const cohort = { cohort: "Sep 1", cohortStart: "2026-09-01", size: 10, weeks: [100, 0, null] }
const social = {
  kpis: { totalViews: 0, totalReach: 4, totalComments: 0, totalLikes: 1, totalShares: 0, totalImpressions: 0, avgEngagementRate: null, postCount: 2 },
  metadata: { postCount: 2, missingMetricCounts: { views: 2, reach: 1, comments: 0, likes: 0, shares: 0, impressions: 2, engagement_rate: 2 },
    undatedPostCount: 1, oldestFetchedAt: null, newestFetchedAt: "2026-09-05T00:00:00Z", engagementRateConvention: "legacy_ratio_or_percent" },
  networks: [{ network: "x", views: 0, likes: 3, comments: 0, reach: 4, coverage: { accountRowCount: 2, missingMetricCounts: { views: 2, reach: 1, likes: 0, comments: 0 } } }],
  trends: { current: { views: 0, reach: 4, engagement: null, postCount: 2, missingMetricCounts: { views: 2, reach: 1, engagement_rate: 2 } },
    previous: { views: 0, postCount: 0 }, points: [], bucketDays: 1, undatedPostCount: 1 },
  data: [{ id: "private-snapshot", site_id: "private-site", outstand_post_id: "private-provider-id", content_id: "private-content-id",
    metrics_by_account: [{ token: "private-secret" }], likes: 0, comments: null, engagement_rate: 0.123456789012345,
    reportedEngagementRate: 12.3456789012345, fetched_at: "2026-09-04T01:00:00Z",
    content: { title: "Public post title", status: "published", published_at: "2026-09-01T01:00:00Z", secret: "private-secret" } }],
}

function rows(report: ReportId, section: string, resources: ReportExportResource[]) {
  return reportExportRows({ ...scope, report, section }, resources)
}
function at(data: ReturnType<typeof rows>, rowPath: string, field: string) {
  return data.find(row => row.rowPath === rowPath && row.field === field)
}
function source(id: string, data: unknown, filters?: Record<string, string>): ReportExportResource { return { id, data, filters } }

describe("report resource contract", () => {
  const expected: Record<ReportId, Record<string, string[]>> = {
    performance: { outcomes: ["dashboard/performance"], operations: ["dashboard/performance"], usage: ["dashboard/performance"] },
    overview: { summary: ["dashboard/overview"], economics: ["dashboard/overview"], activity: ["dashboard/performance", "recent-activity"] },
    analytics: { distribution: ["clients-by-segment", "clients-by-campaign", "revenue-by-segment", "revenue-by-campaign"], customers: ["cohorts"], leads: ["leads-cohorts"] },
    traffic: { summary: ["traffic/visits", "traffic/session-time", "traffic/lead-conversion", "traffic/client-conversion", "traffic/attribution", "traffic/pages", "traffic/referrals"], audience: ["traffic/regions", "traffic/devices", "traffic/browsers"], sessions: ["traffic/session-events-combined"] },
    sales: { summary: ["revenue"], channels: ["revenue"], categories: ["revenue"] },
    costs: { summary: ["costs", "revenue"], categories: ["costs"] },
    social: { summary: ["social-performance"], networks: ["social-performance", "social-commenters"], posts: ["social-performance"] },
  }
  test.each(Object.entries(REPORTS).flatMap(([report, config]) => config.sections.map(section => [report as ReportId, section.id] as const)))("%s / %s has exactly its mounted resources", (report, section) => {
    expect(expectedReportResources(report, section)).toEqual(expected[report][section])
    expect(rows(report, section, [])).toEqual(expected[report][section].map(dataset => ({ dataset, rowPath: "$", field: "", value: null, availability: "missing" })))
    const copy = expectedReportResources(report, section)
    copy.push("bad")
    expect(expectedReportResources(report, section)).not.toContain("bad")
  })
  test("unknown sections fail closed", () => {
    expect(expectedReportResources("sales", "__proto__")).toEqual([])
    expect(expectedReportResources("unknown" as ReportId, "summary")).toEqual([])
  })
})

describe("performance and overview projections", () => {
  test.each(["outcomes", "operations", "usage"] as const)("performance %s projects only group metrics and its plotted series", section => {
    const data = rows("performance", section, [source("dashboard/performance", performance)])
    for (const key of PERFORMANCE_GROUPS[section]) expect(data.some(row => row.rowPath.startsWith(`$.${key}`))).toBe(true)
    expect(data.some(row => row.rowPath.startsWith("$.tokens"))).toBe(section === "usage")
    expect(data.some(row => row.rowPath === "$.metrics-overview.chartData[0]" && row.field === "tasks")).toBe(section === "operations")
    expect(data.some(row => row.rowPath === "$.metrics-overview.chartData[0]" && row.field === "sales")).toBe(section === "outcomes")
    if (section === "usage") expect(at(data, "$.tokens.breakdown", "inputTokens")?.value).toBe(7)
  })
  test("overview summary retains sales precision, currency and trend coverage, not economics or internal diagnostics", () => {
    const data = rows("overview", "summary", [source("dashboard/overview", {
      revenue: sales, ...economics, "active-users": metric, "active-segments": { ...metric, debugInfo: { token: "secret" } },
      "active-campaigns": { ...metric, campaigns: [{ id: "secret" }] },
    })])
    expect(at(data, "$.revenue.totalSales", "actual")?.value).toBe(8)
    expect(at(data, "$.revenue", "currency")?.value).toBe("EUR")
    expect(at(data, "$.revenue.metadata.trendCoverage", "complete")?.value).toBe(true)
    expect(JSON.stringify(data)).not.toMatch(/secret|formattedActual|\$\.ltv|salesCategories/)
  })
  test("overview economics shares nullable frontend calculation and omits chart colors", () => {
    const data = rows("overview", "economics", [source("dashboard/overview", economics)])
    const expected = buildOverviewEconomics(economics)
    expect(at(data, "$.economics", "roi")).toMatchObject({ value: expected.roi, availability: "unavailable" })
    expect(at(data, "$.economics.cac", "value")).toMatchObject({ value: expected.cac.value, availability: "unavailable" })
    expect(at(data, "$.economics.cpl", "value")?.value).toBe(expected.cpl.value)
    expect(at(data, "$.cac.details", "campaignBudget")?.value).toBe(100)
    expect(at(data, "$.cac", "actual")).toBeUndefined()
    expect(JSON.stringify(data)).not.toMatch(/color|#[a-f0-9]{6}/)
    const positive = { ...economics, roi: { details: { totalRevenue: 25, totalTransactions: 7 } } }
    expect(at(rows("overview", "economics", [source("dashboard/overview", positive)]), "$.economics", "roi")?.value).toBe(buildOverviewEconomics(positive).roi)
  })
  test("economics exports only normalized metric values, never legacy sentinel values or unused comparisons", () => {
    const input = { ...economics, ltv: { ...economics.ltv, actual: 0, noData: true },
      roi: { ...economics.roi, details: { ...economics.roi.details, alternativeRoi: 100 } } }
    const data = rows("overview", "economics", [source("dashboard/overview", input)])
    for (const name of ["ltv", "cac", "cpl", "roi"]) {
      for (const field of ["actual", "previous", "percentChange"]) expect(at(data, `$.${name}`, field)).toBeUndefined()
    }
    for (const name of ["ltv", "cac", "cpl"]) {
      expect(at(data, `$.economics.${name}`, "value")).toMatchObject({ value: null, availability: "unavailable" })
    }
    expect(at(data, "$.economics", "roi")).toMatchObject({ value: null, availability: "unavailable" })
    expect(at(data, "$.roi.details", "alternativeRoi")).toBeUndefined()
    expect(at(data, "$.roi.details", "totalRevenue")?.value).toBe(10)
    expect(at(data, "$.cpl.metadata", "leadsCount")?.value).toBe(0)
    expect(at(data, "$.cac", "noData")?.value).toBe(true)
    expect(input.cac.actual).toBe(-1)
  })
  test("overview activity uses the activity series and loaded feed, without extra KPIs or identity fields", () => {
    const data = rows("overview", "activity", [source("dashboard/performance", performance), source("recent-activity", { activities: [
      { id: "secret", kind: "sale", title: "Sale", amount: "€5.00", date: "2026-09-01", user: { id: "secret", email: "secret", name: "Example" }, lead: { name: "Customer" } },
    ] }, { segmentId: "all", limit: "6" })])
    expect(data.find(row => row.dataset === "recent-activity" && row.field === "title")?.value).toBe("Sale")
    expect(at(data, "$.filters", "limit")?.value).toBe("6")
    expect(JSON.stringify(data)).not.toMatch(/secret|leads-contacted/)
  })
})

describe("analytics and traffic projections", () => {
  test("all four distributions retain currency, returned categories and safe coverage without colors or raw debug parameters", () => {
    const resources = expectedReportResources("analytics", "distribution").map((id, index) => source(id, {
      [id.endsWith("segment") ? "segments" : "campaigns"]: [{ name: `Group ${index}`, value: 0, color: "private-color" }],
      currency: "GBP", debug: { totalRevenue: 0, totalLeads: 0, originalParams: { userId: "secret" } },
    }))
    const data = rows("analytics", "distribution", resources)
    expect(data.filter(row => row.rowPath === "$.data[0]" && row.field === "value")).toHaveLength(4)
    expect(data.filter(row => row.field === "currency").map(row => row.value)).toEqual(["GBP", "GBP", "GBP", "GBP"])
    expect(JSON.stringify(data)).not.toMatch(/private-color|secret|originalParams/)
  })
  test.each(["customers", "leads"] as const)("%s cohorts retain zeros, unobserved weeks and denominator metadata", section => {
    const data = rows("analytics", section, [source(section === "customers" ? "cohorts" : "leads-cohorts", {
      salesCohorts: [cohort], usageCohorts: [], leadCohorts: [cohort],
      metadata: { definition: "Observed cohort", activityAvailable: false, activityUnavailableReason: "Not recorded", observationEnd: "2026-09-30" },
    })])
    const path = `$.${section === "customers" ? "salesCohorts" : "leadCohorts"}[0].weeks`
    expect(at(data, `${path}[1]`, "")).toMatchObject({ value: 0, availability: "available" })
    expect(at(data, `${path}[2]`, "")).toMatchObject({ value: null, availability: "unavailable" })
    expect(at(data, "$.metadata", "activityAvailable")?.value).toBe(false)
    if (section === "customers") expect(at(data, "$", "usageCohorts")?.availability).toBe("empty")
    else expect(JSON.stringify(data)).not.toContain("salesCohorts")
  })
  test("traffic acquisition retains KPI units, attribution model/coverage and distributions", () => {
    const attribution = parseTrafficAttribution({
      model: "session_entry", segmentMembership: "current", segments: [{ name: "Unknown", value: 1 }], campaigns: [{ name: "Unknown", value: 1 }],
      coverage: { totalSessions: 1, attributedSessions: 0, unattributedSessions: 1, segmentedSessions: 0, campaignSessions: 0 },
    })
    expect(attribution).not.toHaveProperty("segmentMembership")
    const resources = expectedReportResources("traffic", "summary").map(id => source(id, id === "traffic/attribution" ? attribution
      : id === "traffic/pages" || id === "traffic/referrals" ? { data: [{ name: "/", value: 2 }] } : metric))
    const data = rows("traffic", "summary", resources)
    expect(data.filter(row => row.field === "actualUnit").map(row => row.value)).toEqual(["sessions", "seconds", "percent", "percent"])
    expect(at(data, "$.coverage", "unattributedSessions")?.value).toBe(1)
    expect(at(data, "$", "model")?.value).toBe("session_entry")
    expect(at(data, "$.campaigns[0]", "value")?.value).toBe(1)
    expect(at(data, "$", "segmentMembership")).toMatchObject({ value: "current", availability: "available" })
    const basis = data.find(row => row.dataset === "traffic/attribution" && row.field === "basis")?.value
    expect(basis).toContain("current lead or visitor membership, not historical membership")
    expect(attribution).not.toHaveProperty("segmentMembership")
  })
  test("parsed empty attribution exports current membership without inventing observations", () => {
    const attribution = parseTrafficAttribution({
      model: "session_entry", segments: [], campaigns: [],
      coverage: { totalSessions: 0, attributedSessions: 0, unattributedSessions: 0, segmentedSessions: 0, campaignSessions: 0 },
    })
    const data = rows("traffic", "summary", [source("traffic/attribution", attribution)])
    expect(at(data, "$", "segmentMembership")?.value).toBe("current")
    expect(at(data, "$", "segments")?.availability).toBe("empty")
    expect(at(data, "$", "campaigns")?.availability).toBe("empty")
    expect(at(data, "$.coverage", "totalSessions")).toMatchObject({ value: 0, availability: "available" })
  })
  test("traffic audience handles normalized array and envelope payloads", () => {
    const data = rows("traffic", "audience", expectedReportResources("traffic", "audience").map((id, index) =>
      source(id, index === 0 ? [{ name: "US", value: 1, color: "secret" }] : { data: [] })))
    expect(at(data, "$.data[0]", "name")?.value).toBe("US")
    expect(data.filter(row => row.field === "data" && row.availability === "empty")).toHaveLength(2)
    expect(JSON.stringify(data)).not.toContain("secret")
  })
  test("uses the actual distribution hook's items/currency resource shape for analytics and traffic", () => {
    for (const [report, section] of [["analytics", "distribution"], ["traffic", "audience"]] as const) {
      const resources = expectedReportResources(report, section).map(id => source(id, {
        items: [{ name: "Returned category", value: 1.123456789012345, color: "private-color" }], currency: "CAD",
      }))
      const data = rows(report, section, resources)
      expect(data.filter(row => row.rowPath === "$.data[0]" && row.field === "value").map(row => row.value))
        .toEqual(resources.map(() => 1.123456789012345))
      expect(data.filter(row => row.field === "currency").map(row => row.value)).toEqual(resources.map(() => "CAD"))
      expect(JSON.stringify(data)).not.toContain("private-color")
    }
  })
  test("traffic sessions retains event counts, exact date labels and referrer URLs without raw events", () => {
    const data = rows("traffic", "sessions", [source("traffic/session-events-combined", {
      chartData: [{ date: "2026-09-01", label: "Sep 1", pageVisits: 9, uniqueVisitors: 3, referralVisits: 1 }],
      referrersData: [{ referrer: "example.com", count: 1, percentage: "33.3333333333333", fullUrl: "https://example.com/a" }],
      totals: { pageVisits: 9, uniqueVisitors: 3, referralVisits: 1 }, rawEvents: [{ secret: "secret" }],
    })])
    expect(at(data, "$.chartData[0]", "pageVisits")?.value).toBe(9)
    expect(at(data, "$.referrersData[0]", "percentage")?.value).toBe("33.3333333333333")
    expect(at(data, "$.referrersData[0]", "fullUrl")?.value).toBe("https://example.com/a")
    expect(JSON.stringify(data)).not.toContain("secret")
  })
})

describe("sales and cost section projections", () => {
  test.each(["summary", "channels", "categories"])("sales %s includes only section fields and common basis/currency", section => {
    const data = rows("sales", section, [source("revenue", sales)])
    const paths = data.map(row => row.rowPath).join(" ")
    expect(paths.includes("financialSummary")).toBe(section === "summary")
    expect(paths.includes("channelSales")).toBe(section === "channels")
    expect(paths.includes("salesCategories")).toBe(section === "categories")
    expect(paths.includes("monthlyData")).toBe(section !== "categories")
    expect(at(data, "$", "currency")?.value).toBe("EUR")
    expect(at(data, "$.metadata", "basis")?.value).toBe(sales.metadata.basis)
    expect(JSON.stringify(data)).not.toContain("formattedActual")
    if (section === "summary") {
      expect(at(data, "$.financialSummary", "refunds")?.availability).toBe("unavailable")
      expect(at(data, "$.financialSummary.outstanding", "unknownSaleCount")?.value).toBe(1)
      expect(at(data, "$.monthlyPendingData[0]", "totalSales")?.availability).toBe("unavailable")
      expect(at(data, "$.dailyData[0]", "onlineSales")).toBeUndefined()
    }
  })
  test("cost summary KPIs use the same frontend helpers with nullable comparisons", () => {
    const data = rows("costs", "summary", [source("costs", costs), source("revenue", sales)])
    const marketing = marketingFromCategories(costs.costCategories)
    const overhead = overheadFromCategories(costs.costCategories)
    expect(at(data, "$.kpis.marketing", "amount")?.value).toBe(marketing.amount)
    expect(at(data, "$.kpis.marketing", "percentChange")?.value).toBe(percentChange(marketing.amount, marketing.prevAmount))
    expect(at(data, "$.kpis.overhead", "amount")?.value).toBe(overhead.amount)
    expect(at(data, "$.kpis.overhead", "percentChange")?.value).toBe(percentChange(overhead.amount, overhead.prevAmount))
    expect(at(data, "$.kpis.efficiency", "ratio")?.value).toBe(costEfficiency(costs, sales).ratio)
    expect(at(data, "$.monthlyData[0]", "month")?.value).toBe("Apr")
    expect(JSON.stringify(data)).not.toContain("costCategories")
  })
  test.each(["missing", "currency", "campaign"])("cost efficiency stays unavailable for %s revenue scope", kind => {
    const resources = [source("costs", costs, kind === "campaign" ? { campaignId: "campaign-1" } : {})]
    if (kind !== "missing") resources.push(source("revenue", { ...sales, currency: kind === "currency" ? "USD" : "EUR" }))
    const data = rows("costs", "summary", resources)
    expect(at(data, "$.kpis.efficiency", "ratio")).toMatchObject({ value: null, availability: "unavailable" })
    expect(at(data, "$.kpis.efficiency", "reason")).toMatchObject({ availability: "available" })
    if (kind === "missing") expect(data.find(row => row.dataset === "revenue")?.availability).toBe("missing")
  })
  test.each([100, 200])("cost efficiency omits the no-baseline reason when comparison is valid (previous sales %s)", previous => {
    const currentCosts = { ...costs, totalCosts: { actual: 100, previous: 50 } }
    const currentSales = { ...sales, totalSales: { ...comparison, actual: 400, previous } }
    const expected = costEfficiency(currentCosts, currentSales)
    const data = rows("costs", "summary", [source("costs", currentCosts), source("revenue", currentSales)])
    expect(at(data, "$.kpis.efficiency", "ratio")?.value).toBe(4)
    expect(at(data, "$.kpis.efficiency", "change")).toMatchObject({ value: expected.change, availability: "available" })
    expect(at(data, "$.kpis.efficiency", "reason")?.value).toBeNull()
  })
  test("cost efficiency retains the no-baseline reason when only the ratio is available", () => {
    const currentSales = { ...sales, totalSales: { ...comparison, previous: 0 } }
    const data = rows("costs", "summary", [source("costs", costs), source("revenue", currentSales)])
    expect(at(data, "$.kpis.efficiency", "ratio")?.availability).toBe("available")
    expect(at(data, "$.kpis.efficiency", "change")).toMatchObject({ value: null, availability: "unavailable" })
    expect(at(data, "$.kpis.efficiency", "reason")?.value).toBe("No previous baseline")
  })
  test("cost categories exclude summary, revenue and efficiency even when resources are provided", () => {
    const data = rows("costs", "categories", [source("costs", costs), source("revenue", sales)])
    expect(at(data, "$.costCategories[0]", "name")?.value).toBe("Marketing")
    expect(data.every(row => row.dataset === "costs")).toBe(true)
    expect(JSON.stringify(data)).not.toMatch(/\$\.kpis|\$\.monthlyData/)
  })
  test("cost category comparisons use the UI helper rather than API no-baseline sentinels or rounded changes", () => {
    const categories = [
      { name: "New category", amount: 250, prevAmount: 0, percentChange: 100 },
      { name: "Existing category", amount: 250, prevAmount: 3, percentChange: 8233.3 },
    ]
    const data = rows("costs", "categories", [source("costs", { ...costs, costCategories: categories })])
    expect(at(data, "$.costCategories[0]", "percentChange")).toMatchObject({ value: null, availability: "unavailable" })
    expect(at(data, "$.costCategories[1]", "percentChange")?.value).toBe(percentChange(250, 3))
    expect(categories.map(row => row.percentChange)).toEqual([100, 8233.3])
  })
})

describe("social section projections and safe normalization", () => {
  test("summary preserves partial/unavailable coverage and genuine zeros, not networks/posts", () => {
    const data = rows("social", "summary", [source("social-performance", social)])
    expect(at(data, "$.kpis", "totalViews")).toMatchObject({ value: null, availability: "unavailable" })
    expect(at(data, "$.kpis", "totalReach")).toMatchObject({ value: 4, availability: "partial" })
    expect(at(data, "$.kpis", "totalComments")).toMatchObject({ value: 0, availability: "available" })
    expect(at(data, "$.trends.current", "views")?.availability).toBe("unavailable")
    expect(at(data, "$.trends", "points")?.availability).toBe("empty")
    expect(at(data, "$.metadata", "oldestFetchedAt")?.availability).toBe("unavailable")
    expect(JSON.stringify(data)).not.toMatch(/\$\.networks|\$\.data\[/)
  })
  test("networks retains account coverage plus commenter count/name but not identities", () => {
    const data = rows("social", "networks", [source("social-performance", social), source("social-commenters", [{ id: "secret", name: "Example author", count: 2, avatar: "secret" }])])
    expect(at(data, "$.networks[0]", "views")?.availability).toBe("unavailable")
    expect(at(data, "$.networks[0]", "reach")?.availability).toBe("partial")
    expect(at(data, "$[0]", "name")?.value).toBe("Example author")
    expect(at(data, "$[0]", "count")?.value).toBe(2)
    expect(JSON.stringify(data)).not.toMatch(/secret|\$\.trends|\$\.data\[/)
  })
  test("posts retains all loaded posts, publication, precise metrics and metadata, stripping internal/raw fields", () => {
    const data = rows("social", "posts", [source("social-performance", { ...social, data: [...social.data, ...social.data] })])
    expect(at(data, "$.data[0].content", "title")?.value).toBe("Public post title")
    expect(at(data, "$.data[1]", "engagement_rate")?.value).toBe(0.123456789012345)
    expect(at(data, "$.data[0]", "comments")?.availability).toBe("unavailable")
    expect(at(data, "$.metadata", "undatedPostCount")?.value).toBe(1)
    expect(JSON.stringify(data)).not.toMatch(/private-|metrics_by_account|outstand_post_id|content_id|site_id|\$\.kpis|\$\.trends|\$\.networks/)
  })
  test("missing, null, nonfinite, zero, empty and structured scalar values are not conflated", () => {
    const data = rows("traffic", "audience", [source("traffic/regions", { data: [
      { name: "Zero", value: 0 }, { name: "Null", value: null }, { name: "Missing" }, { name: "Invalid", value: Infinity },
      { name: { raw: "secret" }, value: NaN },
    ] }), source("traffic/devices", { data: [] }), source("traffic/browsers", null)])
    expect(at(data, "$.data[0]", "value")?.availability).toBe("available")
    expect(at(data, "$.data[1]", "value")?.availability).toBe("unavailable")
    expect(at(data, "$.data[2]", "value")?.availability).toBe("missing")
    expect(at(data, "$.data[3]", "value")?.availability).toBe("unavailable")
    expect(at(data, "$.data[4]", "name")?.availability).toBe("unavailable")
    expect(data.some(row => row.availability === "empty")).toBe(true)
    expect(data.every(row => row.value === null || ["string", "number", "boolean"].includes(typeof row.value))).toBe(true)
    expect(JSON.stringify(data)).not.toContain("secret")
  })
  test("does not mutate input, export foreign resources, user IDs or unexpected filters", () => {
    const input = JSON.parse(JSON.stringify(social))
    const before = JSON.stringify(input)
    const data = rows("social", "summary", [source("social-performance", input, { currency: "EUR", userId: "secret", raw: "secret" }), source("revenue", sales)])
    expect(JSON.stringify(input)).toBe(before)
    expect(data.every(row => row.dataset === "social-performance")).toBe(true)
    expect(JSON.stringify(data)).not.toMatch(/secret|never-export-user/)
  })
})