import { expectedReportResources, type ReportExportResource, type ReportExportScope } from "./report-export-data"
import { downloadReportExport, reportExportCsv, reportExportFilename } from "./report-export-csv"
import { clearReportExport, ownsReportExport, publishReportExport } from "./report-export-store"
import type { ExportResourceKey } from "./report-export-key"

type Entry = ExportResourceKey & { ready: boolean; data: unknown }

export function createReportExportRegistry(scope: ReportExportScope) {
  const token = Symbol("report-export")
  const entries = new Map<symbol, Entry>()
  const expected = expectedReportResources(scope.report, scope.section)
  const scopeKey = JSON.stringify(scope)
  let mounted = false

  function collect(): ReportExportResource[] | null {
    if (!scope.userId || !expected.length) return null
    const resources: ReportExportResource[] = []
    for (const id of expected) {
      const matches = [...entries.values()].filter(entry => entry.id === id)
      const first = matches[0]
      if (!first || matches.some(entry => !entry.ready || entry.requestKey !== first.requestKey)) return null
      resources.push({ id, data: first.data, filters: first.filters })
    }
    return resources
  }

  function download() {
    const resources = collect()
    if (!mounted || !ownsReportExport(token) || !resources) {
      throw new Error("Wait for the current report section to finish loading before exporting.")
    }
    downloadReportExport(reportExportCsv(scope, resources), reportExportFilename(scope))
  }

  function publish() {
    if (mounted) publishReportExport(token, {
      scopeKey, report: scope.report, section: scope.section, siteId: scope.siteId,
      userId: scope.userId, ready: collect() !== null, download,
    })
  }

  return {
    scope,
    mount() { mounted = true; publish() },
    dispose() { mounted = false; clearReportExport(token) },
    set(subscriber: symbol, entry: Entry) {
      if (!expected.includes(entry.id)) return
      entries.set(subscriber, entry)
      publish()
    },
    remove(subscriber: symbol) {
      if (entries.delete(subscriber)) publish()
    },
  }
}

export type ReportExportRegistry = ReturnType<typeof createReportExportRegistry>