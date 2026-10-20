import { cohortBaselines, retentionRows } from "@/app/api/cohorts/lib/retention"
import type { CohortEvent, CohortMetadata, CohortScope } from "@/app/api/cohorts/lib/types"
import { isKnownDemoSite } from "./index"
import { demoReportContext, type DemoReportContext } from "./report-context"

const DISTRIBUTIONS = new Set(["clients-by-segment", "clients-by-campaign", "revenue-by-segment", "revenue-by-campaign"])
type CohortKind = "customers" | "leads"

/** Local report selection is limited to registered fixtures, never a real site's data. */
export async function loadDemoAnalyticsDistribution(endpoint: string, params: URLSearchParams): Promise<object | null> {
  if (!DISTRIBUTIONS.has(endpoint) || !isKnownDemoSite(params.get("siteId"))) return null
  const context = await demoReportContext(params)
  const campaign = endpoint.endsWith("campaign")
  const revenue = endpoint.startsWith("revenue")
  const dimension = campaign ? "campaign_id" : "segment_id"
  const names = new Map(context.rows(campaign ? "campaigns" : "segments")
    .map(row => [row.id, (campaign ? row.title : row.name) || `Unnamed ${campaign ? "campaign" : "segment"}`]))
  const sales = context.rows("sales").filter(row => context.inRange(row.created_at) &&
    (context.segmentId === "all" || row.segment_id === context.segmentId))
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  const counts = new Map<string, number>()
  const add = (id: string | undefined, value: number) => counts.set(id || "", (counts.get(id || "") || 0) + value)
  if (revenue) {
    for (const sale of sales) {
      const amount = Number(sale.amount)
      if ((sale.currency || "USD") === context.currency && Number.isFinite(amount) && amount > 0) add(sale[dimension], amount)
    }
  } else {
    const membership = new Map<string, string | undefined>()
    for (const lead of context.scoped("leads").filter(row => context.inRange(row.created_at))) membership.set(lead.id, lead[dimension])
    for (const sale of sales) {
      if (!sale.lead_id) continue
      // Segment reports prefer the sale's recorded segment. Campaign reports count a lead once.
      if (!membership.has(sale.lead_id) || (!campaign && sale.segment_id)) {
        membership.set(sale.lead_id, sale[dimension] || context.leadMap.get(sale.lead_id)?.[dimension])
      }
    }
    for (const id of membership.values()) add(id, 1)
  }
  const rows = [...counts].filter(([, value]) => value > 0).map(([id, value]) => ({
    name: id ? names.get(id) || `Unknown ${campaign ? "campaign" : "segment"}` : `Unassigned ${campaign ? "campaign" : "segment"}`,
    value: Math.round(value * 100) / 100,
  })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  return { [campaign ? "campaigns" : "segments"]: rows, ...(revenue ? { currency: context.currency } : {}) }
}

function cohortScope(context: DemoReportContext, params: URLSearchParams): CohortScope {
  const start = params.get("startDate") || context.period.start
  const end = params.get("endDate") || context.period.end
  const startDate = new Date(start).toISOString()
  const endDate = new Date(/^\d{4}-\d{2}-\d{2}$/.test(end) ? `${end}T23:59:59.999Z` : end).toISOString()
  return {
    siteId: context.siteId, segmentId: context.segmentId, startDate, endDate,
    observationEnd: new Date(Math.min(Date.parse(endDate), Date.now())).toISOString(),
  }
}

function recordedActivity(context: DemoReportContext, baseline: CohortEvent[]): CohortEvent[] {
  const members = new Set(baseline.map(event => event.leadId))
  const conversations = new Map(context.rows("conversations").map(row => [row.id, row]))
  const seen = new Set<string>()
  const events: CohortEvent[] = []
  // Messages have no site_id in the real schema: tenancy and membership come from conversations.
  for (const message of context.data.messages || []) {
    const conversation = conversations.get(message.conversation_id || "")
    const leadId = conversation?.lead_id
    if (seen.has(message.id) || !leadId || !members.has(leadId) ||
      (message.role !== "user" && message.role !== "visitor") ||
      (message.lead_id && message.lead_id !== leadId)) continue
    seen.add(message.id)
    events.push({ leadId, at: message.created_at })
  }
  return events
}

/** The existing pure builders preserve week-zero membership and incomplete-week nulls. */
export async function loadDemoCohortReport(kind: CohortKind, params: URLSearchParams) {
  if (!isKnownDemoSite(params.get("siteId"))) return null
  if (kind !== "customers" && kind !== "leads") throw new Error("Unknown demo cohort report")
  const context = await demoReportContext(params)
  const scope = cohortScope(context, params)
  const sales = context.rows("sales").filter(row => (row.status === "pending" || row.status === "completed") &&
    (context.segmentId === "all" || row.segment_id === context.segmentId) &&
    Date.parse(row.created_at) >= Date.parse(scope.startDate) && Date.parse(row.created_at) <= Date.parse(scope.observationEnd))
  const events = kind === "customers"
    ? sales.filter(row => row.lead_id).map(row => ({ leadId: row.lead_id!, at: row.created_at }))
    : context.scoped("leads").map(row => ({ leadId: row.id, at: row.created_at }))
  const baseline = cohortBaselines(events, scope)
  const activity = recordedActivity(context, baseline)
  const activityDefinition = "Share of sample cohort leads with recorded user or visitor messages in lead-linked conversations during each subsequent complete UTC week; not website usage."
  const metadata: CohortMetadata = {
    ...scope, weekStartsOn: "Monday", observationPolicy: "complete-weeks-only", activityAvailable: true,
    activityDefinition,
    definition: kind === "customers"
      ? "Each identified sample lead enters once at its first observed confirmed sale (pending or completed, using sales.created_at) within the selected window and sales segment. Retention measures another confirmed sale, not lifetime-first purchase or cash receipts."
      : "Sample leads created within the selected window, grouped by leads.created_at and filtered by their current segment. Retention measures recorded inbound messages, not continued presence in the database.",
  }
  return kind === "customers" ? {
    salesCohorts: retentionRows(baseline, events, scope), usageCohorts: retentionRows(baseline, activity, scope),
    metadata: { ...metadata, usageDefinition: activityDefinition, excludedAnonymousSales: sales.filter(row => !row.lead_id).length },
  } : { leadCohorts: retentionRows(baseline, activity, scope), metadata }
}