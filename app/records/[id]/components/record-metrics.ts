import type { RecordItem } from "../../actions"
import type { InsightsTabProps } from "./insights-types"

/** Empty, invalid and non-finite values are not measurements of zero. */
export function metricNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null
  if (typeof value === "string" && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const isMetricNumber = (value: number | null): value is number => value !== null

export function metricDate(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null
  const day = value.slice(0, 10)
  const utc = Date.parse(`${day}T00:00:00Z`)
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== day) return null
  // Date-only measurements use local midnight to avoid shifting their calendar day.
  const date = Date.parse(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isFinite(date) ? date : null
}

export function savedMetricRecords(
  history: RecordItem[], record: InsightsTabProps["record"], relationName: string | null, relationId: unknown,
): RecordItem[] {
  const records = new Map(history.filter(item => item.site_id === record?.site_id
    && item.category_id === record?.category_id).map(item => [item.id, item]))
  // The saved record is a snapshot, never an overlay of unsaved form values.
  if (record?.id && record.data && record.created_at && record.site_id && record.category_id
    && (!relationName || record.relations?.[relationName] === relationId)) {
    records.set(record.id, record as RecordItem)
  }
  return [...records.values()]
}

export function resolveInsightDate(record: Pick<RecordItem, "data" | "created_at">, dateField?: string, fallback = false) {
  const fieldDate = dateField ? metricDate(record.data[dateField]) : null
  if (fieldDate !== null) return { timestamp: fieldDate, usedFallback: false }
  const timestamp = (!dateField || fallback) ? metricDate(record.created_at) : null
  return { timestamp, usedFallback: !!dateField && timestamp !== null }
}

export function metricSeries(records: RecordItem[], metric: string, dateField?: string, fallback = false) {
  let fallbackDates = 0
  const points = records.flatMap(record => {
    const { timestamp, usedFallback } = resolveInsightDate(record, dateField, fallback)
    if (usedFallback) fallbackDates++
    return timestamp === null ? [] : [{
      id: record.id, title: record.title || "Untitled record", timestamp,
      value: metricNumber(record.data[metric]),
    }]
  }).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))
  return { points, omittedDates: records.length - points.length, fallbackDates }
}

export function metricComparison(points: ReturnType<typeof metricSeries>["points"], recordId?: string) {
  const current = points.find(point => point.id === recordId)
  if (!current || current.value === null) return null
  const earlier = points.filter(point => point.timestamp < current.timestamp)
  const previousDate = earlier.at(-1)?.timestamp
  const candidates = earlier.filter(point => point.timestamp === previousDate)
  // Do not arbitrarily pick between duplicate periods or skip a missing observation.
  if (candidates.length !== 1 || candidates[0].value === null) return null
  const previous = candidates[0]
  const delta = current.value - previous.value!
  return Number.isFinite(delta) ? { previous, delta } : null
}

export function formatMetric(value: number | null) {
  return value === null ? "No data" : new Intl.NumberFormat(undefined, { maximumSignificantDigits: 10 }).format(value)
}