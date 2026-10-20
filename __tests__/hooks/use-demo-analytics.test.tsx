import React from "react"
import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { subDays, addDays } from "date-fns"
import { availableDemos, getDemoData } from "@/lib/demo-data"
import { useDistributionReport } from "@/app/components/dashboard/use-distribution-report"
import { useCohortReport } from "@/app/components/dashboard/use-cohort-report"
import { SegmentDonut } from "@/app/components/dashboard/segment-donut"
import { CohortReport } from "@/app/components/dashboard/cohort-report"
import { distributionTotal, reportPeriod } from "@/app/components/dashboard/report-query"

let mockSiteId = availableDemos[0].id
let mockUser: { id: string } | null = null
let mockAuthLoading = false
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: mockUser, isLoading: mockAuthLoading }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId }, isLoading: false }) }))
jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))

const fetchMock = fetch as jest.Mock
const end = new Date()
const start = subDays(end, 29)
const endpoints = ["clients-by-segment", "clients-by-campaign", "revenue-by-segment", "revenue-by-campaign"]

function wrapper() {
  const cache = new Map()
  return function Scope({ children }: { children: React.ReactNode }) {
    return <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>{children}</SWRConfig>
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  mockSiteId = availableDemos[0].id
  mockUser = null
  mockAuthLoading = false
})

describe.each(availableDemos)("local demo Analytics: $id", ({ id }) => {
  it.each(endpoints)("loads %s anonymously without API requests and keeps filters local", async endpoint => {
    mockSiteId = id
    const fixture = await getDemoData(id)
    const { result, rerender } = renderHook(({ segment, from, to }) => useDistributionReport({
      endpoint, siteId: mockSiteId, userId: mockUser?.id, segmentId: segment,
      period: reportPeriod(from, to), enabled: true,
    }), { initialProps: { segment: "all", from: start, to: end }, wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    const all = distributionTotal(result.current.data!)
    expect(all).toBeGreaterThan(0)
    for (const segment of fixture!.segments) {
      rerender({ segment: segment.id, from: start, to: end })
      expect(result.current.data).toBeUndefined()
      await waitFor(() => expect(result.current.data).toBeDefined())
      expect(distributionTotal(result.current.data!)).toBeGreaterThan(0)
      expect(distributionTotal(result.current.data!)).toBeLessThan(all)
    }
    rerender({ segment: "missing-segment", from: start, to: end })
    await waitFor(() => expect(result.current.data).toEqual([]))
    rerender({ segment: "all", from: addDays(start, 365), to: addDays(end, 365) })
    await waitFor(() => expect(result.current.data).toEqual([]))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(["customers", "leads"] as const)("loads %s cohorts while auth is pending, and reloads locally", async kind => {
    mockSiteId = id
    mockAuthLoading = true
    const fixture = await getDemoData(id)
    const { result, rerender } = renderHook(({ segment, from, to }) => useCohortReport(kind, {
      segmentId: segment, startDate: from, endDate: to,
    }), { initialProps: { segment: "all", from: start, to: end }, wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.authLoading).toBe(false)
    expect(result.current.signedIn).toBe(true)
    const rows = () => kind === "customers" ? result.current.data!.salesCohorts : result.current.data!.leadCohorts
    const population = rows().reduce((sum, row) => sum + row.size!, 0)
    for (const segment of fixture!.segments) {
      rerender({ segment: segment.id, from: start, to: end })
      expect(result.current.data).toBeUndefined()
      await waitFor(() => expect(result.current.data).toBeDefined())
      expect(rows().length).toBeGreaterThan(0)
      expect(rows().reduce((sum, row) => sum + row.size!, 0)).toBeLessThan(population)
    }
    await act(async () => { await result.current.mutate() })
    rerender({ segment: "missing-segment", from: start, to: end })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(rows()).toEqual([])
    rerender({ segment: "all", from: addDays(start, 365), to: addDays(end, 365) })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(rows()).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("renders all three sections for anonymous demos while authentication is pending", async () => {
    mockSiteId = id
    mockAuthLoading = true
    render(<>
      <SegmentDonut endpoint="clients-by-segment" startDate={start} endDate={end} />
      <CohortReport kind="customers" startDate={start} endDate={end} />
      <CohortReport kind="leads" startDate={start} endDate={end} />
    </>, { wrapper: wrapper() })
    await screen.findByRole("table", { name: /clients by segment: share/i })
    await screen.findByRole("table", { name: "Repeat purchase retention" })
    await screen.findByRole("table", { name: "Customer engagement retention" })
    await screen.findByRole("table", { name: "Lead engagement retention" })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

it("never carries demo cohorts/distributions into anonymous real/unknown sites and retains authenticated requests", async () => {
  const { result, rerender } = renderHook(() => ({
    cohort: useCohortReport("leads", { startDate: start, endDate: end }),
    distribution: useDistributionReport({ endpoint: "clients-by-segment", siteId: mockSiteId, userId: mockUser?.id,
      period: reportPeriod(start, end), enabled: !mockAuthLoading }),
  }), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.cohort.data).toBeDefined())
  await waitFor(() => expect(result.current.distribution.data).toBeDefined())
  for (const siteId of ["demo-unknown", "real-site"]) {
    mockSiteId = siteId
    rerender()
    expect(result.current.cohort.data).toBeUndefined()
    expect(result.current.cohort.signedIn).toBe(false)
    expect(result.current.distribution.data).toBeUndefined()
  }
  expect(fetchMock).not.toHaveBeenCalled()
  mockUser = { id: "real-user" }
  mockAuthLoading = true
  rerender()
  expect(fetchMock).not.toHaveBeenCalled()
  mockAuthLoading = false
  fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes("/api/leads-cohorts?")
    ? { leadCohorts: [{ cohort: "Real cohort", size: 1, weeks: [100, 0] }] }
    : { segments: [{ name: "Real audience", value: 1 }] } }))
  for (const siteId of ["real-site", "demo-unknown"]) {
    mockSiteId = siteId
    rerender()
    await waitFor(() => expect(result.current.cohort.data?.leadCohorts[0].cohort).toBe("Real cohort"))
    await waitFor(() => expect(result.current.distribution.data?.[0].name).toBe("Real audience"))
    expect(fetchMock.mock.calls.slice(-2).every(([url]) => url.includes(`siteId=${siteId}`))).toBe(true)
  }
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

it.each(["customers", "leads"] as const)("shows local %s range errors without network requests", async kind => {
  const { result, rerender } = renderHook(({ from }) => useCohortReport(kind, { startDate: from, endDate: end }), {
    initialProps: { from: start }, wrapper: wrapper(),
  })
  await waitFor(() => expect(result.current.data).toBeDefined())
  rerender({ from: subDays(end, 100) })
  await waitFor(() => expect(result.current.error?.message).toContain("too large"))
  expect(result.current.data).toBeUndefined()
  rerender({ from: new Date("invalid") })
  expect(result.current.invalidDates).toBe(true)
  expect(result.current.data).toBeUndefined()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("keeps local data available for a signed-in demo viewer", async () => {
  mockUser = { id: "demo-viewer" }
  const { result } = renderHook(() => useCohortReport("customers", { startDate: start, endDate: end }), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.data?.salesCohorts.length).toBeGreaterThan(0))
  expect(fetchMock).not.toHaveBeenCalled()
})