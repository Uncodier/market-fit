import React, { useLayoutEffect } from "react"
import { act, render, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { AuthContext, type AuthContextValue } from "@/app/components/auth/auth-context"
import { useSite } from "@/app/context/SiteContext"
import { useRecentActivityReport } from "@/app/components/dashboard/use-recent-activity-report"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))

const auth = { user: { id: "user-a" }, isLoading: false } as AuthContextValue
const activity = { id: "activity-a", kind: "sale", date: "2026-01-02", user: { name: "Customer" } }
const fetchMock = jest.mocked(fetch)
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response
let report: ReturnType<typeof useRecentActivityReport>

function Resource() {
  const result = useRecentActivityReport(6, new Date(2026, 0, 1), new Date(2026, 0, 31))
  useLayoutEffect(() => { report = result }, [result])
  return null
}

function setup(identity = auth) {
  return render(<AuthContext.Provider value={identity}>
    <SWRConfig value={{ provider: () => new Map() }}><Resource /></SWRConfig>
  </AuthContext.Provider>)
}

beforeEach(() => {
  fetchMock.mockReset()
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: "site-a" }, isLoading: false } as ReturnType<typeof useSite>)
})

it("keeps the loaded feed site-wide with its exact selected dates and limit", async () => {
  fetchMock.mockResolvedValue(response({ activities: [activity] }))
  setup()
  await waitFor(() => expect(report.data?.activities).toEqual([activity]))
  const url = new URL(String(fetchMock.mock.calls[0][0]), "http://localhost")
  expect(Object.fromEntries(url.searchParams)).toEqual({ siteId: "site-a", limit: "6", startDate: "2026-01-01", endDate: "2026-01-31" })
})

it.each([response({}, false), response({}), response({ activities: [{ id: "broken" }] })])(
  "keeps a failed or malformed feed unavailable instead of an empty success", async failure => {
    fetchMock.mockResolvedValue(failure)
    setup()
    await waitFor(() => expect(report.error).toBeDefined())
    expect(report.data).toBeUndefined()
  },
)

it("clears loaded data while retrying and accepts a genuine empty result", async () => {
  fetchMock.mockResolvedValueOnce(response({ activities: [activity] }))
  setup()
  await waitFor(() => expect(report.data?.activities).toHaveLength(1))
  let resolve!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise(done => { resolve = done }))
  act(() => { void report.mutate() })
  expect(report.isLoading).toBe(true)
  expect(report.data).toBeUndefined()
  await act(async () => { resolve(response({ activities: [] })) })
  await waitFor(() => expect(report.data?.activities).toEqual([]))
})

it("does not fetch when signed out", () => {
  setup({ ...auth, user: null })
  expect(fetchMock).not.toHaveBeenCalled()
  expect(report.data).toBeUndefined()
})