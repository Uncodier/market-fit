import { CohortInputError, type CohortScope } from "./types"

export const DAY_MS = 86_400_000
export const WEEK_MS = 7 * DAY_MS
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function dateValue(value: string, end: boolean): Date {
  const day = value.slice(0, 10)
  const midnight = new Date(`${day}T00:00:00.000Z`)
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const timestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
  const parsed = new Date(value)
  if ((!dayOnly && !timestamp) || !Number.isFinite(parsed.getTime()) ||
      !Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== day) {
    throw new CohortInputError("Invalid date range")
  }
  return dayOnly && end ? new Date(parsed.getTime() + DAY_MS - 1) : parsed
}

/** Date-only boundaries include that entire UTC day; timestamps remain exact. */
export function prepareCohortRequest(request: Request, now = new Date()) {
  const url = new URL(request.url)
  const params = url.searchParams
  for (const key of ["siteId", "segmentId", "startDate", "endDate"]) {
    if (params.getAll(key).length > 1) throw new CohortInputError(`Duplicate ${key}`)
  }
  const siteId = params.get("siteId")
  const segmentId = params.get("segmentId") ?? "all"
  if (!siteId || !UUID.test(siteId)) throw new CohortInputError("Invalid site ID")
  if (segmentId !== "all" && !UUID.test(segmentId)) throw new CohortInputError("Invalid segment ID")
  const end = dateValue(params.get("endDate") ?? now.toISOString(), true)
  const start = dateValue(params.get("startDate") ?? new Date(end.getTime() - 30 * DAY_MS).toISOString(), false)
  const duration = end.getTime() - start.getTime()
  if (duration < 0) throw new CohortInputError("Invalid date range")
  if (duration > 93 * DAY_MS) throw new CohortInputError("Date range cannot exceed 93 days")
  const scope: CohortScope = {
    siteId, segmentId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    observationEnd: new Date(Math.min(end.getTime(), now.getTime())).toISOString(),
  }
  params.set("startDate", scope.startDate)
  params.set("endDate", scope.endDate)
  params.set("segmentId", segmentId)
  return { request: new Request(url, { headers: request.headers }), scope }
}

export function mondayUtc(value: string | number): number {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return date.getTime()
}

export function isoWeekLabel(monday: number): string {
  const year = new Date(monday + 3 * DAY_MS).getUTCFullYear()
  const firstMonday = mondayUtc(`${year}-01-04T00:00:00.000Z`)
  return `W${String(1 + Math.round((monday - firstMonday) / WEEK_MS)).padStart(2, "0")} ${year}`
}