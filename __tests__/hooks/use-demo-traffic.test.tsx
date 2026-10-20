import React from "react"
import { render, renderHook, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { subDays } from "date-fns"
import { availableDemos } from "@/lib/demo-data"
import { useTrafficMetric } from "@/app/components/dashboard/traffic/use-traffic-metric"
import { TrafficReports } from "@/app/components/dashboard/traffic-reports"
import { SessionEventsContainer } from "@/app/components/dashboard/traffic/session-events-container"
import type { SessionEventsData } from "@/app/components/dashboard/traffic/session-events-data"

let mockSiteId = availableDemos[0].id
let mockUser: { id: string } | null = null
let mockAuthLoading = true
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: mockUser, isLoading: mockAuthLoading }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId }, isLoading: false }) }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: () => ({ shouldExecuteWidgets: true }) }))
jest.mock("@/app/components/dashboard/traffic/session-events-chart", () => ({
  SessionEventsChart: ({ loading, totals }: { loading: boolean; totals?: SessionEventsData["totals"] }) =>
    <div data-testid="session-events">{loading ? "loading" : JSON.stringify(totals)}</div>,
}))
jest.mock("@/app/components/dashboard/traffic/session-events-referrers", () => ({
  SessionEventsReferrers: ({ loading, data }: { loading: boolean; data: SessionEventsData["referrersData"] }) =>
    <div data-testid="session-referrers">{loading ? "loading" : JSON.stringify(data)}</div>,
}))
const fetchMock = jest.mocked(fetch)
const endDate = new Date()
const startDate = subDays(endDate, 29)
function wrapper() {
  const cache = new Map()
  return function Scope({ children }: { children: React.ReactNode }) {
    return <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
  }
}
beforeEach(() => { fetchMock.mockReset(); mockUser = null; mockAuthLoading = true })

describe.each(availableDemos)("anonymous demo Traffic: $id", ({ id }) => {
  it.each(["visits", "session-time", "lead-conversion", "client-conversion"] as const)("loads %s without auth or network", async endpoint => {
    mockSiteId = id
    const { result } = renderHook(() => useTrafficMetric(endpoint, { startDate, endDate }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeUndefined()
    expect(result.current.data?.actual).toBeGreaterThan(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(["summary", "audience", "sessions"] as const)("renders the %s section locally", async section => {
    mockSiteId = id
    const { container } = render(<TrafficReports siteId={id} section={section} startDate={startDate} endDate={endDate} />, { wrapper: wrapper() })
    if (section === "summary") {
      await screen.findByText("Sessions analyzed")
      expect(container.querySelector('[data-report-panel="traffic-segments"]')).toBeInTheDocument()
      expect(container.querySelector('[data-report-panel="traffic-campaigns"]')).toBeInTheDocument()
      expect(container.querySelector('[data-report-panel="traffic-pages"]')).toBeInTheDocument()
      expect(container.querySelector('[data-report-panel="traffic-referrals"]')).toBeInTheDocument()
    } else if (section === "audience") {
      await screen.findByText("Chrome")
      expect(container.querySelector('[data-report-panel="traffic-regions"]')).toBeInTheDocument()
      expect(container.querySelector('[data-report-panel="traffic-devices"]')).toBeInTheDocument()
      expect(container.querySelector('[data-report-panel="traffic-browsers"]')).toBeInTheDocument()
    } else {
      await waitFor(() => expect(screen.getByTestId("session-events")).not.toHaveTextContent("loading"))
      expect(screen.getByTestId("session-referrers")).toHaveTextContent("google.com")
    }
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

it("clears metric scope for empty dates and isolates site switches, then restores real-site authentication", async () => {
  mockSiteId = availableDemos[0].id
  const { result, rerender } = renderHook(({ start, end }) => useTrafficMetric("visits", { startDate: start, endDate: end }), {
    wrapper: wrapper(), initialProps: { start: startDate, end: endDate },
  })
  await waitFor(() => expect(result.current.data?.actual).toBeGreaterThan(0))
  rerender({ start: new Date(2000, 0, 1), end: new Date(2000, 0, 30) })
  await waitFor(() => expect(result.current.data?.actual).toBe(0))
  mockSiteId = availableDemos[1].id
  rerender({ start: startDate, end: endDate })
  await waitFor(() => expect(result.current.data?.actual).toBeGreaterThan(0))
  mockSiteId = "demo-unknown"
  mockAuthLoading = false
  rerender({ start: startDate, end: endDate })
  await waitFor(() => expect(result.current.error?.status).toBe(401))
  expect(result.current.data).toBeUndefined()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("keeps empty session ranges and site switches local without displaying prior-site data", async () => {
  const { rerender } = render(<SessionEventsContainer siteId={availableDemos[0].id} startDate={startDate} endDate={endDate} />, { wrapper: wrapper() })
  await waitFor(() => expect(screen.getByTestId("session-referrers")).toHaveTextContent("google.com"))
  rerender(<SessionEventsContainer siteId={availableDemos[1].id} startDate={new Date(2000, 0, 1)} endDate={new Date(2000, 0, 30)} />)
  await waitFor(() => expect(screen.getByTestId("session-events")).toHaveTextContent('"pageVisits":0'))
  expect(screen.getByTestId("session-referrers")).toHaveTextContent("[]")
  expect(fetchMock).not.toHaveBeenCalled()
})

it("uses the authenticated real-site path after switching from a demo", async () => {
  mockSiteId = availableDemos[0].id
  const { result, rerender } = renderHook(() => useTrafficMetric("visits", { startDate, endDate }), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.data?.actual).toBeGreaterThan(0))
  mockSiteId = "real-site"
  mockUser = { id: "real-user" }
  mockAuthLoading = false
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ actual: 13, percentChange: 1, periodType: "monthly" }) } as Response)
  rerender()
  await waitFor(() => expect(result.current.data?.actual).toBe(13))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(new URL(String(fetchMock.mock.calls[0][0]), "http://localhost").searchParams.get("siteId")).toBe("real-site")
})