import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { availableDemos } from "@/lib/demo-data"
import { useDashboardOverview, useDashboardPerformance } from "@/app/hooks/use-dashboard-batches"
import { useReportDateLimits } from "@/app/dashboard/use-report-date-limits"
import { useRecentActivityReport } from "@/app/components/dashboard/use-recent-activity-report"
import { ReportDataProvider } from "@/app/dashboard/ReportDataContext"
import type { OverviewGroup } from "@/lib/dashboard/report-groups"
import { subDays } from "date-fns"

let mockSiteId = availableDemos[0].id
let mockUser: { id: string } | null = null
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: mockUser, isLoading: false }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId }, isLoading: false }) }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: () => ({ shouldExecuteWidgets: true }) }))
const fetchMock = fetch as jest.Mock
const end = new Date()
const start = subDays(end, 29)

function wrapper(section: OverviewGroup) {
  const cache = new Map()
  return function Scope({ children }: { children: React.ReactNode }) {
    return <SWRConfig value={{ provider: () => cache }}>
      <ReportDataProvider value={{ overviewGroup: section, performanceGroup: "outcomes" }}>{children}</ReportDataProvider>
    </SWRConfig>
  }
}

beforeEach(() => { fetchMock.mockReset(); mockUser = null })

describe.each(availableDemos)("anonymous demo Overview: $id", ({ id }) => {
  it.each(["summary", "economics"] as const)("loads %s and date options without requesting authenticated APIs", async section => {
    mockSiteId = id
    const { result } = renderHook(() => ({
      limits: useReportDateLimits(mockSiteId, "overview", section),
      overview: useDashboardOverview(start, end),
    }), { wrapper: wrapper(section) })
    await waitFor(() => expect(result.current.overview.status).toBe("ready"))
    expect(result.current.limits.maxRangeDays).toBe(93)
    expect(result.current.limits.signedOut).toBe(false)
    expect(result.current.overview.data?.[section === "summary" ? "revenue" : "ltv"]).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("loads Activity's chart and feed while its unused overview batch stays disabled", async () => {
    mockSiteId = id
    const { result } = renderHook(() => ({
      overview: useDashboardOverview(start, end),
      chart: useDashboardPerformance(start, end),
      feed: useRecentActivityReport(6, start, end),
    }), { wrapper: wrapper("activity") })
    await waitFor(() => expect(result.current.feed.data?.activities).toHaveLength(6))
    await waitFor(() => expect(result.current.chart.status).toBe("ready"))
    expect(result.current.overview.status).toBe("disabled")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

it("does not carry demo data into a real or unknown site after switching", async () => {
  mockSiteId = availableDemos[0].id
  const { result, rerender } = renderHook(() => useDashboardOverview(start, end), { wrapper: wrapper("summary") })
  await waitFor(() => expect(result.current.status).toBe("ready"))
  for (const siteId of ["real-site", "demo-unknown"]) {
    mockSiteId = siteId
    rerender()
    expect(result.current.status).toBe("unauthenticated")
    expect(result.current.data).toBeUndefined()
  }
  expect(fetchMock).not.toHaveBeenCalled()
  mockUser = { id: "real-user" }
  mockSiteId = "real-site"
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ revenue: {}, "active-users": {}, "active-segments": {}, "active-campaigns": {} }) })
  rerender()
  await waitFor(() => expect(result.current.status).toBe("ready"))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toContain("siteId=real-site")
})