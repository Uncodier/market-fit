import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { StartupTrialCard } from "@/app/components/billing/startup-trial-card"
import { useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { STARTUP_TRIAL_REQUEST_TIMEOUT_MS, STARTUP_TRIAL_REFRESH_TIMEOUT_MS } from "@/app/services/startup-trial"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn() }))
jest.mock("@/app/components/ui/use-btn-glass-motion", () => ({ useBtnGlassMotion: () => () => undefined }))

const siteId = "11111111-1111-4111-8111-111111111111"
const otherSiteId = "22222222-2222-4222-8222-222222222222"
const now = "2026-10-19T12:00:00.000Z"
const eligible = { success: true, state: "eligible", started_at: null, ends_at: null, credits_remaining: 0, server_now: now }
const active = { ...eligible, state: "active", started_at: now, ends_at: "2026-11-03T12:00:00.000Z", credits_remaining: 50 }
const expired = { ...active, state: "expired", credits_remaining: 0, server_now: active.ends_at }
const fetchMock = jest.fn()
const refreshSiteBilling = jest.fn()
const originalFetch = global.fetch
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response
const flush = () => act(async () => { await Promise.resolve() })
const start = () => screen.getByRole("button", { name: "Start 15-day Startup trial" })
const signal = (index: number): AbortSignal => fetchMock.mock.calls[index][1].signal

function permission(role = "owner", update = true, scope = siteId, isOwner = role === "owner") {
  jest.mocked(useOptionalPermissions).mockReturnValue({
    siteId: scope, capabilities: { role, is_owner: isOwner, update, insert: false },
    can: (command: string) => command === "update" && update,
  } as never)
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}
async function mount(body: unknown = eligible) {
  fetchMock.mockResolvedValueOnce(response(body))
  const view = render(<StartupTrialCard siteId={siteId} />)
  await flush()
  return view
}

beforeEach(() => {
  fetchMock.mockReset().mockRejectedValue(new Error("Unexpected offline request"))
  refreshSiteBilling.mockReset().mockResolvedValue(undefined)
  global.fetch = fetchMock
  jest.mocked(useSite).mockReturnValue({ refreshSiteBilling } as never)
  permission()
})
afterEach(() => { cleanup(); global.fetch = originalFetch; jest.useRealTimers() })

it("never starts on mount and explains no-card, one-time, nonrenewing credits and Foundry naming", async () => {
  await mount()
  expect(start()).toBeEnabled()
  expect(screen.getByText(/50 one-time credits total/)).toHaveTextContent("not a monthly allowance")
  expect(screen.getByText(/No card required/)).toHaveTextContent("No automatic billing")
  expect(screen.getByText(/current interface calls this plan Foundry/)).toBeVisible()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][1].method).toBe("GET")
  expect(refreshSiteBilling).not.toHaveBeenCalled()
})

it.each(["owner", "admin"])("starts only on explicit %s click, even without insert capability", async role => {
  permission(role)
  await mount()
  const post = deferred<Response>()
  fetchMock.mockReturnValueOnce(post.promise)
  const button = start()
  fireEvent.click(button)
  fireEvent.click(button)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(button).toBeDisabled()
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ site_id: siteId })
  post.resolve(response({ ...active, outcome: "started" }))
  await flush()
  expect(screen.getByText("Startup trial is active")).toBeVisible()
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
  expect(screen.queryByRole("button", { name: /Start 15-day/ })).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
    `/api/billing/startup-trial?site_id=${siteId}`, "/api/billing/startup-trial",
  ])
})

it.each([
  ["collaborator", true, siteId], ["marketing", true, siteId],
  ["owner", false, siteId], ["admin", false, siteId], ["owner", true, otherSiteId],
])("denies activation for %s update=%s scope=%s", async (role, update, scope) => {
  permission(String(role), Boolean(update), String(scope))
  await mount()
  expect(start()).toBeDisabled()
  fireEvent.click(start())
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/Ask a site owner or admin/)).toBeVisible()
})

