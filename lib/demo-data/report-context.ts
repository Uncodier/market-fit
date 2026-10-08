import { getDemoData, isKnownDemoSite } from "./index"
import { salesReportPeriod } from "@/lib/sales/report-period"
import { DEFAULT_ANALYTICS_RANGE_DAYS } from "@/lib/dashboard/report-date-limits"
import { salesPercentChange } from "@/lib/sales/report-format"
import type { DemoReportRow } from "./report-types"

export type DemoRow = DemoReportRow

export async function demoReportContext(params: URLSearchParams) {
  const siteId = params.get("siteId")
  if (!isKnownDemoSite(siteId)) throw new Error("Unknown demo site")
  const period = salesReportPeriod(params)
  if (period.days > DEFAULT_ANALYTICS_RANGE_DAYS) throw new Error("Demo report date range is too large")
  const data = await getDemoData(siteId)
  if (!data) throw new Error("Demo data is unavailable")
  const segmentId = params.get("segmentId") || "all"
  const rows = (table: string): DemoRow[] => (data[table] || []).filter((row: DemoRow) => row.site_id === siteId)
  const leads = rows("leads")
  const leadMap = new Map(leads.map(row => [row.id, row]))
  const scoped = (table: string): DemoRow[] => rows(table).filter(row => segmentId === "all" ||
    (row.segment_id || leadMap.get(row.lead_id || "")?.segment_id) === segmentId)
  const inRange = (value: string | undefined, previous = false) => {
    const day = value?.slice(0, 10) || ""
    return day >= (previous ? period.previousStart : period.start) && day <= (previous ? period.previousEnd : period.end)
  }
  const currency = params.get("currency") || data.catalog_items?.[0]?.currency || "USD"
  return { data, siteId, period, segmentId, rows, scoped, leadMap, inRange, currency }
}

export type DemoReportContext = Awaited<ReturnType<typeof demoReportContext>>

export function demoMetric(actual: number, previous: number) {
  const change = salesPercentChange(previous, actual)
  return { actual, previous, percentChange: change === null ? null : Math.round(change * 10) / 10, periodType: "custom" }
}