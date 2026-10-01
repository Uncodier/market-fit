import { REPORTS, type ReportId } from "../report-sections"
import { economicsData, overviewSchema, performanceSchema } from "./report-export-batches"
import { costCategoriesData, costRevenueSchema, costSchema, costSummary, salesSchema } from "./report-export-financial"
import { commenterSchema, socialData, socialSchema } from "./report-export-social"
import { distributionSchema, fields, metricSchema, periodSchema, projectRows, record, type ExportSchema, type ReportExportRow } from "./report-export-projection"

export type { ReportExportRow } from "./report-export-projection"
export type ReportExportScope = {
  report: ReportId
  section: string
  siteId: string
  siteName: string
  userId: string
  segmentId: string
  segmentName: string
  startDate: string
  endDate: string
  timeZone: string
}
export type ReportExportResource = { id: string; data: unknown; filters?: Record<string, string> }

const resourcesByReport: Record<ReportId, Record<string, readonly string[]>> = {
  performance: { outcomes: ["dashboard/performance"], operations: ["dashboard/performance"], usage: ["dashboard/performance"] },
  overview: { summary: ["dashboard/overview"], economics: ["dashboard/overview"], activity: ["dashboard/performance", "recent-activity"] },
  analytics: {
    distribution: ["clients-by-segment", "clients-by-campaign", "revenue-by-segment", "revenue-by-campaign"],
    customers: ["cohorts"], leads: ["leads-cohorts"],
  },
  traffic: {
    summary: ["traffic/visits", "traffic/session-time", "traffic/lead-conversion", "traffic/client-conversion", "traffic/attribution", "traffic/pages", "traffic/referrals"],
    audience: ["traffic/regions", "traffic/devices", "traffic/browsers"], sessions: ["traffic/session-events-combined"],
  },
  sales: { summary: ["revenue"], channels: ["revenue"], categories: ["revenue"] },
  costs: { summary: ["costs", "revenue"], categories: ["costs"] },
  social: { summary: ["social-performance"], networks: ["social-performance", "social-commenters"], posts: ["social-performance"] },
}

export function expectedReportResources(report: ReportId, section: string): string[] {
  if (!Object.prototype.hasOwnProperty.call(REPORTS, report) ||
    !REPORTS[report].sections.some(item => item.id === section)) return []
  return [...resourcesByReport[report][section]]
}

const cohortRow: ExportSchema = { ...fields("cohort", "cohortStart", "size"), weeks: [true] }
const cohortMetadata: ExportSchema = fields("definition", "usageDefinition", "activityDefinition", "activityAvailable",
  "activityUnavailableReason", "observationEnd", "startDate", "endDate", "weekStartsOn", "excludedAnonymousSales")
const sessionSchema: ExportSchema = {
  chartData: [fields("date", "label", "pageVisits", "uniqueVisitors", "referralVisits")],
  referrersData: [fields("referrer", "count", "percentage", "fullUrl")],
  totals: fields("pageVisits", "uniqueVisitors", "referralVisits"),
}
const attributionSchema: ExportSchema = {
  ...fields("model", "segmentMembership"), segments: [distributionSchema], campaigns: [distributionSchema],
  coverage: fields("totalSessions", "attributedSessions", "unattributedSessions", "segmentedSessions", "campaignSessions"),
}
const activityRow: ExportSchema = {
  ...fields("kind", "action", "date", "segment", "title", "journeyStage", "status", "description", "campaign", "amount", "products", "source"),
  user: fields("name"), lead: fields("name"),
}
const filterSchema = fields("currency", "campaignId", "segmentId", "group", "startDate", "endDate", "timeZone", "includeCategories", "referrersLimit", "limit")

function distributionProjection(input: unknown) {
  const source = record(input)
  const data = Array.isArray(input) ? input : source.items ?? source.data ?? source.segments ?? source.campaigns
  return { value: { ...source, data }, schema: {
    data: [distributionSchema], ...fields("currency", "noData"),
    metadata: periodSchema,
    // Legacy envelopes include useful coverage and dates beside unsafe debug inputs.
    debug: fields("startDate", "endDate", "segmentsCount", "segmentsWithClientsCount", "segmentsWithRevenueCount",
      "campaignsCount", "campaignsWithClientsCount", "campaignsWithRevenueCount", "totalLeads", "totalSales", "totalRevenue", "segmentFilter"),
  } satisfies ExportSchema }
}

