import { format } from "date-fns"
import type { SalesChannelAmounts, SalesDailyTrendPoint, SalesTrendCoverage } from "@/lib/sales/report-types"

export type LegacySalesTrendPoint = Pick<SalesChannelAmounts, "onlineSales" | "retailSales"> & {
  month: string
  otherSales?: number
  totalSales?: number
}
export type SalesTrendInput = {
  data: LegacySalesTrendPoint[]
  dailyData?: SalesDailyTrendPoint[]
  startDate?: Date | string
  endDate?: Date | string
  coverage?: SalesTrendCoverage
}
export type SalesTrendBucket = {
  date: string
  endDate: string
  label: string
  onlineSales: number | null
  retailSales: number | null
  otherSales: number | null
  totalSales: number | null
}
export type SalesTrend = {
  points: SalesTrendBucket[]
  granularity: "daily" | "weekly" | "monthly"
  startDate?: string
  endDate?: string
  legacy: boolean
  hasGaps: boolean
}

const DAY_MS = 86_400_000
const keys = ["onlineSales", "retailSales", "otherSales", "totalSales"] as const
const zero = (): SalesChannelAmounts => ({ onlineSales: 0, retailSales: 0, otherSales: 0, totalSales: 0 })
const missing = () => ({ onlineSales: null, retailSales: null, otherSales: null, totalSales: null })