it.each([null, { siteId, capabilities: null, can: () => true }])("fails closed while permissions are unavailable: %j", async permissions => {
  jest.mocked(useOptionalPermissions).mockReturnValue(permissions as never)
  await mount()
  expect(start()).toBeDisabled()
})

it("allows an actual site owner with a different membership role and update capability", async () => {
  permission("collaborator", true, siteId, true)
  await mount()
  expect(start()).toBeEnabled()
})

it("rechecks live permissions before a click after capability loss", async () => {
  const view = await mount()
  permission("owner", false)
  view.rerender(<StartupTrialCard siteId={siteId} />)
  fireEvent.click(start())
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each(["collaborator", "marketing"])("shows active read-only countdown to %s using server time rather than local clock", async role => {
  jest.useFakeTimers().setSystemTime(new Date("2030-01-01T00:00:00Z"))
  permission(role, false)
  await mount(active)
  expect(screen.getByLabelText("Trial time remaining")).toHaveTextContent("15d 0h 0m remaining")
  expect(screen.getByText("Trial credits remaining: 50 of 50")).toBeVisible()
  expect(screen.queryByRole("button", { name: /Start 15-day/ })).not.toBeInTheDocument()
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
})

it("re-reads and refreshes billing at expiration without activation or Stripe navigation", async () => {
  jest.useFakeTimers().setSystemTime(new Date("2030-01-01T00:00:00Z"))
  await mount({ ...active, server_now: "2026-11-03T11:59:59.000Z" })
  fetchMock.mockResolvedValueOnce(response(expired))
  await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[1][1].method).toBe("GET")
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
  expect(screen.getByRole("link", { name: /View paid Startup/ })).toHaveAttribute("href", "#subscription-plan")
  expect(screen.queryByRole("button", { name: /Start 15-day/ })).not.toBeInTheDocument()
})

it("checks actual time on focus after sleep and reconciles expired billing", async () => {
  jest.useFakeTimers().setSystemTime(new Date(now))
  await mount(active)
  fetchMock.mockResolvedValueOnce(response(expired))
  jest.setSystemTime(new Date(active.ends_at))
  fireEvent(window, new Event("focus"))
  await flush()
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
  expect(screen.getByText(/Your Startup trial has ended/)).toBeVisible()
})

it("checks expiration on visibility return and fails closed if reconciliation is unavailable", async () => {
  jest.useFakeTimers().setSystemTime(new Date(now))
  await mount(active)
  fetchMock.mockResolvedValueOnce(response({ success: false, error: { code: "UNAVAILABLE", message: "Private" } }, false))
  jest.setSystemTime(new Date(active.ends_at))
  fireEvent(document, new Event("visibilitychange"))
  await flush()
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
  expect(screen.getByRole("alert")).toHaveTextContent("currently unavailable")
  expect(screen.queryByLabelText("Trial time remaining")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Start 15-day/ })).not.toBeInTheDocument()
  expect(fetchMock.mock.calls[1][1].method).toBe("GET")
})

it("shows a distinct billing warning after expired reconciliation refresh fails", async () => {
  jest.useFakeTimers().setSystemTime(new Date(now))
  await mount({ ...active, server_now: "2026-11-03T11:59:59.000Z" })
  fetchMock.mockResolvedValueOnce(response(expired))
  refreshSiteBilling.mockRejectedValueOnce(new Error("Private billing failure"))
  await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
  expect(screen.getByRole("alert")).toHaveTextContent("Trial status was checked, but billing information could not be refreshed")
  expect(screen.getByRole("link", { name: /View paid Startup/ })).toHaveAttribute("href", "#subscription-plan")
  fireEvent.click(screen.getByRole("button", { name: "Reload billing information" }))
  await flush()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(refreshSiteBilling).toHaveBeenCalledTimes(3)
})

it("limits boundary reconciliation retries when the server still reports active", async () => {
  jest.useFakeTimers().setSystemTime(new Date(now))
  const boundary = { ...active, server_now: "2026-11-03T11:59:59.000Z" }
  await mount(boundary)
  fetchMock.mockResolvedValue(response(boundary))
  await act(async () => { await jest.advanceTimersByTimeAsync(10_000) })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(refreshSiteBilling).toHaveBeenCalledTimes(2)
})

