import React, { StrictMode } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { SessionEventsContainer } from "@/app/components/dashboard/traffic/session-events-container"

jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "member" }, isLoading: false }) }))
jest.mock("@/app/components/dashboard/traffic/session-events-chart", () => ({
  SessionEventsChart: ({ totals, error, loading }: { totals: { pageVisits: number }; error?: string; loading?: boolean }) => loading ? <div>Chart skeleton</div> : error
    ? <div role="alert">{error}</div> : <div>Visits: {totals.pageVisits}</div>,
}))
jest.mock("@/app/components/dashboard/traffic/session-events-referrers", () => ({
  SessionEventsReferrers: () => <div>Referrers</div>,
}))

const filters = { siteId: "site-a", startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 29, 23, 59, 59) }
const payload = (visits = 4) => ({ chartData: [{ date: "2026-09-01", label: "Sep 1", pageVisits: visits, uniqueVisitors: 1, referralVisits: 0 }],
  referrersData: [], totals: { pageVisits: visits, uniqueVisitors: 1, referralVisits: 0 } })
const ok = (visits = 4) => ({ ok: true, status: 200, json: async () => payload(visits) })
const failure = { ok: false, status: 500, json: async () => ({ error: "private database detail" }) }
const fetchMock = fetch as jest.Mock
function deferred() {
  let resolve!: (value: unknown) => void
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
function scope() {
  const cache = new Map()
  return (props = filters) => <SWRConfig value={{ provider: () => cache }}><StrictMode><SessionEventsContainer {...props} /></StrictMode></SWRConfig>
}
beforeEach(() => { fetchMock.mockReset() })

it("deduplicates the StrictMode mount that used to start two conflicting requests", async () => {
  const pending = deferred()
  fetchMock.mockReturnValue(pending.promise)
  render(scope()())
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("status", { name: "Loading session events" })).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  await act(async () => { pending.resolve(ok()) })
  expect(await screen.findByText("Visits: 4")).toBeInTheDocument()
})

it("sends the selected local calendar dates, not the next UTC day", async () => {
  fetchMock.mockResolvedValue(ok())
  render(scope()())
  await screen.findByText("Visits: 4")
  const url = new URL(fetchMock.mock.calls[0][0], "http://localhost")
  expect(url.searchParams.get("startDate")).toBe("2026-09-01")
  expect(url.searchParams.get("endDate")).toBe("2026-09-29")
})

it("ignores a late failed response for a previous date selection", async () => {
  const old = deferred()
  fetchMock.mockReturnValueOnce(old.promise).mockResolvedValue(ok(9))
  const ui = scope()
  const { rerender } = render(ui())
  rerender(ui({ ...filters, startDate: new Date(2026, 8, 2) }))
  await screen.findByText("Visits: 9")
  await act(async () => { old.resolve(failure) })
  expect(screen.getByText("Visits: 9")).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("shows one actionable settled error and clears it while retrying", async () => {
  fetchMock.mockResolvedValueOnce(failure)
  render(scope()())
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load session events")
  expect(screen.queryByText(/private database detail/)).not.toBeInTheDocument()
  const retry = deferred()
  fetchMock.mockReturnValueOnce(retry.promise)
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(screen.getByRole("status", { name: "Loading session events" })).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  await act(async () => { retry.resolve(ok()) })
  await screen.findByText("Visits: 4")
})

it("does not accept an incomplete successful body as zero visits", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
  render(scope()())
  expect(await screen.findByRole("alert")).toHaveTextContent("incomplete")
  expect(screen.queryByText("Visits: 0")).not.toBeInTheDocument()
})

it("settles a missing site without fetching or an endless skeleton", async () => {
  render(scope()({ ...filters, siteId: "default" }))
  await waitFor(() => expect(screen.getByText("Select a site to view session events.")).toBeInTheDocument())
  expect(fetchMock).not.toHaveBeenCalled()
})