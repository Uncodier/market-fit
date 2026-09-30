import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig, unstable_serialize } from "swr"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { useWidgetContext } from "@/app/context/WidgetContext"
import { DashboardBatchError, useDashboardPerformance } from "@/app/hooks/use-dashboard-batches"
import { OverviewDataBoundary, PerformanceDataBoundary } from "@/app/dashboard/ReportBatchBoundary"
import { OverviewCurrencyScope } from "@/app/dashboard/OverviewCurrencyScope"
import { ReportDataProvider, type ReportDataGroups } from "@/app/dashboard/ReportDataContext"
import { ReportSWRScope } from "@/app/dashboard/ReportSWRScope"
import { reportMetricKeys } from "@/lib/dashboard/report-groups"
import { CohortReport } from "@/app/components/dashboard/cohort-report"
import { SegmentDonut } from "@/app/components/dashboard/segment-donut"

jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: jest.fn() }))
jest.mock("@/app/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => <select aria-label="Reporting currency" value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => <option value="">Select a currency</option>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))

const fetchMock = global.fetch as jest.Mock
const filters = { startDate: new Date(2026, 0, 1), endDate: new Date(2026, 0, 31), segmentId: "all" }
const performanceData = Object.fromEntries(reportMetricKeys("performance", "outcomes")!.map(key => [key, { actual: 7 }]))

function deferred() {
  let resolve!: (value: unknown) => void
  const promise = new Promise(value => { resolve = value })
  return { promise, resolve }
}
const success = (data = performanceData) => ({ ok: true, json: async () => data })
const failure = { ok: false, status: 500 }

function Scope({ children, groups = { performanceGroup: "outcomes" } }: { children: React.ReactNode; groups?: ReportDataGroups }) {
  return <ReportSWRScope><ReportDataProvider value={groups}>{children}</ReportDataProvider></ReportSWRScope>
}
function Performance() {
  return <PerformanceDataBoundary {...filters}><div>Report figures</div></PerformanceDataBoundary>
}
function expectPending() {
  expect(screen.getByRole("status", { name: "Loading report" })).toHaveAttribute("aria-busy", "true")
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.queryByText("Report figures")).not.toBeInTheDocument()
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useAuth).mockReturnValue({ user: { id: "user-a" }, isLoading: false } as ReturnType<typeof useAuth>)
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: "site-a" }, isLoading: false } as ReturnType<typeof useSite>)
  jest.mocked(useWidgetContext).mockReturnValue({ shouldExecuteWidgets: true, currentRoute: "/dashboard" })
  fetchMock.mockImplementation(() => Promise.resolve(success()))
})

it("starts with a skeleton through auth, site, and widget readiness before fetching", async () => {
  const request = deferred()
  fetchMock.mockReturnValue(request.promise)
  jest.mocked(useAuth).mockReturnValue({ user: null, isLoading: true } as ReturnType<typeof useAuth>)
  jest.mocked(useSite).mockReturnValue({ currentSite: null, isLoading: true } as ReturnType<typeof useSite>)
  jest.mocked(useWidgetContext).mockReturnValue({ shouldExecuteWidgets: false, currentRoute: "/dashboard" })
  const page = <Scope><Performance /></Scope>
  const { rerender } = render(page)
  expectPending()
  expect(fetchMock).not.toHaveBeenCalled()
  jest.mocked(useAuth).mockReturnValue({ user: { id: "user-a" }, isLoading: false } as ReturnType<typeof useAuth>)
  rerender(<Scope><Performance /></Scope>)
  expectPending()
  expect(fetchMock).not.toHaveBeenCalled()
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: "site-a" }, isLoading: false } as ReturnType<typeof useSite>)
  rerender(<Scope><Performance /></Scope>)
  expectPending()
  expect(fetchMock).not.toHaveBeenCalled()
  jest.mocked(useWidgetContext).mockReturnValue({ shouldExecuteWidgets: true, currentRoute: "/dashboard" })
  rerender(<Scope><Performance /></Scope>)
  expectPending()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => { request.resolve(success()) })
  expect(await screen.findByText("Report figures")).toBeInTheDocument()
})

