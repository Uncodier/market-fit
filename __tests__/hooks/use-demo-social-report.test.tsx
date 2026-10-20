import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { subDays, addDays, startOfDay, endOfDay } from "date-fns"
import { availableDemos } from "@/lib/demo-data"
import { useSocialReport } from "@/app/components/dashboard/use-social-report"
import { AuthContext, type AuthContextValue } from "@/app/components/auth/auth-context"
import { getSocialPerformanceData, getTopCommentersData } from "@/app/components/dashboard/social-actions"
import { socialReportFixture } from "../components/dashboard/social-report-fixture"

let mockUser: { id: string } | null = null
let mockAuthLoading = false
let mockSiteLoading = false
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ isLoading: mockSiteLoading }) }))
jest.mock("@/app/components/dashboard/social-actions", () => ({
  getSocialPerformanceData: jest.fn(), getTopCommentersData: jest.fn(),
}))

const end = new Date()
const start = subDays(end, 29)

function wrapper() {
  const cache = new Map()
  return function Scope({ children }: { children: React.ReactNode }) {
    return <AuthContext.Provider value={{ user: mockUser, isLoading: mockAuthLoading } as AuthContextValue}>
      <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
    </AuthContext.Provider>
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUser = null
  mockAuthLoading = false
  mockSiteLoading = false
})

