import { endOfDay, startOfDay, subDays } from "date-fns"

export interface ReportPeriod {
  startDate: Date
  endDate: Date
}

export function reportPeriod(startDate?: Date, endDate?: Date, today = new Date()): ReportPeriod | null {
  const start = startOfDay(startDate ?? subDays(today, 30))
  const end = endOfDay(endDate ?? today)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return null
  return { startDate: start, endDate: end }
}

export function reportQueryKey({
  endpoint, userId, siteId, segmentId = "all", period, enabled = true,
}: {
  endpoint: string
  userId?: string
  siteId?: string
  segmentId?: string
  period: ReportPeriod | null
  enabled?: boolean
}): [string, string] | null {
  if (!enabled || !userId || !siteId || siteId === "default" || !period) return null
  const params = new URLSearchParams({
    siteId,
    segmentId,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
  })
  // Identity isolates the browser cache; authorization comes from the server session.
  return [`/api/${endpoint}?${params}`, userId]
}

export class ReportRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = "ReportRequestError"
  }
}

export async function fetchReport([url]: [string, string]): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) {
    const message = response.status === 401 ? "Sign in to view this report."
      : response.status === 403 ? "You do not have access to this report."
      : response.status === 429 ? "Too many report requests. Please try again shortly."
      : response.status === 422 ? "Segment filtering is not available for this report. Select all segments."
      : response.status === 400 ? "The report filters are invalid or the date range is too long."
      : "Unable to load this report. Please try again."
    throw new ReportRequestError(message, response.status)
  }
  try {
    return await response.json()
  } catch {
    throw new ReportRequestError("The report returned an invalid response.")
  }
}

export interface DistributionItem {
  name: string
  value: number
  color: string
}

const colors = ["#6366f1", "#0d9488", "#d97706", "#db2777", "#0284c7", "#7c3aed", "#65a30d", "#dc2626"]

export function distributionData(payload: unknown): DistributionItem[] {
  if (!payload || typeof payload !== "object" || "error" in payload) {
    throw new ReportRequestError("The report returned an invalid response.")
  }
  const body = payload as Record<string, unknown>
  const rows = body.data ?? body.segments ?? body.campaigns
  if (!Array.isArray(rows)) throw new ReportRequestError("The report returned an invalid response.")
  return rows.map((row, index) => {
    const value = typeof row?.value === "string" && row.value.trim() ? Number(row.value) : row?.value
    if (typeof row?.name !== "string" || !row.name.trim() || typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new ReportRequestError("The report returned an invalid response.")
    }
    return { name: row.name, value, color: colors[index % colors.length] }
  })
}

export function distributionTotal(data: DistributionItem[]): number {
  return data.reduce((sum, item) => sum + item.value, 0)
}

export function distributionCurrency(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const currency = (payload as { currency?: unknown }).currency
  return typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : undefined
}

export function formatDistributionValue(value: number, currency?: string): string {
  return new Intl.NumberFormat("en-US", currency
    ? { style: "currency", currency, maximumFractionDigits: 2 }
    : { maximumFractionDigits: 2 }).format(value)
}