/** Date picker values use local calendar labels, just like the report request. */
export function salesTrendDay(value?: Date | string): string | undefined {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? format(value, "yyyy-MM-dd") : undefined
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return undefined
  const day = value.slice(0, 10)
  const parsed = new Date(`${day}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : undefined
}

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS
const dayLabel = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10)
const lastMonthDay = (day: string) => {
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return dayLabel(date.getTime() / DAY_MS - 1)
}

function amounts(point: LegacySalesTrendPoint | SalesDailyTrendPoint): SalesChannelAmounts | null {
  const values = "date" in point ? point : { ...point, otherSales: point.otherSales ?? 0,
    totalSales: point.totalSales ?? point.onlineSales + point.retailSales + (point.otherSales ?? 0) }
  return keys.every(key => typeof values[key] === "number" && Number.isFinite(values[key])) ? values : null
}

export function formatSalesTrendDate(day: string, withYear = true): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(`${day}T00:00:00Z`))
}

export function salesTrendRange(start?: string, end?: string): string {
  if (!start || !end) return "Available data"
  return start === end ? formatSalesTrendDate(start) : `${formatSalesTrendDate(start)} – ${formatSalesTrendDate(end)}`
}

function axisLabel(day: string, monthly: boolean, includeYear: boolean) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", month: "short", ...(monthly ? {} : { day: "numeric" }),
    ...(includeYear ? { year: "2-digit" } : {}),
  }).format(new Date(`${day}T00:00:00Z`))
}

/** Explicit bounds win; absent bounds are inferred from the actual series, never today's year. */
export function buildSalesTrend(input: SalesTrendInput): SalesTrend {
  const legacy = input.dailyData === undefined
  const empty: SalesTrend = { points: [], granularity: legacy ? "monthly" : "daily", legacy, hasGaps: false }
  const explicitStart = salesTrendDay(input.startDate)
  const explicitEnd = salesTrendDay(input.endDate)
  if ((input.startDate !== undefined && !explicitStart) || (input.endDate !== undefined && !explicitEnd)) return empty
  const dates = (legacy ? input.data.map(point => /^\d{4}-\d{2}$/.test(point.month) ? `${point.month}-01` : "")
    : input.dailyData!.map(point => point.date)).map(salesTrendDay).filter((day): day is string => !!day).sort()
  const coverageStart = salesTrendDay(input.coverage?.startDate)
  const coverageEnd = salesTrendDay(input.coverage?.endDate)
  const start = explicitStart ?? coverageStart ?? dates[0]
  const finalDate = dates[dates.length - 1]
  const end = explicitEnd ?? coverageEnd ?? (legacy && finalDate ? lastMonthDay(finalDate) : finalDate)
  if (!start || !end) {
    // Undated legacy labels remain displayable only without an explicit date selection.
    if (legacy && !input.startDate && !input.endDate) return { ...empty, points: input.data.map(point => ({
      date: point.month, endDate: point.month, label: point.month, ...(amounts(point) ?? missing()),
    })) }
    return empty
  }
  if (start > end) return empty
  if (legacy) return monthlyTrend(input.data, start, end)
  return dailyTrend(input.dailyData!, start, end, input.coverage)
}

function monthlyTrend(data: LegacySalesTrendPoint[], start: string, end: string): SalesTrend {
  const byMonth = new Map(data.map(point => [point.month, amounts(point)]))
  const points: SalesTrendBucket[] = []
  for (let date = start; date <= end;) {
    const monthEnd = lastMonthDay(date)
    points.push({ date, endDate: monthEnd < end ? monthEnd : end,
      label: axisLabel(date, true, true), ...(byMonth.get(date.slice(0, 7)) ?? missing()) })
    date = dayLabel(dayNumber(monthEnd) + 1)
  }
  return { points, startDate: start, endDate: end, granularity: "monthly", legacy: true,
    hasGaps: points.some(point => point.totalSales === null) }
}

function dailyTrend(data: SalesDailyTrendPoint[], start: string, end: string, coverage?: SalesTrendCoverage): SalesTrend {
  const startDay = dayNumber(start)
  const endDay = dayNumber(end)
  const days = endDay - startDay + 1
  const granularity = days <= 45 ? "daily" : days <= 180 ? "weekly" : "monthly"
  const coverageStart = salesTrendDay(coverage?.startDate)
  const coverageEnd = salesTrendDay(coverage?.endDate)
  const complete = coverage?.complete === true && !!coverageStart && !!coverageEnd && coverageStart <= coverageEnd
  const coveredStart = complete ? dayNumber(coverageStart!) : Infinity
  const coveredEnd = complete ? dayNumber(coverageEnd!) : -Infinity
  const buckets: Array<{ point: SalesTrendBucket; first: number; last: number; known: Set<number>; invalid: boolean }> = []
  const index = new Map<string, number>()
  for (let day = startDay; day <= endDay;) {
    const date = dayLabel(day)
    const last = Math.min(endDay, granularity === "monthly" ? dayNumber(lastMonthDay(date)) : day + (granularity === "weekly" ? 6 : 0))
    index.set(granularity === "monthly" ? date.slice(0, 7) : date, buckets.length)
    buckets.push({ first: day, last, known: new Set(), invalid: false, point: {
      date, endDate: dayLabel(last), label: axisLabel(date, granularity === "monthly", granularity === "monthly" || start.slice(0, 4) !== end.slice(0, 4)), ...zero(),
    } })
    day = last + 1
  }
  for (const row of data) {
    const date = salesTrendDay(row.date)
    if (!date || date < start || date > end) continue
    const day = dayNumber(date)
    const bucket = buckets[granularity === "monthly" ? index.get(date.slice(0, 7))! : Math.floor((day - startDay) / (granularity === "weekly" ? 7 : 1))]
    const value = amounts(row)
    if (!value || bucket.known.has(day)) {
      // A duplicate daily aggregate or malformed amount cannot establish a complete bucket.
      bucket.invalid = true
      continue
    }
    bucket.known.add(day)
    for (const key of keys) bucket.point[key]! += value[key]
  }
  const points = buckets.map(({ point, first, last, known, invalid }) => {
    const coveredDays = Math.max(0, Math.min(last, coveredEnd) - Math.max(first, coveredStart) + 1)
    const observedOutside = [...known].filter(day => day < coveredStart || day > coveredEnd).length
    return invalid || coveredDays + observedOutside < last - first + 1 ? { ...point, ...missing() } : point
  })
  return { points, startDate: start, endDate: end, granularity, legacy: false,
    hasGaps: points.some(point => point.totalSales === null) }
}