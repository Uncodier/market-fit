import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { subDays, addDays } from "date-fns"
import { availableDemos, getDemoData } from "@/lib/demo-data"
import { useDashboardPerformance, usePerformanceSlice } from "@/app/hooks/use-dashboard-batches"
import { ReportDataProvider, type ReportDataGroups } from "@/app/dashboard/ReportDataContext"
import { reportMetricKeys, type PerformanceGroup } from "@/lib/dashboard/report-groups"

let mockSiteId = availableDemos[0].id
let mockUser: { id: string } | null = null
let mockAuthLoading = false
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: mockUser, isLoading: mockAuthLoading }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId }, isLoading: false }) }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: () => ({ shouldExecuteWidgets: true }) }))

const fetchMock = fetch as jest.Mock
const end = new Date()
const start = subDays(end, 29)
const groups: (PerformanceGroup | undefined)[] = ["outcomes", "operations", "usage", undefined]

function wrapper(groups: ReportDataGroups = {}) {
  const cache = new Map()
  return function Scope({ children }: { children: React.ReactNode }) {
    return <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>
      <ReportDataProvider value={{ ...groups }}>{children}</ReportDataProvider>
    </SWRConfig>
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  mockUser = null
  mockAuthLoading = false
})

describe.each(availableDemos)("local demo Performance: $id", ({ id }) => {
  it.each(groups)("loads %s without a session or authenticated API calls", async group => {
    mockSiteId = id
    mockAuthLoading = true
    const { result } = renderHook(() => useDashboardPerformance(start, end), {
      wrapper: wrapper({ performanceGroup: group }),
    })
    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(Object.keys(result.current.data!)).toEqual(reportMetricKeys("performance", group))
    for (const metric of Object.values(result.current.data!)) expect(metric.actual).toBeGreaterThan(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(groups)("honors segment and date changes for %s without stale data", async group => {
    mockSiteId = id
    const data = await getDemoData(id)
    const firstMetric = reportMetricKeys("performance", group)![0]
    const { result, rerender } = renderHook(({ segment, from, to }) => useDashboardPerformance(from, to, segment), {
      initialProps: { segment: "all", from: start, to: end }, wrapper: wrapper({ performanceGroup: group }),
    })
    await waitFor(() => expect(result.current.status).toBe("ready"))
    const total = Number(result.current.data![firstMetric].actual)
    for (const segment of data!.segments) {
      rerender({ segment: segment.id, from: start, to: end })
      expect(result.current.data).toBeUndefined()
      await waitFor(() => expect(result.current.status).toBe("ready"))
      expect(result.current.data![firstMetric].actual).toBeGreaterThan(0)
      expect(Number(result.current.data![firstMetric].actual)).toBeLessThan(total)
    }
    rerender({ segment: "missing-segment", from: start, to: end })
    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(result.current.data![firstMetric].actual).toBe(0)
    rerender({ segment: "all", from: addDays(start, 365), to: addDays(end, 365) })
    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(result.current.data![firstMetric].actual).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("provides chart/widget slices in one local usage batch for signed-in demo viewers too", async () => {
    mockSiteId = id
    mockUser = { id: "signed-in-demo-viewer" }
    const { result } = renderHook(() => ({
      tokens: usePerformanceSlice<{ actual: number; chartData: unknown[] }>("tokens", start, end),
      images: usePerformanceSlice<{ actual: number }>("images-generated", start, end),
      video: usePerformanceSlice<{ actual: number }>("video-minutes", start, end),
    }), { wrapper: wrapper({ performanceGroup: "usage" }) })
    await waitFor(() => expect(result.current.tokens.data?.chartData).toHaveLength(30))
    expect(result.current.images.data?.actual).toBeGreaterThan(0)
    expect(result.current.video.data?.actual).toBeGreaterThan(0)
    await act(async () => { await result.current.tokens.mutate() })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

it.each(groups)("never carries demo %s data into unknown or real sites and keeps their authenticated path", async group => {
  mockSiteId = availableDemos[0].id
  const { result, rerender } = renderHook(() => useDashboardPerformance(start, end), {
    wrapper: wrapper({ performanceGroup: group }),
  })
  await waitFor(() => expect(result.current.status).toBe("ready"))
  for (const siteId of ["demo-unknown", "real-site"]) {
    mockSiteId = siteId
    rerender()
    expect(result.current.status).toBe("unauthenticated")
    expect(result.current.data).toBeUndefined()
  }
  expect(fetchMock).not.toHaveBeenCalled()
  mockUser = { id: "real-user" }
  fetchMock.mockImplementation(async (url: string) => {
    const params = new URL(url, "https://example.test").searchParams
    const keys = reportMetricKeys("performance", params.get("group") ?? undefined)!
    return { ok: true, json: async () => Object.fromEntries(keys.map(key => [key, { actual: 7 }])) }
  })
  for (const siteId of ["real-site", "demo-unknown"]) {
    mockSiteId = siteId
    rerender()
    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0]).toContain(`siteId=${siteId}`)
  }
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("changes groups locally and settles invalid date errors without a request", async () => {
  mockSiteId = availableDemos[0].id
  const groups: ReportDataGroups = { performanceGroup: "outcomes" }
  const { result, rerender } = renderHook(({ from }) => useDashboardPerformance(from, end), {
    initialProps: { from: start }, wrapper: wrapper(groups),
  })
  await waitFor(() => expect(result.current.status).toBe("ready"))
  for (const group of ["operations", "usage"] as const) {
    groups.performanceGroup = group
    rerender({ from: start })
    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(Object.keys(result.current.data!)).toEqual(reportMetricKeys("performance", group))
  }
  rerender({ from: subDays(end, 100) })
  await waitFor(() => expect(result.current.status).toBe("error"))
  expect(result.current.data).toBeUndefined()
  expect(result.current.error?.message).toContain("too large")
  expect(fetchMock).not.toHaveBeenCalled()
})