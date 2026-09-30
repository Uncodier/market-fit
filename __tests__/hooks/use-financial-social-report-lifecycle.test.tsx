import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig, unstable_serialize } from "swr"
import { startOfDay, endOfDay } from "date-fns"
import { AuthContext, type AuthContextValue } from "@/app/components/auth/auth-context"
import { useSalesReport, salesReportUrl } from "@/app/components/dashboard/sales/use-sales-report"
import { useCostReport } from "@/app/components/dashboard/use-cost-report"
import { useSocialReport } from "@/app/components/dashboard/use-social-report"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { useWidgetContext } from "@/app/context/WidgetContext"
import { getSocialPerformanceData, getTopCommentersData } from "@/app/components/dashboard/social-actions"
import { socialReportFixture } from "../components/dashboard/social-report-fixture"

jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: jest.fn() }))
jest.mock("@/app/components/dashboard/social-actions", () => ({ getSocialPerformanceData: jest.fn(), getTopCommentersData: jest.fn() }))

const start = new Date(2026, 0, 1)
const end = new Date(2026, 0, 31)
const fetchMock = fetch as jest.Mock
const costData = { totalCosts: { actual: 7 }, costCategories: [], monthlyData: [], costDistribution: [], currency: "EUR" }
const salesData = { totalSales: { actual: 7 }, metadata: {}, transactions: {}, monthlyData: [], currency: "EUR" }
const socialData = socialReportFixture(7)
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
const fail = { ok: false, status: 500, json: async () => ({}) }
let auth: AuthContextValue

function deferred() {
  let resolve!: (value: unknown) => void
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
function setAuth(userId: string | null, isLoading = false) {
  auth = { user: userId ? { id: userId } : null, isLoading } as AuthContextValue
  jest.mocked(useAuth).mockReturnValue(auth)
}
function setSite(isLoading: boolean, id: string | null = "site-a") {
  jest.mocked(useSite).mockReturnValue({ currentSite: id ? { id } : null, isLoading } as ReturnType<typeof useSite>)
}
function wrapper(cache = new Map()) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <AuthContext.Provider value={auth}><SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig></AuthContext.Provider>
  }
}
function useReport(kind: "sales" | "cost" | "social", siteId: string | undefined) {
  const sales = useSalesReport(kind === "sales" ? start : new Date(NaN), end, "all", "", false)
  const costs = useCostReport(kind === "cost" ? siteId : undefined, start, end, "all", "all", false)
  const social = useSocialReport(kind === "social" ? siteId : undefined, start, end, false)
  return kind === "sales" ? sales : kind === "cost" ? costs.costs : social.performance
}
const kinds = ["sales", "cost", "social"] as const
const expected = (kind: typeof kinds[number]) => kind === "sales" ? salesData : kind === "cost" ? costData : socialData
function cachedKey(kind: typeof kinds[number]) {
  if (kind === "sales") return ["user-a", salesReportUrl("site-a", start, end, "all", "", false)]
  if (kind === "cost") return ["/api/costs?siteId=site-a&startDate=2026-01-01&endDate=2026-01-31", "user-a"]
  return ["social-performance", "site-a", startOfDay(start).getTime(), endOfDay(end).getTime(), Intl.DateTimeFormat().resolvedOptions().timeZone, "user-a"]
}

beforeEach(() => {
  jest.resetAllMocks()
  setAuth("user-a")
  setSite(false)
  jest.mocked(useWidgetContext).mockReturnValue({ shouldExecuteWidgets: true, currentRoute: "/dashboard" })
  fetchMock.mockImplementation(async (url: string) => ok(url.startsWith("/api/costs") ? costData : salesData))
  jest.mocked(getSocialPerformanceData).mockResolvedValue(socialData)
  jest.mocked(getTopCommentersData).mockResolvedValue({ data: [] })
})

it.each(kinds)("%s starts pending through auth and site hydration without fetching", async kind => {
  setAuth(null, true)
  setSite(true, null)
  const { result, rerender } = renderHook(() => useReport(kind, "site-a"), { wrapper: wrapper() })
  expect(result.current.isLoading).toBe(true)
  expect(result.current.error).toBeUndefined()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(getSocialPerformanceData).not.toHaveBeenCalled()
  setAuth("user-a")
  rerender()
  expect(result.current.isLoading).toBe(true)
  expect(fetchMock).not.toHaveBeenCalled()
  setSite(false)
  rerender()
  await waitFor(() => expect(result.current.data).toEqual(expected(kind)))
})

it("sales waits for widget readiness rather than declaring unavailable", async () => {
  jest.mocked(useWidgetContext).mockReturnValue({ shouldExecuteWidgets: false, currentRoute: "/dashboard" })
  const { result, rerender } = renderHook(() => useSalesReport(start, end, "all", "", false), { wrapper: wrapper() })
  expect(result.current.isLoading).toBe(true)
  expect(result.current.enabled).toBe(false)
  expect(fetchMock).not.toHaveBeenCalled()
  jest.mocked(useWidgetContext).mockReturnValue({ shouldExecuteWidgets: true, currentRoute: "/dashboard" })
  rerender()
  await waitFor(() => expect(result.current.data).toEqual(salesData))
})