function projection(scope: ReportExportScope, resource: ReportExportResource, resources: ReportExportResource[]) {
  const { id, data } = resource
  let value = data
  let schema: ExportSchema
  if (id === "dashboard/performance") schema = performanceSchema(scope.section, scope.report === "overview")
  else if (id === "dashboard/overview") {
    schema = overviewSchema(scope.section)
    if (scope.section === "economics") value = economicsData(data)
  } else if (id === "revenue") schema = scope.report === "costs" ? costRevenueSchema : salesSchema(scope.section)
  else if (id === "costs") {
    schema = costSchema(scope.section)
    if (scope.section === "summary") value = costSummary(data, resources.find(item => item.id === "revenue")?.data, resource.filters?.campaignId)
    else value = costCategoriesData(data)
  } else if (id === "social-performance") {
    schema = socialSchema(scope.section)
    value = socialData(data)
  } else if (id === "social-commenters") {
    schema = commenterSchema
    value = Array.isArray(data) ? data : record(data).data
  } else if (id === "cohorts" || id === "leads-cohorts") schema = {
    ...(id === "cohorts" ? { salesCohorts: [cohortRow], usageCohorts: [cohortRow] } : { leadCohorts: [cohortRow] }),
    metadata: cohortMetadata,
  } as ExportSchema
  else if (id === "recent-activity") {
    schema = [activityRow]
    value = Array.isArray(data) ? data : record(data).activities
  } else if (id === "traffic/session-events-combined") schema = sessionSchema
  else if (id === "traffic/attribution") {
    schema = attributionSchema
    const source = record(data)
    // The normalized hook omits this field; session-entry segments use current membership in the UI.
    value = { ...source, segmentMembership: source.model === "session_entry" ? "current" : source.segmentMembership }
  }
  else if (["traffic/visits", "traffic/session-time", "traffic/lead-conversion", "traffic/client-conversion"].includes(id)) {
    schema = { ...metricSchema, actualUnit: true, percentChangeUnit: true }
    value = { ...record(data), actualUnit: id === "traffic/visits" ? "sessions"
      : id === "traffic/session-time" ? "seconds" : "percent", percentChangeUnit: "percent" }
  }
  else return distributionProjection(data)
  return { value, schema }
}

function basis(scope: ReportExportScope, id: string): string {
  if (id === "social-commenters") return "Synchronized inbound comment authors by message creation date; not accumulated provider comments. All segments."
  if (id === "social-performance") return "Latest accumulated stored metrics for posts published in the selected period; undated posts excluded. Reach is not deduplicated. All segments."
  if (id === "recent-activity") return "Latest loaded commercial records across all segments; amounts are source-formatted display strings, not raw monetary values."
  if (id === "traffic/session-time") return "Average session duration in seconds; source caps each session at one hour. All segments."
  if (id === "traffic/lead-conversion") return "Visitor-to-lead conversion percentage, not a fractional ratio. All segments."
  if (id === "traffic/client-conversion") return "Lead-to-client conversion percentage, not a fractional ratio. All segments."
  if (id === "traffic/attribution") return "Session-entry attribution across all segments. Segments use current lead or visitor membership, not historical membership. Campaigns use session-entry UTM tags; unassigned sessions are included."
  if (id === "costs") return "Recorded costs; no currency conversion. Monthly data is the source six-month context, not restricted to the selected window. Efficiency uses active sales, not cash."
  if (id === "revenue") return "Active pending and completed sales by sale date, excluding cancelled/refunded sales and sales with a cancelled linked order. Cash uses UTC movement dates; outstanding balances are current."
  if (scope.report === "analytics" && scope.section === "distribution") return "Lead attribution and recorded sale amounts by creation date, including all sale statuses; not paid revenue. Currency only when supplied."
  if (id.startsWith("traffic/")) return "Loaded traffic observations across all segments. Distribution shares use displayed results; session entry attribution is not event-level attribution."
  if (scope.report === "performance" && scope.section === "usage") return "Recorded token, image and video usage; not monetary cost."
  if (id === "dashboard/performance") return "Independent daily activity counts in UTC, not a sequential funnel. Recorded sales include all statuses; not revenue."
  if (scope.section === "economics") return "Reported snapshots, not historical series. Nullable economics values use the same frontend helper and currency/baseline checks as the report."
  if (scope.report === "overview") return "Active sales and commercial activity; active segment counts cover the entire site. See source metadata for revenue basis and dates."
  return "Observed selected-window cohorts. Null weeks are unobserved or incomplete, not zero retention. See source metadata for definitions."
}

/** Exports only current registered payloads. It never fetches, invents history, or exposes user IDs. */
export function reportExportRows(scope: ReportExportScope, resources: ReportExportResource[]): ReportExportRow[] {
  return expectedReportResources(scope.report, scope.section).flatMap(id => {
    const resource = resources.find(item => item.id === id)
    if (!resource || resource.data == null) return projectRows(id, resource?.data, true)
    const { value, schema } = projection(scope, resource, resources)
    return [
      ...projectRows(id, { basis: basis(scope, id) }, fields("basis")),
      ...projectRows(id, value, schema),
      ...(resource.filters ? projectRows(id, { filters: resource.filters }, { filters: filterSchema }) : []),
    ]
  })
}