it.each(["auth", "site"])("settles missing %s without requesting or showing an endless skeleton", reason => {
  if (reason === "auth") jest.mocked(useAuth).mockReturnValue({ user: null, isLoading: false } as ReturnType<typeof useAuth>)
  else jest.mocked(useSite).mockReturnValue({ currentSite: null, isLoading: false } as ReturnType<typeof useSite>)
  render(<Scope><Performance /></Scope>)
  expect(screen.getByRole("status")).toHaveTextContent(reason === "auth" ? "Sign in" : "Select a site")
  expect(screen.queryByRole("status", { name: "Loading report" })).not.toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("lets the disabled overview activity batch render its independent children", () => {
  jest.mocked(useWidgetContext).mockReturnValue({ shouldExecuteWidgets: false, currentRoute: "/dashboard" })
  render(<Scope groups={{ overviewGroup: "activity" }}>
    <OverviewDataBoundary {...filters}><div>Recent activity</div></OverviewDataBoundary>
  </Scope>)
  expect(screen.getByText("Recent activity")).toBeInTheDocument()
  expect(screen.queryByRole("status", { name: "Loading report" })).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("shows only settled failures and removes the prior error throughout retry", async () => {
  const first = deferred()
  const retry = deferred()
  fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise)
  render(<Scope><Performance /></Scope>)
  expectPending()
  await act(async () => { first.resolve(failure) })
  expect(await screen.findByRole("alert")).toHaveTextContent("Missing metrics are not zero activity")
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expectPending()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  await act(async () => { retry.resolve(failure) })
  expect(await screen.findByRole("alert")).toBeInTheDocument()
  expect(screen.queryByRole("status", { name: "Loading report" })).not.toBeInTheDocument()
})

it("hides stale figures during refresh, then hides stale errors during a successful retry", async () => {
  let refresh: ReturnType<typeof useDashboardPerformance>["mutate"]
  function RefreshControl() {
    refresh = useDashboardPerformance(filters.startDate, filters.endDate).mutate
    return null
  }
  render(<Scope><RefreshControl /><Performance /></Scope>)
  expect(await screen.findByText("Report figures")).toBeInTheDocument()
  const refreshRequest = deferred()
  fetchMock.mockReturnValueOnce(refreshRequest.promise)
  act(() => { void refresh() })
  expectPending()
  await act(async () => { refreshRequest.resolve(failure) })
  expect(await screen.findByRole("alert")).toBeInTheDocument()
  const retry = deferred()
  fetchMock.mockReturnValueOnce(retry.promise)
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expectPending()
  await act(async () => { retry.resolve(success()) })
  expect(await screen.findByText("Report figures")).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it.each([false, true])("never exposes an initial cached error before its mount retry (cached data: %s)", async withData => {
  const request = deferred()
  fetchMock.mockReturnValue(request.promise)
  const url = "/api/dashboard/performance?siteId=site-a&segmentId=all&startDate=2026-01-01&endDate=2026-01-31&group=outcomes"
  const cache = new Map([[unstable_serialize([url, "user-a"]), {
    error: new DashboardBatchError("Previous failure"),
    data: withData ? performanceData : undefined,
    isLoading: false, isValidating: false,
  }]])
  const history: { isLoading: boolean; error?: Error }[] = []
  function Observer() {
    const batch = useDashboardPerformance(filters.startDate, filters.endDate)
    history.push({ isLoading: batch.isLoading, error: batch.error })
    return null
  }
  render(<SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>
    <ReportDataProvider value={{ performanceGroup: "outcomes" }}>
      <Observer /><Performance />
    </ReportDataProvider>
  </SWRConfig>)
  expectPending()
  expect(history[0]).toEqual({ isLoading: true, error: undefined })
  expect(history.every(state => state.isLoading && !state.error)).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => { request.resolve(failure) })
  expect(await screen.findByRole("alert")).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("retries a cached failure when re-entering even if another consumer remains mounted", async () => {
  let latest: ReturnType<typeof useDashboardPerformance>
  function MountedConsumer() {
    latest = useDashboardPerformance(filters.startDate, filters.endDate)
    return null
  }
  fetchMock.mockResolvedValueOnce(failure)
  const { rerender } = render(<Scope><MountedConsumer /></Scope>)
  await waitFor(() => expect(latest.error).toBeInstanceOf(Error))
  const retry = deferred()
  fetchMock.mockReturnValueOnce(retry.promise)
  rerender(<Scope><MountedConsumer /><Performance /></Scope>)
  expectPending()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  await act(async () => { retry.resolve(failure) })
  expect(await screen.findByRole("alert")).toBeInTheDocument()
  rerender(<Scope><MountedConsumer /><Performance /></Scope>)
  expect(screen.getByRole("alert")).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("does not show a previous scope's failure while the new site is loading", async () => {
  fetchMock.mockResolvedValueOnce(failure)
  const { rerender } = render(<Scope><Performance /></Scope>)
  expect(await screen.findByRole("alert")).toBeInTheDocument()
  jest.mocked(useSite).mockReturnValue({ currentSite: null, isLoading: true } as ReturnType<typeof useSite>)
  rerender(<Scope><Performance /></Scope>)
  expectPending()
  const request = deferred()
  fetchMock.mockReturnValueOnce(request.promise)
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: "site-b" }, isLoading: false } as ReturnType<typeof useSite>)
  rerender(<Scope><Performance /></Scope>)
  expectPending()
  await act(async () => { request.resolve(success()) })
  expect(await screen.findByText("Report figures")).toBeInTheDocument()
  expect(fetchMock.mock.calls[1][0]).toContain("siteId=site-b")
})

it("reveals currency choices only after the current failure settles and hides them during selection fetch", async () => {
  const initial = deferred()
  const selected = deferred()
  fetchMock.mockReturnValueOnce(initial.promise).mockReturnValueOnce(selected.promise)
  render(<Scope groups={{ overviewGroup: "summary" }}>
    <OverviewCurrencyScope enabled {...filters}>
      <OverviewDataBoundary {...filters}><div>Report figures</div></OverviewDataBoundary>
    </OverviewCurrencyScope>
  </Scope>)
  expectPending()
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  await act(async () => { initial.resolve({ ok: false, status: 422, json: async () => ({ availableCurrencies: ["EUR", "USD"] }) }) })
  expect(await screen.findByRole("combobox")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Select a reporting currency above")
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "EUR" } })
  expectPending()
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  await act(async () => { selected.resolve(success(Object.fromEntries(reportMetricKeys("overview", "summary")!.map(key => [key, { actual: 7 }])))) })
  expect(await screen.findByText("Report figures")).toBeInTheDocument()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
})

it.each(["cohort", "distribution"])("%s renders a skeleton during site readiness before its settled failure", async report => {
  jest.mocked(useSite).mockReturnValue({ currentSite: null, isLoading: true } as ReturnType<typeof useSite>)
  const page = () => <Scope>{report === "cohort" ? <CohortReport kind="leads" {...filters} />
    : <SegmentDonut endpoint="clients-by-segment" {...filters} variant="compact" />}</Scope>
  const { rerender } = render(page())
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
  expect(screen.queryByText(/Select a site/)).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
  const pending = deferred()
  fetchMock.mockReturnValueOnce(pending.promise)
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: "site-a" }, isLoading: false } as ReturnType<typeof useSite>)
  rerender(page())
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  await act(async () => { pending.resolve(failure) })
  expect(await screen.findByRole("alert")).toBeInTheDocument()
  const retry = deferred()
  fetchMock.mockReturnValueOnce(retry.promise)
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  await act(async () => { retry.resolve(failure) })
  expect(await screen.findByRole("alert")).toBeInTheDocument()
})