import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { useWidgetContext } from "@/app/context/WidgetContext"
import { ReportDataProvider, type ReportDataGroups } from "@/app/dashboard/ReportDataContext"
import { useDashboardPerformance, useOverviewSlice, usePerformanceSlice } from "@/app/hooks/use-dashboard-batches"
import { reportMetricKeys } from "@/lib/dashboard/report-groups"

jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: jest.fn() }))

const fetchMock = global.fetch as jest.Mock
const start = new Date(2026, 0, 1, 14, 32)
const end = new Date(2026, 0, 31, 9, 10)

function wrapper(groups: ReportDataGroups = {}) {
  const cache = new Map()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false, revalidateOnFocus: false }}>
      <ReportDataProvider value={groups}>{children}</ReportDataProvider>
    </SWRConfig>
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(useAuth as jest.Mock).mockReturnValue({ user: { id: "user-a" } })
  ;(useSite as jest.Mock).mockReturnValue({ currentSite: { id: "site-a" } })
  ;(useWidgetContext as jest.Mock).mockReturnValue({ shouldExecuteWidgets: true })
  fetchMock.mockImplementation(async (input: string) => {
    const url = new URL(input, "https://example.test")
    const kind = url.pathname.endsWith("performance") ? "performance" : "overview"
    const keys = reportMetricKeys(kind, url.searchParams.get("group") ?? undefined)!
    return { ok: true, json: async () => Object.fromEntries(keys.map(key => [key, { actual: 7 }])) }
  })
})

