import { reportExportRows, type ReportExportResource, type ReportExportScope } from "./report-export-data"
import type { ExportScalar } from "./report-export-projection"

export const REPORT_EXPORT_COLUMNS = [
  "report", "section", "site_id", "site_name", "selected_start_date", "selected_end_date", "time_zone",
  "segment_id", "segment_name", "dataset", "row_path", "field", "value", "availability",
] as const

/** Quote every cell. Only strings are formula-escaped: negative numeric values stay numeric. */
export function reportExportCsvCell(value: ExportScalar): string {
  const text = value === null ? "" : String(value)
  const unsafe = typeof value === "string" && (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
  return `"${(unsafe ? `'${text}` : text).replace(/"/g, '""')}"`
}

export function reportExportCsv(scope: ReportExportScope, resources: ReportExportResource[]): string {
  const context = [scope.report, scope.section, scope.siteId, scope.siteName, scope.startDate, scope.endDate,
    scope.timeZone, scope.segmentId, scope.segmentName]
  const rows = reportExportRows(scope, resources).map(row => [
    ...context, row.dataset, row.rowPath, row.field, row.value, row.availability,
  ])
  return [REPORT_EXPORT_COLUMNS, ...rows].map(row => row.map(reportExportCsvCell).join(",")).join("\r\n") + "\r\n"
}

function filenamePart(value: string, fallback: string, maxLength = 60): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, maxLength) || fallback
}

export function reportExportFilename(scope: ReportExportScope): string {
  return [filenamePart(scope.siteName, "site"), filenamePart(scope.siteId, "unknown-site", 40),
    filenamePart(scope.report, "report"), filenamePart(scope.section, "section"),
    filenamePart(scope.startDate.slice(0, 10), "unknown-start", 10),
    filenamePart(scope.endDate.slice(0, 10), "unknown-end", 10)].join("_") + ".csv"
}

/** Browser-only call site; importing the pure adapters does not touch browser globals. */
export function downloadReportExport(csv: string, filename: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement("a")
    try {
      anchor.href = url
      anchor.download = filename
      anchor.hidden = true
      document.body.appendChild(anchor)
      anchor.click()
    } finally {
      anchor.remove()
    }
  } finally {
    // Let the browser start consuming the download before releasing the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}