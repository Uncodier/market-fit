export const PERFORMANCE_GROUPS = {
  outcomes: ["leads-contacted", "leads-in-conversation", "meetings", "sales", "metrics-overview"],
  operations: ["tasks", "conversations", "contents-approved", "requirements-completed", "metrics-overview"],
  usage: ["tokens", "video-minutes", "images-generated"],
} as const

export const OVERVIEW_GROUPS = {
  summary: ["revenue", "active-users", "active-segments", "active-campaigns"],
  economics: ["ltv", "cac", "roi", "cpl"],
  activity: [],
} as const

export type PerformanceGroup = keyof typeof PERFORMANCE_GROUPS
export type OverviewGroup = keyof typeof OVERVIEW_GROUPS
export type ReportBatchKind = "performance" | "overview"
export type ReportBatch = Record<string, Record<string, unknown>>

export function reportMetricKeys(kind: ReportBatchKind, group?: string): readonly string[] | null {
  const groups = kind === "performance" ? PERFORMANCE_GROUPS : OVERVIEW_GROUPS
  if (group === undefined) return [...new Set(Object.values(groups).flat())]
  if (!Object.prototype.hasOwnProperty.call(groups, group)) return null
  return (groups as Record<string, readonly string[]>)[group]
}

export function isMetricPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    !("error" in value && value.error != null)
}

export function isReportBatch(value: unknown, keys: readonly string[]): value is ReportBatch {
  return isMetricPayload(value) && keys.every(key => isMetricPayload(value[key]))
}

export function reportCurrencyOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.length || value.length > 200 ||
      !value.every(currency => typeof currency === "string" && /^(?:[A-Z]{3}|UNSPECIFIED)$/.test(currency))) {
    return undefined
  }
  return [...new Set(value)]
}