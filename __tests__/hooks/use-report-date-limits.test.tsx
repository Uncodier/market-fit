import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { useReportDateLimits } from "@/app/dashboard/use-report-date-limits"
import { reportDateLimits } from "@/lib/dashboard/report-date-limits"

let mockUser: { id: string } | null = { id: "member" }
let mockAuthLoading = false
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: mockUser, isLoading: mockAuthLoading }) }))
const fetchMock = fetch as jest.Mock
function wrapper() {
  const cache = new Map()
  return function Scope({ children }: { children: React.ReactNode }) {
    return <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
  }
}
beforeEach(() => { fetchMock.mockReset(); mockUser = { id: "member" }; mockAuthLoading = false })

it("loads server limits once per identity/site and selects section constraints without another request", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ limits: reportDateLimits(31) }) })
  const { result, rerender } = renderHook(({ section }) => useReportDateLimits("site-a", "costs", section), {
    wrapper: wrapper(), initialProps: { section: "summary" },
  })
  expect(result.current.isLoading).toBe(true)
  expect(result.current.maxRangeDays).toBeUndefined()
  await waitFor(() => expect(result.current.maxRangeDays).toBe(31))
  rerender({ section: "categories" })
  expect(result.current.maxRangeDays).toBe(366)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toBe("/api/dashboard/date-limits?siteId=site-a")
})

it("waits for auth and settles signed-out without a request", () => {
  mockUser = null
  mockAuthLoading = true
  const { result, rerender } = renderHook(() => useReportDateLimits("site-a", "sales", "summary"), { wrapper: wrapper() })
  expect(result.current.isLoading).toBe(true)
  expect(fetchMock).not.toHaveBeenCalled()
  mockAuthLoading = false
  rerender()
  expect(result.current.isLoading).toBe(false)
  expect(result.current.signedOut).toBe(true)
})

it("rejects malformed limits instead of enabling unbounded dates, and retries", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ limits: {} }) })
  const { result } = renderHook(() => useReportDateLimits("site-a", "sales", "summary"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.error?.message).toContain("incomplete"))
  expect(result.current.maxRangeDays).toBeUndefined()
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ limits: reportDateLimits(30) }) })
  await act(async () => { await result.current.mutate() })
  expect(result.current.maxRangeDays).toBe(30)
  expect(result.current.error).toBeUndefined()
})