describe.each(availableDemos)("local Social hooks: $id", ({ id }) => {
  it.each(["summary", "networks", "posts"])("loads %s anonymously even during auth readiness", async section => {
    mockAuthLoading = true
    const { result } = renderHook(() => useSocialReport(id, start, end, section === "networks"), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.performance.data?.kpis.totalViews).toBeGreaterThan(0))
    expect(result.current.enabled).toBe(true)
    expect(result.current.authLoading).toBe(false)
    expect(result.current.signedOut).toBe(false)
    expect(result.current.performance.data?.trends.previous.views).toBeGreaterThan(0)
    expect(result.current.performance.data?.networks.length).toBeGreaterThan(0)
    expect(result.current.performance.data?.data.length).toBeGreaterThan(0)
    if (section === "networks") await waitFor(() => expect(result.current.commenters.data?.length).toBeGreaterThan(0))
    else expect(result.current.commenters.data).toBeUndefined()
    expect(getSocialPerformanceData).not.toHaveBeenCalled()
    expect(getTopCommentersData).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("keeps signed-in viewers and manual refresh entirely local", async () => {
    mockUser = { id: "signed-in-viewer" }
    const { result } = renderHook(() => useSocialReport(id, start, end, true), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.commenters.data?.length).toBeGreaterThan(0))
    await act(async () => { await result.current.performance.mutate(); await result.current.commenters.mutate() })
    expect(result.current.performance.data?.kpis.totalViews).toBeGreaterThan(0)
    expect(getSocialPerformanceData).not.toHaveBeenCalled()
    expect(getTopCommentersData).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("changes site/date/section keys without retaining old figures", async () => {
    const { result, rerender } = renderHook(({ siteId, from, to, include }) => useSocialReport(siteId, from, to, include), {
      wrapper: wrapper(), initialProps: { siteId: id, from: start, to: end, include: false },
    })
    await waitFor(() => expect(result.current.performance.data).toBeDefined())
    rerender({ siteId: id, from: start, to: end, include: true })
    await waitFor(() => expect(result.current.commenters.data?.length).toBeGreaterThan(0))
    rerender({ siteId: id, from: addDays(start, 1000), to: addDays(end, 1000), include: true })
    expect(result.current.performance.data).toBeUndefined()
    expect(result.current.commenters.data).toBeUndefined()
    await waitFor(() => expect(result.current.performance.data?.kpis.totalViews).toBe(0))
    await waitFor(() => expect(result.current.commenters.data).toEqual([]))
    const other = availableDemos.find(demo => demo.id !== id)!.id
    rerender({ siteId: other, from: start, to: end, include: true })
    expect(result.current.performance.data).toBeUndefined()
    await waitFor(() => expect(result.current.performance.data?.kpis.totalViews).toBeGreaterThan(0))
    expect(result.current.performance.data?.data.every(post => post.site_id === other)).toBe(true)
    expect(getSocialPerformanceData).not.toHaveBeenCalled()
    expect(getTopCommentersData).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})

it("waits for site hydration but ignores real auth readiness after demo selection", async () => {
  mockSiteLoading = true
  mockAuthLoading = true
  const { result, rerender } = renderHook(() => useSocialReport(availableDemos[0].id, start, end, true), { wrapper: wrapper() })
  expect(result.current.enabled).toBe(false)
  expect(result.current.performance.isLoading).toBe(true)
  expect(result.current.commenters.isLoading).toBe(true)
  expect(result.current.performance.data).toBeUndefined()
  mockSiteLoading = false
  rerender()
  await waitFor(() => expect(result.current.commenters.data?.length).toBeGreaterThan(0))
  expect(result.current.enabled).toBe(true)
  expect(result.current.authLoading).toBe(false)
  expect(getSocialPerformanceData).not.toHaveBeenCalled()
  expect(getTopCommentersData).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("retains real/unknown authenticated actions and removes demo data when signed out", async () => {
  const { result, rerender } = renderHook(({ siteId }) => useSocialReport(siteId, start, end, true), {
    wrapper: wrapper(), initialProps: { siteId: availableDemos[0].id },
  })
  await waitFor(() => expect(result.current.commenters.data?.length).toBeGreaterThan(0))
  for (const siteId of ["demo-unknown", "real-site"]) {
    rerender({ siteId })
    expect(result.current.signedOut).toBe(true)
    expect(result.current.enabled).toBe(false)
    expect(result.current.performance.data).toBeUndefined()
    expect(result.current.commenters.data).toBeUndefined()
  }
  expect(getSocialPerformanceData).not.toHaveBeenCalled()
  expect(getTopCommentersData).not.toHaveBeenCalled()
  mockUser = { id: "real-user" }
  const realData = socialReportFixture(777)
  jest.mocked(getSocialPerformanceData).mockResolvedValue(realData)
  jest.mocked(getTopCommentersData).mockResolvedValue({ data: [{ id: "real-author", name: "Real author", avatar: null, count: 4 }] })
  for (const siteId of ["real-site", "demo-unknown"]) {
    rerender({ siteId })
    await waitFor(() => expect(result.current.performance.data).toEqual(realData))
    await waitFor(() => expect(result.current.commenters.data?.[0].id).toBe("real-author"))
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(getSocialPerformanceData).toHaveBeenCalledWith(siteId, startOfDay(start), endOfDay(end), timeZone)
    expect(getTopCommentersData).toHaveBeenCalledWith(siteId, startOfDay(start), endOfDay(end), timeZone)
  }
  expect(getSocialPerformanceData).toHaveBeenCalledTimes(2)
  expect(getTopCommentersData).toHaveBeenCalledTimes(2)
  expect(fetch).not.toHaveBeenCalled()
})

it("settles missing and invalid dates without actions, and oversized ranges as local errors", async () => {
  const { result, rerender } = renderHook(({ siteId, from }) => useSocialReport(siteId, from, end, true), {
    wrapper: wrapper(), initialProps: { siteId: undefined as string | undefined, from: start },
  })
  expect(result.current.enabled).toBe(false)
  rerender({ siteId: availableDemos[0].id, from: new Date(NaN) })
  expect(result.current.invalidDates).toBe(true)
  expect(result.current.enabled).toBe(false)
  rerender({ siteId: availableDemos[0].id, from: addDays(end, 1) })
  expect(result.current.invalidDates).toBe(true)
  rerender({ siteId: availableDemos[0].id, from: subDays(end, 366) })
  await waitFor(() => expect(result.current.performance.error?.message).toContain("too large"))
  await waitFor(() => expect(result.current.commenters.error?.message).toContain("too large"))
  expect(result.current.performance.data).toBeUndefined()
  expect(result.current.commenters.data).toBeUndefined()
  expect(getSocialPerformanceData).not.toHaveBeenCalled()
  expect(getTopCommentersData).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})