it.each(["started", "already_started"])("keeps confirmed %s separate from failed billing refresh, and retries only refresh", async outcome => {
  await mount()
  fetchMock.mockResolvedValueOnce(response({ ...active, outcome }))
  refreshSiteBilling.mockRejectedValueOnce(new Error("Private read details"))
  fireEvent.click(start())
  await flush()
  expect(screen.getByRole("alert")).toHaveTextContent("Trial activation is confirmed, but billing information could not be refreshed")
  expect(screen.getByRole("alert")).not.toHaveTextContent("Private read details")
  fireEvent.click(screen.getByRole("button", { name: "Reload billing information" }))
  await flush()
  expect(refreshSiteBilling).toHaveBeenCalledTimes(2)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("bounds hanging billing refresh without restarting a confirmed trial", async () => {
  jest.useFakeTimers()
  await mount()
  fetchMock.mockResolvedValueOnce(response({ ...active, outcome: "started" }))
  refreshSiteBilling.mockReturnValue(new Promise<never>(() => {}))
  fireEvent.click(start())
  await flush()
  await act(async () => { await jest.advanceTimersByTimeAsync(STARTUP_TRIAL_REFRESH_TIMEOUT_MS) })
  expect(screen.getByRole("alert")).toHaveTextContent("do not restart the trial")
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(screen.getByRole("button", { name: "Reload billing information" })).toBeEnabled()
})

it("requires a status GET after an ambiguous POST timeout and never automatically replays POST", async () => {
  jest.useFakeTimers()
  await mount()
  fetchMock.mockReturnValueOnce(new Promise<never>(() => {}))
  fireEvent.click(start())
  await act(async () => { await jest.advanceTimersByTimeAsync(STARTUP_TRIAL_REQUEST_TIMEOUT_MS) })
  expect(signal(1).aborted).toBe(true)
  expect(screen.getByRole("alert")).toHaveTextContent("may already have started")
  expect(screen.queryByRole("button", { name: /Start 15-day/ })).not.toBeInTheDocument()
  fetchMock.mockResolvedValueOnce(response(active))
  fireEvent.click(screen.getByRole("button", { name: "Reload trial status" }))
  await flush()
  expect(fetchMock.mock.calls[2][1].method).toBe("GET")
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(screen.getByText("Startup trial is active")).toBeVisible()
  expect(refreshSiteBilling).toHaveBeenCalledTimes(1)
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
})

it("offers refresh-only recovery when a recovered active trial cannot hydrate billing", async () => {
  await mount()
  fetchMock.mockRejectedValueOnce(new Error("Activation response lost"))
  fireEvent.click(start())
  await flush()
  expect(screen.getByRole("alert")).toHaveTextContent("may already have started")
  fetchMock.mockResolvedValueOnce(response(active))
  refreshSiteBilling.mockRejectedValueOnce(new Error("Billing unavailable"))
  fireEvent.click(screen.getByRole("button", { name: "Reload trial status" }))
  await flush()
  expect(screen.getByText("Startup trial is active")).toBeVisible()
  expect(screen.getByRole("alert")).toHaveTextContent("billing information could not be refreshed")
  expect(screen.queryByRole("button", { name: /Start 15-day/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Reload billing information" }))
  await flush()
  expect(refreshSiteBilling).toHaveBeenCalledTimes(2)
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("bounds the initial availability request and offers only a status retry", async () => {
  jest.useFakeTimers()
  fetchMock.mockReturnValue(new Promise<never>(() => {}))
  render(<StartupTrialCard siteId={siteId} />)
  expect(screen.getByRole("status")).toHaveTextContent("Checking trial availability")
  await act(async () => { await jest.advanceTimersByTimeAsync(STARTUP_TRIAL_REQUEST_TIMEOUT_MS) })
  expect(screen.getByRole("alert")).toHaveTextContent("currently unavailable")
  expect(screen.getByRole("button", { name: "Reload trial status" })).toBeEnabled()
  expect(signal(0).aborted).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("treats a malformed POST success as unconfirmed and does not refresh billing", async () => {
  await mount()
  fetchMock.mockResolvedValueOnce(response({ success: true, outcome: "started" }))
  fireEvent.click(start())
  await flush()
  expect(screen.getByRole("alert")).toHaveTextContent("activation could not be confirmed")
  expect(refreshSiteBilling).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: /Start 15-day/ })).not.toBeInTheDocument()
})

it.each([{}, { ...eligible, state: "nonsense" }, { success: false, error: { code: "MISSING_SCHEMA", message: "Private details" } }])(
  "fails closed for an API/schema failure %j", async body => {
    await mount(body)
    expect(screen.getByRole("alert")).toHaveTextContent("currently unavailable")
    expect(screen.queryByRole("button", { name: /Start 15-day/ })).not.toBeInTheDocument()
  },
)

it("offers an expired paid-plan anchor only, without fetching a checkout", async () => {
  await mount(expired)
  fireEvent.click(screen.getByRole("link", { name: /View paid Startup/ }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
})

it("offers paid conversion while the trial is active without starting Checkout automatically", async () => {
  await mount(active)
  expect(screen.getByRole("link", { name: /View paid Startup/ })).toHaveAttribute("href", "#subscription-plan")
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][1].method).toBe("GET")
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
})

it.each(["converted", "unavailable"])("never offers activation for %s", async state => {
  await mount(state === "converted" ? { ...expired, state } : { ...eligible, state, reason: "Safe reason" })
  expect(screen.queryByRole("button", { name: /Start 15-day/ })).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("aborts site-change GET and ignores late responses even when transport ignores abort", async () => {
  const previous = deferred<Response>()
  fetchMock.mockReturnValueOnce(previous.promise)
  const view = render(<StartupTrialCard siteId={siteId} />)
  fetchMock.mockResolvedValueOnce(response({ ...eligible, state: "unavailable" }))
  view.rerender(<StartupTrialCard siteId={otherSiteId} />)
  expect(signal(0).aborted).toBe(true)
  await flush()
  previous.resolve(response(eligible))
  await flush()
  expect(screen.getByText(/Activation is disabled/)).toBeVisible()
  expect(screen.queryByRole("button", { name: /Start 15-day/ })).not.toBeInTheDocument()
})

it("aborts a pending site-change POST, ignores its success, and does not refresh the old site", async () => {
  const view = await mount()
  const post = deferred<Response>()
  fetchMock.mockReturnValueOnce(post.promise)
  fireEvent.click(start())
  fetchMock.mockResolvedValueOnce(response({ ...eligible, state: "unavailable" }))
  view.rerender(<StartupTrialCard siteId={otherSiteId} />)
  post.resolve(response({ ...active, outcome: "started" }))
  await flush()
  expect(signal(1).aborted).toBe(true)
  expect(refreshSiteBilling).not.toHaveBeenCalled()
  expect(screen.queryByText("Startup trial is active")).not.toBeInTheDocument()
})

it("ignores late refresh failure after switching sites", async () => {
  const view = await mount()
  const pending = deferred<void>()
  refreshSiteBilling.mockReturnValueOnce(pending.promise)
  fetchMock.mockResolvedValueOnce(response({ ...active, outcome: "started" }))
  fireEvent.click(start())
  await flush()
  fetchMock.mockResolvedValueOnce(response({ ...eligible, state: "unavailable" }))
  view.rerender(<StartupTrialCard siteId={otherSiteId} />)
  await flush()
  pending.resolve(undefined)
  await flush()
  expect(signal(1).aborted).toBe(true)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.getByText(/Activation is disabled/)).toBeVisible()
})

it("aborts and clears a hanging request on unmount", async () => {
  jest.useFakeTimers()
  fetchMock.mockReturnValue(new Promise<never>(() => {}))
  const view = render(<StartupTrialCard siteId={siteId} />)
  view.unmount()
  await flush()
  await act(async () => { await jest.advanceTimersByTimeAsync(0) })
  expect(signal(0).aborted).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
})