it("deduplicates visible KPI/chart slices into one usage batch", async () => {
  const { result } = renderHook(() => ({
    input: usePerformanceSlice("tokens", start, end),
    output: usePerformanceSlice("tokens", new Date(2026, 0, 1, 23), new Date(2026, 0, 31, 21)),
    images: usePerformanceSlice("images-generated", start, end),
  }), { wrapper: wrapper({ performanceGroup: "usage" }) })
  await waitFor(() => expect(result.current.images.data).toEqual({ actual: 7 }))
  expect(result.current.input.data).toEqual({ actual: 7 })
  expect(result.current.output.data).toEqual({ actual: 7 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const url = new URL(fetchMock.mock.calls[0][0], "https://example.test")
  expect(url.searchParams.get("group")).toBe("usage")
  expect(url.searchParams.get("startDate")).toBe("2026-01-01")
  expect(url.searchParams.get("endDate")).toBe("2026-01-31")
  expect(url.searchParams.has("userId")).toBe(false)
  expect(url.searchParams.has("useDemoData")).toBe(false)
})

it("keeps the legacy full-batch contract without a selected group", async () => {
  const { result } = renderHook(() => useDashboardPerformance(start, end), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.data?.["metrics-overview"]).toEqual({ actual: 7 }))
  expect(new URL(fetchMock.mock.calls[0][0], "https://example.test").searchParams.has("group")).toBe(false)
})

it.each(["summary", "economics"] as const)("requests only overview/%s", async overviewGroup => {
  const key = overviewGroup === "summary" ? "revenue" : "cpl"
  const { result } = renderHook(() => useOverviewSlice(key, start, end, "segment-a"), {
    wrapper: wrapper({ overviewGroup }),
  })
  await waitFor(() => expect(result.current.data).toEqual({ actual: 7 }))
  const url = new URL(fetchMock.mock.calls[0][0], "https://example.test")
  expect(url.pathname).toBe("/api/dashboard/overview")
  expect(url.searchParams.get("group")).toBe(overviewGroup)
  expect(url.searchParams.get("segmentId")).toBe("segment-a")
})

it("skips overview activity and requests outcomes for its performance chart", async () => {
  const { result } = renderHook(() => ({
    overview: useOverviewSlice("revenue", start, end),
    chart: usePerformanceSlice("metrics-overview", start, end),
  }), { wrapper: wrapper({ overviewGroup: "activity", performanceGroup: "outcomes" }) })
  await waitFor(() => expect(result.current.chart.data).toEqual({ actual: 7 }))
  expect(result.current.overview.data).toBeNull()
  expect(result.current.overview.isLoading).toBe(false)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toContain("/performance?")
  expect(fetchMock.mock.calls[0][0]).toContain("group=outcomes")
})

it("uses distinct keys for group changes but stable keys for same-day time changes", async () => {
  const groups: ReportDataGroups = { performanceGroup: "outcomes" }
  const { result, rerender } = renderHook(({ from }) => useDashboardPerformance(from, end), {
    wrapper: wrapper(groups), initialProps: { from: start },
  })
  await waitFor(() => expect(result.current.data?.sales).toBeDefined())
  rerender({ from: new Date(2026, 0, 1, 23, 59) })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  groups.performanceGroup = "operations"
  rerender({ from: start })
  await waitFor(() => expect(result.current.data?.tasks).toBeDefined())
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it.each(["widgets-not-ready", "missing-site", "default-site"])("skips requests when %s", async reason => {
  if (reason === "widgets-not-ready") (useWidgetContext as jest.Mock).mockReturnValue({ shouldExecuteWidgets: false })
  else (useSite as jest.Mock).mockReturnValue({ currentSite: reason === "default-site" ? { id: "default" } : null })
  const { result } = renderHook(() => useDashboardPerformance(start, end), { wrapper: wrapper() })
  expect(result.current.isLoading).toBe(reason === "widgets-not-ready")
  expect(fetchMock).not.toHaveBeenCalled()
})

it("isolates client cache data when the authenticated account changes", async () => {
  const { result, rerender } = renderHook(() => useDashboardPerformance(start, end), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.data).toBeDefined())
  ;(useAuth as jest.Mock).mockReturnValue({ user: { id: "user-b" } })
  rerender()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
})

it("waits for auth hydration and never requests an anonymous batch", async () => {
  ;(useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true })
  const { result, rerender } = renderHook(() => useDashboardPerformance(start, end), { wrapper: wrapper() })
  expect(result.current.isLoading).toBe(true)
  expect(fetchMock).not.toHaveBeenCalled()
  ;(useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false })
  rerender()
  expect(result.current.isLoading).toBe(false)
  expect(fetchMock).not.toHaveBeenCalled()
  ;(useAuth as jest.Mock).mockReturnValue({ user: { id: "user-a" }, isLoading: false })
  rerender()
  await waitFor(() => expect(result.current.data).toBeDefined())
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each(["http", "nested-error", "missing-metric"])("exposes %s failure and retries without a cached success", async failure => {
  fetchMock.mockResolvedValueOnce({
    ok: failure !== "http",
    json: async () => failure === "nested-error" ? { tokens: { error: "failed" } } : {},
  })
  const { result } = renderHook(() => usePerformanceSlice("tokens", start, end), {
    wrapper: wrapper({ performanceGroup: "usage" }),
  })
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
  expect(result.current.data).toBeNull()
  await act(async () => { await result.current.mutate() })
  await waitFor(() => expect(result.current.data).toEqual({ actual: 7 }))
  expect(result.current.error).toBeUndefined()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("exposes validated currency options and isolates selected currency requests", async () => {
  fetchMock.mockResolvedValueOnce({
    ok: false, status: 422,
    json: async () => ({ error: "private details", availableCurrencies: ["EUR", "USD"] }),
  })
  const groups: ReportDataGroups = { overviewGroup: "summary" }
  const { result, rerender } = renderHook(() => useOverviewSlice("revenue", start, end), {
    wrapper: wrapper(groups),
  })
  await waitFor(() => expect(result.current.error?.availableCurrencies).toEqual(["EUR", "USD"]))
  expect(result.current.error?.message).not.toContain("private details")
  groups.currency = "EUR"
  rerender()
  await waitFor(() => expect(result.current.data).toEqual({ actual: 7 }))
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[1][0]).toContain("currency=EUR")
})