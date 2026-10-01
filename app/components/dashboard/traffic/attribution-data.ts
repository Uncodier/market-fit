import { distributionData, distributionTotal, ReportRequestError, type DistributionItem } from "../report-query"

export interface AttributionCoverage {
  totalSessions: number
  attributedSessions: number
  unattributedSessions: number
  segmentedSessions: number
  campaignSessions: number
}

export interface TrafficAttributionData {
  model: "session_entry"
  segments: DistributionItem[]
  campaigns: DistributionItem[]
  coverage: AttributionCoverage
}

export function parseTrafficAttribution(payload: unknown): TrafficAttributionData {
  const invalid = () => new ReportRequestError("The attribution report returned an invalid response.")
  if (!payload || typeof payload !== "object" || "error" in payload) throw invalid()
  const body = payload as Record<string, unknown>
  if (body.model !== "session_entry" || !body.coverage || typeof body.coverage !== "object") throw invalid()
  const counts = body.coverage as Record<string, unknown>
  const keys = ["totalSessions", "attributedSessions", "unattributedSessions", "segmentedSessions", "campaignSessions"] as const
  for (const key of keys) {
    if (typeof counts[key] !== "number" || !Number.isSafeInteger(counts[key]) || counts[key] < 0) throw invalid()
  }
  const coverage = counts as unknown as AttributionCoverage
  if (coverage.attributedSessions + coverage.unattributedSessions !== coverage.totalSessions ||
    coverage.segmentedSessions > coverage.totalSessions || coverage.campaignSessions > coverage.totalSessions) throw invalid()
  const segments = distributionData({ data: body.segments })
  const campaigns = distributionData({ data: body.campaigns })
  for (const items of [segments, campaigns]) {
    if (items.some(item => !Number.isSafeInteger(item.value)) || distributionTotal(items) !== coverage.totalSessions) throw invalid()
  }
  return { model: "session_entry", segments, campaigns, coverage }
}