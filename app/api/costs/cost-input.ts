const DAY_MS = 86_400_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/
export const MAX_COST_PERIOD_DAYS = 366

export class CostReportError extends Error {
  constructor(message: string, readonly status = 500, readonly availableCurrencies?: string[]) { super(message) }
}

function singleParam(params: URLSearchParams, name: string): string | null {
  if (params.getAll(name).length > 1) throw new CostReportError(`Duplicate ${name}`, 400)
  return params.get(name)
}

function filterId(value: string | null, name: string): string {
  if (value === null || value === "all") return "all"
  if (!UUID.test(value)) throw new CostReportError(`Invalid ${name}`, 400)
  return value.toLowerCase()
}

/** Date columns use the supplied calendar day, including for legacy ISO inputs. */
function calendarDay(value: string): string {
  if (!ISO_DAY.test(value) && !ISO_TIMESTAMP.test(value)) {
    throw new CostReportError("Invalid date range", 400)
  }
  const day = value.slice(0, 10)
  const parsed = new Date(`${day}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day ||
      !Number.isFinite(Date.parse(value))) {
    throw new CostReportError("Invalid date range", 400)
  }
  return day
}

export function shiftCostDay(day: string, days: number): string {
  const shifted = new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString()
  if (!/^\d{4}-/.test(shifted)) throw new CostReportError("Invalid date range", 400)
  return shifted.slice(0, 10)
}

export function costReportInput(params: URLSearchParams, now = new Date()) {
  const siteId = singleParam(params, "siteId")
  if (!siteId || !UUID.test(siteId)) throw new CostReportError("A valid site ID is required", 400)
  const segmentId = filterId(singleParam(params, "segmentId"), "segment ID")
  const campaignId = filterId(singleParam(params, "campaignId"), "campaign ID")
  const currency = singleParam(params, "currency")
  if (currency !== null && currency !== "UNSPECIFIED" && !/^[A-Z]{3}$/.test(currency)) {
    throw new CostReportError("Invalid currency. Use an uppercase currency code or UNSPECIFIED.", 400)
  }
  const end = calendarDay(singleParam(params, "endDate") ?? now.toISOString())
  const start = calendarDay(singleParam(params, "startDate") ?? shiftCostDay(end, -30))
  const days = (Date.parse(end) - Date.parse(start)) / DAY_MS + 1
  if (days < 1) throw new CostReportError("Start date must not be after end date", 400)
  if (days > MAX_COST_PERIOD_DAYS) {
    throw new CostReportError(`Date range cannot exceed ${MAX_COST_PERIOD_DAYS} days`, 400)
  }
  const monthlyDate = new Date(`${end.slice(0, 7)}-01T00:00:00Z`)
  monthlyDate.setUTCMonth(monthlyDate.getUTCMonth() - 5)
  const monthlyStart = calendarDay(monthlyDate.toISOString())
  const previousStart = shiftCostDay(start, -days)
  return {
    siteId: siteId.toLowerCase(), segmentId, campaignId, currency, start, end, days, monthlyStart,
    endExclusive: shiftCostDay(end, 1),
    previousStart,
    previousEnd: shiftCostDay(start, -1),
    queryStart: previousStart < monthlyStart ? previousStart : monthlyStart,
  }
}

export type CostReportInput = ReturnType<typeof costReportInput>