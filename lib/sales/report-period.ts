const DAY_MS = 86_400_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class SalesReportInputError extends Error {}

export function calendarDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) {
    throw new SalesReportInputError("Invalid date range")
  }
  const day = value.slice(0, 10)
  const parsed = new Date(`${day}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day ||
      !Number.isFinite(new Date(value).getTime())) {
    throw new SalesReportInputError("Invalid date range")
  }
  return day
}

export function shiftDay(day: string, days: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

/** Reports use inclusive calendar sale dates; missing sale dates use the UTC created date. */
export function salesReportPeriod(params: URLSearchParams, now = new Date()) {
  const end = calendarDay(params.get("endDate") ?? now.toISOString())
  const start = calendarDay(params.get("startDate") ?? shiftDay(end, -30))
  if (start > end) throw new SalesReportInputError("Start date must not be after end date")
  const days = Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1
  return {
    start, end, days,
    endExclusive: shiftDay(end, 1),
    previousStart: shiftDay(start, -days),
    previousEnd: shiftDay(start, -1),
  }
}

export function salesReportFilters(params: URLSearchParams) {
  const siteId = params.get("siteId")
  if (!siteId) throw new SalesReportInputError("Site ID is required")
  if (!UUID.test(siteId)) throw new SalesReportInputError("Invalid site ID")
  const segmentId = params.get("segmentId") || "all"
  if (segmentId !== "all" && !UUID.test(segmentId)) {
    throw new SalesReportInputError("Invalid segment ID")
  }
  const currency = params.get("currency")?.toUpperCase() || null
  if (currency && currency !== "UNSPECIFIED" && !/^[A-Z]{3}$/.test(currency)) {
    throw new SalesReportInputError("Invalid currency")
  }
  const include = params.get("includeCategories")
  if (include !== null && include !== "true" && include !== "false") {
    throw new SalesReportInputError("Invalid includeCategories option")
  }
  return { siteId, segmentId, currency, includeCategories: include !== "false" }
}

export type SalesReportPeriod = ReturnType<typeof salesReportPeriod>