it.each(kinds)("%s settles signed-out or missing-site state without an endless skeleton", kind => {
  setAuth(null)
  const { result, rerender } = renderHook(({ siteId }) => useReport(kind, siteId), {
    wrapper: wrapper(), initialProps: { siteId: "site-a" as string | undefined },
  })
  expect(result.current.isLoading).toBe(false)
  expect(result.current.data).toBeUndefined()
  expect(fetchMock).not.toHaveBeenCalled()
  setAuth("user-a")
  setSite(false, null)
  rerender({ siteId: undefined })
  expect(result.current.isLoading).toBe(false)
  expect(getSocialPerformanceData).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each(kinds)("%s suppresses a cached failure on its first render, retries once and settles", async kind => {
  const cache = new Map([[unstable_serialize(cachedKey(kind)), {
    data: expected(kind), error: new Error("Cached failure"), isLoading: false, isValidating: false,
  }]])
  const pending = deferred()
  if (kind === "social") jest.mocked(getSocialPerformanceData).mockReturnValue(pending.promise as ReturnType<typeof getSocialPerformanceData>)
  else fetchMock.mockImplementation((url: string) => url.startsWith(kind === "cost" ? "/api/costs" : "/api/revenue") ? pending.promise : Promise.resolve(ok(salesData)))
  const history: { loading: boolean; error: unknown }[] = []
  const { result } = renderHook(() => {
    const resource = useReport(kind, "site-a")
    history.push({ loading: resource.isLoading, error: resource.error })
    return resource
  }, { wrapper: wrapper(cache) })
  expect(history[0]).toEqual({ loading: true, error: undefined })
  expect(result.current.isLoading).toBe(true)
  expect(result.current.data).toBeUndefined()
  expect(result.current.error).toBeUndefined()
  await act(async () => { pending.resolve(kind === "social" ? { error: "failed" } : fail) })
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
  expect(result.current.isLoading).toBe(false)
  const retry = deferred()
  if (kind === "social") jest.mocked(getSocialPerformanceData).mockReturnValueOnce(retry.promise as ReturnType<typeof getSocialPerformanceData>)
  else fetchMock.mockReturnValueOnce(retry.promise)
  act(() => { void result.current.mutate() })
  expect(result.current.isLoading).toBe(true)
  expect(result.current.error).toBeUndefined()
  expect(result.current.data).toBeUndefined()
  await act(async () => { retry.resolve(kind === "social" ? socialData : ok(expected(kind))) })
  await waitFor(() => expect(result.current.data).toEqual(expected(kind)))
  const calls = kind === "social" ? jest.mocked(getSocialPerformanceData).mock.calls : fetchMock.mock.calls.filter(([url]: [string]) => url.startsWith(kind === "cost" ? "/api/costs" : "/api/revenue"))
  expect(calls).toHaveLength(2)
})

it("cost revenue waits for settled cost currency and retries without hiding cost data", async () => {
  const costs = deferred()
  fetchMock.mockReturnValueOnce(costs.promise)
  const { result } = renderHook(() => useCostReport("site-a", start, end, "all", "all", true), { wrapper: wrapper() })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(result.current.revenue.isLoading).toBe(true)
  fetchMock.mockResolvedValueOnce(fail)
  await act(async () => { costs.resolve(ok(costData)) })
  await waitFor(() => expect(result.current.revenue.error).toBeInstanceOf(Error))
  expect(fetchMock.mock.calls[1][0]).toContain("currency=EUR")
  expect(result.current.costs.data).toEqual(costData)
  const revenue = deferred()
  fetchMock.mockReturnValueOnce(revenue.promise)
  act(() => { void result.current.revenue.mutate() })
  expect(result.current.revenue.isLoading).toBe(true)
  expect(result.current.revenue.error).toBeUndefined()
  expect(result.current.costs.data).toEqual(costData)
  await act(async () => { revenue.resolve(ok(salesData)) })
  await waitFor(() => expect(result.current.revenue.data).toEqual(salesData))
})

it("social commenters stay disabled when not requested and retry independently when requested", async () => {
  const { result, rerender } = renderHook(({ include }) => useSocialReport("site-a", start, end, include), {
    wrapper: wrapper(), initialProps: { include: false },
  })
  await waitFor(() => expect(result.current.performance.data).toEqual(socialData))
  expect(result.current.commenters.isLoading).toBe(false)
  expect(getTopCommentersData).not.toHaveBeenCalled()
  jest.mocked(getTopCommentersData).mockResolvedValueOnce({ data: [], error: "failed" })
  rerender({ include: true })
  await waitFor(() => expect(result.current.commenters.error).toBeInstanceOf(Error))
  const retry = deferred()
  jest.mocked(getTopCommentersData).mockReturnValueOnce(retry.promise as ReturnType<typeof getTopCommentersData>)
  act(() => { void result.current.commenters.mutate() })
  expect(result.current.commenters.isLoading).toBe(true)
  expect(result.current.commenters.error).toBeUndefined()
  expect(result.current.performance.data).toEqual(socialData)
  await act(async () => { retry.resolve({ data: [] }) })
  await waitFor(() => expect(result.current.commenters.data).toEqual([]))
})

it("costs partition cached data by authenticated identity without sending that identity", async () => {
  const { result, rerender } = renderHook(() => useCostReport("site-a", start, end, "all", "all", false), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.costs.data).toEqual(costData))
  const request = deferred()
  fetchMock.mockReturnValueOnce(request.promise)
  setAuth("user-b")
  rerender()
  expect(result.current.costs.isLoading).toBe(true)
  expect(result.current.costs.data).toBeUndefined()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[1][0]).not.toContain("user-b")
  await act(async () => { request.resolve(ok(costData)) })
  await waitFor(() => expect(result.current.costs.data).toEqual(costData))
})