import { buildAttribution, buildReferrals } from "@/lib/traffic/attribution"
import { buildBreakdown } from "@/lib/traffic/breakdowns"
import { isExternalReferralPageview } from "@/lib/traffic/external-referral-pageview"
import type { TrafficSession, TrafficSegment } from "@/lib/traffic/types"
import { shiftDay } from "@/lib/sales/report-period"
import { isKnownDemoSite } from "./index"
import { demoMetric, demoReportContext, type DemoReportContext, type DemoRow } from "./report-context"

const text = (value: unknown) => typeof value === "string" ? value : undefined
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0

function linkedSessions(context: DemoReportContext, previous = false): TrafficSession[] {
  const segments = new Map(context.rows("segments").map(row => [row.id, {
    id: row.id, site_id: context.siteId, name: row.name || "",
  } satisfies TrafficSegment]))
  const visitors = new Map(context.rows("visitors").map(row => [row.id, row]))
  return context.rows("visitor_sessions").filter(row => context.inRange(row.created_at, previous)).map(row => {
    const lead = context.leadMap.get(row.lead_id || "")
    const visitor = visitors.get(text(row.visitor_id) || "")
    return {
      ...row, referrer: text(row.referrer), landing_url: text(row.landing_url), current_url: text(row.current_url),
      utm_source: text(row.utm_source), utm_medium: text(row.utm_medium), utm_campaign: text(row.utm_campaign),
      lead: lead ? { site_id: context.siteId, segment: segments.get(lead.segment_id || "") } : null,
      visitor: visitor ? { segment: segments.get(visitor.segment_id || "") } : null,
    }
  })
}

function metricValue(context: DemoReportContext, endpoint: string, previous = false) {
  const sessions = context.rows("visitor_sessions").filter(row => context.inRange(row.created_at, previous))
  if (endpoint === "visits") return sessions.length
  if (endpoint === "session-time") {
    const measured = sessions.filter(row => row.last_activity_at != null)
    const total = measured.reduce((sum, row) => sum + Math.min(3600, number(row.duration) > 0
      ? number(row.duration) : Math.max(0, (number(row.last_activity_at) - number(row.started_at)) / 1000)), 0)
    return measured.length ? Math.round(total / measured.length) : 0
  }
  if (endpoint === "lead-conversion") {
    const visitors = new Set(sessions.map(row => text(row.visitor_id)).filter(Boolean))
    const leads = new Set(sessions.filter(row => row.lead_id && context.leadMap.has(row.lead_id))
      .map(row => text(row.visitor_id)).filter(Boolean))
    return visitors.size ? Math.round(leads.size / visitors.size * 1000) / 10 : 0
  }
  const leads = context.rows("leads").filter(row => context.inRange(row.created_at, previous))
  const sold = new Set(context.rows("sales").map(row => row.lead_id).filter(Boolean))
  return leads.length ? Math.round(leads.filter(row => sold.has(row.id)).length / leads.length * 1000) / 10 : 0
}

