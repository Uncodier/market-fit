import React, { useLayoutEffect } from "react"
import { act, render, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { AuthContext, type AuthContextValue } from "@/app/components/auth/auth-context"
import { useReportResource } from "@/app/hooks/use-report-resource"
import { ReportExportScope } from "@/app/dashboard/export/ReportExportScope"
import { getReportExportSnapshot } from "@/app/dashboard/export/report-export-store"
import { downloadReportExport, reportExportCsv } from "@/app/dashboard/export/report-export-csv"
import { createReportExportRegistry } from "@/app/dashboard/export/report-export-registry"
import { reportExportResourceKey } from "@/app/dashboard/export/report-export-key"
import type { ReportExportScope as Scope } from "@/app/dashboard/export/report-export-data"

jest.mock("@/app/dashboard/export/report-export-csv", () => ({
  downloadReportExport: jest.fn(), reportExportCsv: jest.fn(() => "csv"), reportExportFilename: () => "report.csv",
}))

const scope: Scope = {
  report: "sales", section: "summary", siteId: "site-a", siteName: "Site A", userId: "user-a",
  segmentId: "segment-a", segmentName: "Segment A", startDate: "2026-01-01", endDate: "2026-01-31",
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
}
const auth = { user: { id: scope.userId }, isLoading: false } as AuthContextValue
function key(currency = "USD", filters = scope) {
  return [filters.userId, `/api/revenue?${new URLSearchParams({
    siteId: filters.siteId, segmentId: filters.segmentId, startDate: filters.startDate,
    endDate: filters.endDate, currency,
  })}`] as const
}

beforeEach(() => jest.clearAllMocks())

it("rejects keys belonging to other accounts, sites, ranges and segments", () => {
  expect(reportExportResourceKey(key(), scope)).toMatchObject({ id: "revenue", filters: { currency: "USD" } })
  for (const [field, value] of Object.entries({ userId: "user-b", siteId: "site-b", startDate: "2025-12-01", endDate: "2026-02-01", segmentId: "all" })) {
    expect(reportExportResourceKey(key("USD", { ...scope, [field]: value }), scope)).toBeNull()
  }
  expect(reportExportResourceKey(key()[1], scope)).toBeNull()
})

it("uses local calendar dates for ISO ranges and labels site-wide activity independently", () => {
  const startDate = new Date(2026, 0, 1).toISOString()
  const endDate = new Date(2026, 0, 31, 23, 59, 59).toISOString()
  const resource = reportExportResourceKey([`/api/recent-activity?${new URLSearchParams({
    siteId: scope.siteId, startDate, endDate, limit: "6",
  })}`, scope.userId], scope)
  expect(resource).toMatchObject({ id: "recent-activity", filters: { segmentId: "all", limit: "6" } })
  expect(reportExportResourceKey(["social-performance", scope.siteId, new Date(2026, 0, 1).getTime(),
    new Date(2026, 0, 31).getTime(), scope.timeZone, scope.userId], { ...scope, segmentId: "all" }))
    .toMatchObject({ id: "social-performance", filters: { segmentId: "all", timeZone: scope.timeZone } })
})

it("requires all expected resources, tolerates duplicate subscribers, and invalidates stale downloads", () => {
  const registry = createReportExportRegistry({ ...scope, report: "costs" })
  const first = Symbol(), duplicate = Symbol(), second = Symbol()
  registry.mount()
  const cost = { id: "costs", requestKey: "costs-usd", filters: {}, data: {}, ready: true }
  registry.set(first, cost)
  expect(getReportExportSnapshot()?.ready).toBe(false)
  registry.set(second, { ...cost, id: "revenue", requestKey: "revenue-usd" })
  registry.set(duplicate, cost)
  expect(getReportExportSnapshot()?.ready).toBe(true)
  const staleDownload = getReportExportSnapshot()!.download
  registry.set(duplicate, { ...cost, ready: false })
  expect(getReportExportSnapshot()?.ready).toBe(false)
  expect(staleDownload).toThrow(/finish loading/)
  registry.set(duplicate, { ...cost, requestKey: "costs-eur" })
  expect(getReportExportSnapshot()?.ready).toBe(false)
  registry.remove(duplicate)
  expect(getReportExportSnapshot()?.ready).toBe(true)
  registry.dispose()
  expect(getReportExportSnapshot()).toBeNull()
  expect(staleDownload).toThrow(/finish loading/)
})

it("does not let an old scope's cleanup clear a newer export", () => {
  const old = createReportExportRegistry(scope)
  const current = createReportExportRegistry({ ...scope, siteId: "site-b" })
  old.mount(); current.mount(); old.dispose()
  expect(getReportExportSnapshot()?.siteId).toBe("site-b")
  current.dispose()
})

it("registers current data through Strict Mode mount cleanup without duplicate downloads", async () => {
  const fetcher = jest.fn(async () => ({ currency: "USD" }))
  function Resource() { useReportResource(key(), fetcher); return null }
  const { unmount } = render(<React.StrictMode><AuthContext.Provider value={auth}>
    <SWRConfig value={{ provider: () => new Map() }}><ReportExportScope {...scope}><Resource /></ReportExportScope></SWRConfig>
  </AuthContext.Provider></React.StrictMode>)
  await waitFor(() => expect(getReportExportSnapshot()?.ready).toBe(true))
  act(() => getReportExportSnapshot()!.download())
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(downloadReportExport).toHaveBeenCalledTimes(1)
  unmount()
  expect(getReportExportSnapshot()).toBeNull()
})

it("exports the already loaded data with no additional fetch and blocks refresh errors", async () => {
  let result!: ReturnType<typeof useReportResource<unknown>>
  let fail = false
  const data = { currency: "USD", totalSales: { actual: 19.125, previous: 0 }, metadata: {} }
  const fetcher = jest.fn(async () => { if (fail) throw new Error("Unavailable"); return data })
  function Resource() {
    const value = useReportResource<unknown>(key(), fetcher)
    useLayoutEffect(() => { result = value }, [value])
    return null
  }
  const { unmount } = render(<AuthContext.Provider value={auth}>
    <SWRConfig value={{ provider: () => new Map() }}><ReportExportScope {...scope}><Resource /></ReportExportScope></SWRConfig>
  </AuthContext.Provider>)
  await waitFor(() => expect(getReportExportSnapshot()?.ready).toBe(true))
  act(() => getReportExportSnapshot()!.download())
  expect(reportExportCsv).toHaveBeenCalledWith(scope, [{ id: "revenue", data, filters: { currency: "USD", segmentId: "segment-a" } }])
  expect(downloadReportExport).toHaveBeenCalledWith("csv", "report.csv")
  expect(fetcher).toHaveBeenCalledTimes(1)
  const staleDownload = getReportExportSnapshot()!.download
  fail = true
  await act(async () => { await result.mutate() })
  expect(getReportExportSnapshot()?.ready).toBe(false)
  expect(staleDownload).toThrow(/finish loading/)
  unmount()
  expect(getReportExportSnapshot()).toBeNull()
})

it("does not export an earlier currency, section, or account after a change", async () => {
  let resolve!: (data: unknown) => void
  const delayed = new Promise(done => { resolve = done })
  const fetcher = jest.fn(async ([, url]: readonly [string, string]) => url.includes("EUR") ? delayed : { currency: "USD" })
  const cache = new Map()
  function Resource({ currency }: { currency: string }) { useReportResource(key(currency), fetcher); return null }
  const ui = (currency: string, section = "summary", identity = auth) => <AuthContext.Provider value={identity}>
    <SWRConfig value={{ provider: () => cache }}><ReportExportScope {...scope} section={section}>
      <Resource currency={currency} />
    </ReportExportScope></SWRConfig>
  </AuthContext.Provider>
  const { rerender } = render(ui("USD"))
  await waitFor(() => expect(getReportExportSnapshot()?.ready).toBe(true))
  rerender(ui("EUR"))
  expect(getReportExportSnapshot()?.ready).toBe(false)
  await act(async () => { resolve({ currency: "EUR" }) })
  await waitFor(() => expect(getReportExportSnapshot()?.ready).toBe(true))
  act(() => getReportExportSnapshot()!.download())
  expect(reportExportCsv).toHaveBeenLastCalledWith(scope, [expect.objectContaining({ data: { currency: "EUR" } })])
  const staleDownload = getReportExportSnapshot()!.download
  rerender(ui("EUR", "channels"))
  expect(getReportExportSnapshot()?.section).toBe("channels")
  expect(staleDownload).toThrow(/finish loading/)
  rerender(ui("EUR", "channels", { ...auth, user: null }))
  expect(getReportExportSnapshot()?.ready).toBe(false)
})