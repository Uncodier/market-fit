import { format, isValid } from "date-fns"
import { ReportRequestError } from "../report-query"

export type SessionEventsData = {
  chartData: Array<{ date: string; label: string; pageVisits: number; uniqueVisitors: number; referralVisits?: number }>
  referrersData: Array<{ referrer: string; count: number; percentage: string; fullUrl: string }>
  totals: { pageVisits: number; uniqueVisitors: number; referralVisits?: number }
}

export function sessionEventsUrl(siteId: string, start: Date, end: Date, segmentId = "all") {
  if (!isValid(start) || !isValid(end) || start > end) return null
  const params = new URLSearchParams({ siteId, startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"), referrersLimit: "10" })
  if (segmentId !== "all") params.set("segmentId", segmentId)
  return `/api/traffic/session-events-combined?${params}`
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object"
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0
const counts = (value: unknown) => record(value) && count(value.pageVisits) && count(value.uniqueVisitors) &&
  (value.referralVisits === undefined || count(value.referralVisits))

export function parseSessionEvents(value: unknown): SessionEventsData {
  if (!record(value) || value.error || !counts(value.totals) ||
    !Array.isArray(value.chartData) || !value.chartData.every(row => record(row) && counts(row) &&
      typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && typeof row.label === "string") ||
    !Array.isArray(value.referrersData) || !value.referrersData.every(row => record(row) &&
      typeof row.referrer === "string" && count(row.count) && typeof row.fullUrl === "string" &&
      typeof row.percentage === "string" && row.percentage.trim() !== "" &&
      Number.isFinite(Number(row.percentage)) && Number(row.percentage) >= 0 && Number(row.percentage) <= 100)) {
    throw new ReportRequestError("The session events response was incomplete. Please try again.")
  }
  return value as SessionEventsData
}

export async function fetchSessionEvents([url]: [string, string]): Promise<SessionEventsData> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url).catch(() => {
      throw new ReportRequestError("Unable to connect to session events. Please try again.")
    })
    // A cache lock can return 503 while another tab computes the same report.
    // Honor only a bounded server-directed wait; never retry access errors.
    const retryAfter = response.headers?.get("Retry-After")
    const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null
    if (response.status === 503 && attempt < 3 && seconds !== null && seconds <= 10) {
      await new Promise(resolve => setTimeout(resolve, seconds * 1000))
      continue
    }
    if (!response.ok) {
      const message = response.status === 401 ? "Sign in to view session events."
        : response.status === 403 ? "You do not have access to these session events."
        : response.status === 400 ? "Select valid session filters and a shorter date range."
        : response.status === 422 ? "Too many session events. Select a shorter date range."
        : response.status === 429 ? "Too many report requests. Please try again shortly."
        : response.status === 503 ? "Session events are still being refreshed. Please retry shortly."
        : "Unable to load session events. Please try again."
      throw new ReportRequestError(message, response.status)
    }
    return parseSessionEvents(await response.json().catch(() => null))
  }
}