/** Events use their own dates and count only pageviews, not session-entry observations. */
export function buildDemoSessionEvents(context: DemoReportContext, limit = 10) {
  const domains = new Set(["localhost", "127.0.0.1", "0.0.0.0"])
  const addDomain = (value: unknown) => {
    try {
      const host = new URL(String(value).includes("://") ? String(value) : `https://${value}`).hostname.toLowerCase().replace(/^www\./, "")
      domains.add(host)
      domains.add(`www.${host}`)
    } catch { /* Invalid fixture URLs do not establish exclusions. */ }
  }
  addDomain(context.data.sites?.[0]?.url)
  context.rows("allowed_domains").forEach(row => addDomain(row.domain))
  const events = context.rows("session_events").filter(row => row.event_type === "pageview" && context.inRange(row.created_at))
  const byDay = new Map<string, DemoRow[]>()
  for (const event of events) {
    const day = event.created_at.slice(0, 10)
    byDay.set(day, [...(byDay.get(day) || []), event])
  }
  const unique = (rows: DemoRow[]) => new Set(rows.map(row => text(row.visitor_id)).filter(Boolean)).size
  const external = (row: DemoRow) => isExternalReferralPageview(text(row.referrer), domains)
  const chartData = Array.from({ length: context.period.days }, (_, index) => {
    const date = shiftDay(context.period.start, index)
    const rows = byDay.get(date) || []
    return { date, label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      pageVisits: rows.length, uniqueVisitors: unique(rows), referralVisits: rows.filter(external).length }
  })
  const counts = new Map<string, { count: number; fullUrl: string }>()
  for (const event of events) {
    const referrer = text(event.referrer)?.trim() || ""
    if (referrer && !external(event)) continue
    let label = referrer || "Direct"
    try { label = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "") } catch { /* Preserve legacy non-URL labels. */ }
    const value = counts.get(label) || { count: 0, fullUrl: referrer }
    value.count++
    counts.set(label, value)
  }
  const validEvents = Array.from(counts.values()).reduce((sum, row) => sum + row.count, 0)
  const referrersData = Array.from(counts, ([referrer, value]) => ({ referrer, ...value,
    percentage: validEvents ? (value.count / validEvents * 100).toFixed(1) : "0.0" }))
    .sort((a, b) => b.count - a.count || a.referrer.localeCompare(b.referrer)).slice(0, limit)
  return { chartData, referrersData, totals: {
    pageVisits: events.length, uniqueVisitors: unique(events), referralVisits: events.filter(external).length,
  }, period: { startDate: context.period.start, endDate: context.period.end, daysBack: context.period.days } }
}

/** Only explicit registered demo IDs can resolve reports locally. No API requests are made. */
export async function loadDemoTrafficReport(endpoint: string, params: URLSearchParams): Promise<unknown | null> {
  if (!isKnownDemoSite(params.get("siteId"))) return null
  const name = endpoint.replace(/^\/api\//, "").replace(/^\//, "")
  const kind = name.replace(/^traffic\//, "")
  const metrics = ["visits", "session-time", "lead-conversion", "client-conversion"]
  const breakdowns = ["pages", "devices", "browsers", "regions"] as const
  const aliases = ["traffic-by-segment", "traffic-by-campaign"]
  const distributionAlias = ["segments/distribution", "campaigns/distribution"].includes(name) && params.get("metric") === "sessions"
  if (!(name.startsWith("traffic/") && [...metrics, ...breakdowns, "referrals", "attribution",
    "session-events", "session-events-combined", "session-events-referrers"].includes(kind)) && !aliases.includes(name) && !distributionAlias) return null
  if (params.get("segmentId") && params.get("segmentId") !== "all") {
    throw new Error("Segment filtering is not available for this report. Select all segments.")
  }
  const context = await demoReportContext(params)
  if (metrics.includes(kind)) return demoMetric(metricValue(context, kind), metricValue(context, kind, true))
  if (kind.startsWith("session-events")) {
    const rawLimit = params.get(kind === "session-events-referrers" ? "limit" : "referrersLimit") || "10"
    const limit = Number(rawLimit)
    if (!/^\d+$/.test(rawLimit) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid referrer limit")
    const report = buildDemoSessionEvents(context, limit)
    if (kind === "session-events-referrers") return { data: report.referrersData.map(row => ({ ...row, percentage: Number(row.percentage) })) }
    if (kind === "session-events") return { data: report.chartData.filter(row => row.pageVisits > 0)
      .map(row => ({ date: row.date, events: row.pageVisits, label: row.label })) }
    return report
  }
  const sessions = linkedSessions(context)
  if (aliases.includes(name) || distributionAlias || kind === "attribution") {
    const report = buildAttribution(sessions, context.siteId)
    return kind === "attribution" ? report : { data: name === "traffic-by-segment" || name === "segments/distribution" ? report.segments : report.campaigns }
  }
  if (kind === "referrals") return { data: buildReferrals(sessions) }
  return { data: buildBreakdown(sessions, kind as typeof breakdowns[number]) }
}