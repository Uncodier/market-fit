import { format, isValid } from "date-fns"
import type { ReportExportScope } from "./report-export-data"

export type ExportResourceKey = { id: string; requestKey: string; filters: Record<string, string> }

function calendarDate(value: string | null) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return isValid(date) ? format(date, "yyyy-MM-dd") : null
}

// Only mounted report resources enter the export. Never enumerate the SWR cache:
// it also contains previously visited sections, currencies and account scopes.
export function reportExportResourceKey(key: string | readonly unknown[] | null, scope: ReportExportScope): ExportResourceKey | null {
  if (!key || !scope.userId) return null
  const parts = Array.isArray(key) ? key : [key]
  const social = parts[0] === "social-performance" || parts[0] === "social-commenters"
  if (social) {
    const [id, siteId, start, end, timeZone, userId] = parts
    if (siteId !== scope.siteId || userId !== scope.userId || timeZone !== scope.timeZone ||
      typeof start !== "number" || typeof end !== "number" || !isValid(new Date(start)) || !isValid(new Date(end)) ||
      format(new Date(start), "yyyy-MM-dd") !== scope.startDate ||
      format(new Date(end), "yyyy-MM-dd") !== scope.endDate) return null
    return { id: String(id), requestKey: JSON.stringify(parts), filters: { segmentId: "all", timeZone: String(timeZone) } }
  }
  const path = parts.find((part): part is string => typeof part === "string" && part.startsWith("/api/"))
  if (!path || !parts.includes(scope.userId)) return null
  const url = new URL(path, "http://report.local")
  const id = url.pathname.slice("/api/".length)
  const params = url.searchParams
  const segmentId = params.get("segmentId") || "all"
  if (params.get("siteId") !== scope.siteId ||
    (id !== "recent-activity" && segmentId !== scope.segmentId) ||
    calendarDate(params.get("startDate")) !== scope.startDate ||
    calendarDate(params.get("endDate")) !== scope.endDate) return null
  return {
    id,
    requestKey: JSON.stringify(parts),
    filters: Object.fromEntries([
      ["segmentId", segmentId],
      ...["currency", "campaignId", "group", "limit", "referrersLimit"].flatMap(name => {
        const value = params.get(name)
        return value === null ? [] : [[name, value]]
      }),
    ]),
  }
}