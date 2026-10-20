import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { StartupTrialWidget } from "@/app/components/navigation/StartupTrialWidget"
import { CreditsWidget } from "@/app/components/navigation/CreditsWidget"
import { useOptionalSite, useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { STARTUP_TRIAL_REQUEST_TIMEOUT_MS } from "@/app/services/startup-trial"
import { navigateOrAssign } from "@/lib/navigation/stale-router"
import type { Site } from "@/app/context/site-types"
import type { SiteMemberRole } from "@/lib/permissions/types"

jest.mock("@/app/context/SiteContext", () => ({ useOptionalSite: jest.fn(), useSite: jest.fn() }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn() }))
jest.mock("@/lib/navigation/stale-router", () => ({ navigateOrAssign: jest.fn() }))
jest.mock("@/app/components/ui/use-btn-glass-motion", () => ({ useBtnGlassMotion: () => () => undefined }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))

const siteId = "11111111-1111-4111-8111-111111111111"
const otherSiteId = "22222222-2222-4222-8222-222222222222"
const now = "2026-10-19T12:00:00.000Z"
const eligible = { success: true, state: "eligible", offer_eligible: true,
  started_at: null, ends_at: null, credits_remaining: 0, server_now: now }
const active = { ...eligible, state: "active", offer_eligible: false, started_at: now,
  ends_at: "2026-11-03T12:00:00.000Z", credits_remaining: 50 }
const fetchMock = jest.fn()
const originalFetch = global.fetch
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response
let currentSite: Pick<Site, "id" | "billing" | "billing_read_status">

function site(billing: Partial<NonNullable<Site["billing"]>> = {}, id = siteId) {
  currentSite = { id, billing_read_status: "loaded", billing: {
    plan: "commission", addons_count: 0, auto_renew: false, credits_available: 1,
    account_balance: 0, trial_started_at: null, trial_ends_at: null, trial_converted_at: null, ...billing,
  } }
  applySite()
}
function applySite() {
  const context = { currentSite } as never
  jest.mocked(useOptionalSite).mockReturnValue(context)
  jest.mocked(useSite).mockReturnValue(context)
}
function permission(role: SiteMemberRole = "owner", update = true, scope = siteId, isOwner = role === "owner") {
  jest.mocked(useOptionalPermissions).mockReturnValue({ siteId: scope,
    capabilities: { role, is_owner: isOwner, update, insert: false, select: true, delete: false },
    can: () => true, isViewOnly: false,
  })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}
const advance = (ms = 1000) => act(async () => { await jest.advanceTimersByTimeAsync(ms) })
const flush = () => act(async () => { await Promise.resolve() })
const target = (id = siteId) => `/billing?siteId=${encodeURIComponent(id)}&tab=billing_info#startup-trial`

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(new Date(now))
  fetchMock.mockReset().mockResolvedValue(response(eligible))
  global.fetch = fetchMock
  site()
  permission()
})
afterEach(() => { cleanup(); global.fetch = originalFetch; jest.useRealTimers() })

it("renders nothing and defers the validated GET; only then offers the explicit Billing link without POST", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValueOnce(pending.promise)
  const { container } = render(<StartupTrialWidget />)
  expect(container).toBeEmptyDOMElement()
  expect(fetchMock).not.toHaveBeenCalled()
  await advance(999)
  expect(fetchMock).not.toHaveBeenCalled()
  await advance(1)
  expect(container).toBeEmptyDOMElement()
  expect(fetchMock).toHaveBeenCalledWith(`/api/billing/startup-trial?site_id=${siteId}`, expect.objectContaining({
    method: "GET", credentials: "same-origin", cache: "no-store", signal: expect.any(AbortSignal),
  }))
  pending.resolve(response(eligible))
  await flush()
  expect(screen.getByText("Startup trial")).toBeVisible()
  expect(screen.getByText("15 days · 50 credits · No card")).toBeVisible()
  const link = screen.getByRole("link", { name: "Activate trial" })
  expect(link).toHaveAttribute("href", target())
  fireEvent.click(link)
  expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), target())
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls.every(call => call[1].method === "GET")).toBe(true)
})

it.each(["owner", "admin"] as const)("allows scoped %s with update but not insert", async role => {
  permission(role)
  render(<StartupTrialWidget />)
  await advance()
  expect(screen.getByRole("link", { name: "Activate trial" })).toBeVisible()
})

it("allows an actual owner with a different membership role", async () => {
  permission("collaborator", true, siteId, true)
  render(<StartupTrialWidget />)
  await advance()
  expect(screen.getByRole("link", { name: "Activate trial" })).toBeVisible()
})

it.each([
  ["collaborator", true, siteId], ["marketing", true, siteId],
  ["owner", false, siteId], ["admin", false, siteId], ["owner", true, otherSiteId],
] as const)("hides and skips GET for %s update=%s scope=%s", async (role, update, scope) => {
  permission(role, update, scope)
  const { container } = render(<StartupTrialWidget />)
  await advance(20_000)
  expect(container).toBeEmptyDOMElement()
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([null, { siteId, capabilities: null, can: () => true, isViewOnly: false }])(
  "fails closed with missing permissions %j", async permissions => {
    jest.mocked(useOptionalPermissions).mockReturnValue(permissions)
    const { container } = render(<StartupTrialWidget />)
    await advance()
    expect(container).toBeEmptyDOMElement()
    expect(fetchMock).not.toHaveBeenCalled()
  },
)

it.each(["engine", "foundry", "enterprise"] as const)("skips GET for the paid base plan %s", async plan => {
  site({ plan })
  const { container } = render(<StartupTrialWidget />)
  await advance()
  expect(container).toBeEmptyDOMElement()
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([
  { addons_count: 1 }, { addons_count: -1 }, { addons_count: NaN },
  { trial_started_at: now }, { trial_ends_at: active.ends_at }, { trial_converted_at: now },
] as const)("skips GET with add-ons or trial history %j", async billing => {
  site(billing)
  const { container } = render(<StartupTrialWidget />)
  await advance()
  expect(container).toBeEmptyDOMElement()
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each(["demo-site", "invalid", "", `${siteId}?siteId=${otherSiteId}`])("skips invalid site %s", async id => {
  site({}, id)
  permission("owner", true, id)
  const { container } = render(<StartupTrialWidget />)
  await advance()
  expect(container).toBeEmptyDOMElement()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("skips a missing current site or site provider", async () => {
  jest.mocked(useOptionalSite).mockReturnValue(undefined)
  const { container } = render(<StartupTrialWidget />)
  await advance()
  expect(container).toBeEmptyDOMElement()
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each(["missing", "unavailable", undefined] as const)("waits for loaded billing after %s", async status => {
  currentSite.billing_read_status = status
  applySite()
  const { container, rerender } = render(<StartupTrialWidget />)
  await advance(5000)
  expect(container).toBeEmptyDOMElement()
  expect(fetchMock).not.toHaveBeenCalled()
  site()
  rerender(<StartupTrialWidget />)
  expect(fetchMock).not.toHaveBeenCalled()
  await advance()
  expect(screen.getByRole("link", { name: "Activate trial" })).toBeVisible()
})

it("waits for a billing record instead of inferring the free plan", async () => {
  currentSite.billing = undefined
  applySite()
  render(<StartupTrialWidget />)
  await advance()
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([
  ["active", active],
  ["expired", { ...active, state: "expired", credits_remaining: 0, server_now: active.ends_at }],
  ["converted", { ...active, state: "converted", credits_remaining: 0 }],
  ["historical paying owner", { ...eligible, state: "unavailable", offer_eligible: false }],
  ["eligible without history validation", { ...eligible, offer_eligible: undefined }],
  ["eligible but history not allowed", { ...eligible, offer_eligible: false }],
])("hides after server reports %s", async (_name, body) => {
  fetchMock.mockResolvedValueOnce(response(body))
  const { container } = render(<StartupTrialWidget />)
  await advance()
  expect(container).toBeEmptyDOMElement()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each([null, {}, { state: "eligible" }, { ...eligible, success: false },
  { ...eligible, server_now: "invalid" }, { ...eligible, credits_remaining: 50 },
  { ...eligible, offer_eligible: "true" }])("hides malformed response %j", async body => {
  fetchMock.mockResolvedValueOnce(response(body))
  const { container } = render(<StartupTrialWidget />)
  await advance()
  expect(container).toBeEmptyDOMElement()
})

it.each(["network", "http", "json"])("silently hides on %s failure with no retry loop", async failure => {
  if (failure === "network") fetchMock.mockRejectedValueOnce(new Error("Offline"))
  if (failure === "http") fetchMock.mockResolvedValueOnce(response(eligible, false))
  if (failure === "json") fetchMock.mockResolvedValueOnce({ ok: true, json: async () => { throw new Error("Bad JSON") } })
  const { container } = render(<StartupTrialWidget />)
  await advance()
  await advance(120_000)
  expect(container).toBeEmptyDOMElement()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("bounds a never-settling GET to 15 seconds and never advertises eligibility", async () => {
  fetchMock.mockReturnValueOnce(new Promise(() => {}))
  const { container } = render(<StartupTrialWidget />)
  await advance()
  const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
  expect(signal.aborted).toBe(false)
  await advance(STARTUP_TRIAL_REQUEST_TIMEOUT_MS)
  expect(signal.aborted).toBe(true)
  expect(container).toBeEmptyDOMElement()
})

it("cancels the timer before unmount and the fetch after unmount", async () => {
  const early = render(<StartupTrialWidget />)
  early.unmount()
  await advance()
  expect(fetchMock).not.toHaveBeenCalled()
  const pending = deferred<Response>()
  fetchMock.mockReturnValueOnce(pending.promise)
  const late = render(<StartupTrialWidget />)
  await advance()
  late.unmount()
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  pending.resolve(response(eligible))
  await flush()
  expect(screen.queryByText("Startup trial")).not.toBeInTheDocument()
})

it("cancels old-site fetches, hides old eligibility immediately, and targets only the current site", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValueOnce(pending.promise)
  const view = render(<StartupTrialWidget />)
  await advance()
  site({}, otherSiteId)
  permission("admin", true, otherSiteId)
  view.rerender(<StartupTrialWidget />)
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  pending.resolve(response(eligible))
  await flush()
  expect(view.container).toBeEmptyDOMElement()
  await advance()
  const link = screen.getByRole("link", { name: "Activate trial" })
  expect(link).toHaveAttribute("href", target(otherSiteId))
  fireEvent.click(link)
  expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), target(otherSiteId))
  site()
  permission()
  view.rerender(<StartupTrialWidget />)
  expect(view.container).toBeEmptyDOMElement()
})

it("cancels the old-site deferred timer", async () => {
  const view = render(<StartupTrialWidget />)
  await advance(500)
  site({}, otherSiteId)
  permission("owner", true, otherSiteId)
  view.rerender(<StartupTrialWidget />)
  await advance(500)
  expect(fetchMock).not.toHaveBeenCalled()
  await advance(500)
  expect(fetchMock.mock.calls[0][0]).toContain(otherSiteId)
})

it("hides on permission revocation and requires a fresh deferred read after permission returns", async () => {
  const view = render(<StartupTrialWidget />)
  await advance()
  permission("owner", false)
  view.rerender(<StartupTrialWidget />)
  expect(view.container).toBeEmptyDOMElement()
  permission()
  view.rerender(<StartupTrialWidget />)
  expect(view.container).toBeEmptyDOMElement()
  await advance()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("cancels an in-flight read on permission loss and ignores a late eligible response", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValueOnce(pending.promise)
  const view = render(<StartupTrialWidget />)
  await advance()
  permission("owner", false)
  view.rerender(<StartupTrialWidget />)
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  pending.resolve(response(eligible))
  await flush()
  expect(view.container).toBeEmptyDOMElement()
})

it.each([{ plan: "foundry" }, { addons_count: 1 }, { trial_started_at: now },
  { trial_converted_at: now }, { trial_started_at: now, trial_ends_at: active.ends_at },
  { paid_subscription_invoice_id: "new-paid-invoice" }] as const)("hides immediately on same-site billing change %j", async billing => {
  const view = render(<StartupTrialWidget />)
  await advance()
  site(billing)
  view.rerender(<StartupTrialWidget />)
  expect(view.container).toBeEmptyDOMElement()
})

it("does not reuse eligible state after an expired trial on the same site", async () => {
  const view = render(<StartupTrialWidget />)
  await advance()
  site({ trial_started_at: now, trial_ends_at: active.ends_at })
  view.rerender(<StartupTrialWidget />)
  await advance(16 * 86_400_000)
  expect(view.container).toBeEmptyDOMElement()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("does not refetch for balances/collapse changes or frequent focus; expires eligibility and rechecks once on focus", async () => {
  const view = render(<StartupTrialWidget />)
  await advance()
  site({ credits_available: 100 })
  view.rerender(<StartupTrialWidget isCollapsed />)
  for (let i = 0; i < 10; i++) fireEvent(window, new Event("focus"))
  await advance(59_000)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("button", { name: "Activate trial" })).toBeVisible()
  await advance(1000)
  expect(view.container).toBeEmptyDOMElement()
  fetchMock.mockResolvedValueOnce(response({ ...eligible, state: "unavailable", offer_eligible: false }))
  for (let i = 0; i < 10; i++) fireEvent(window, new Event("focus"))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await advance()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(view.container).toBeEmptyDOMElement()
})

it("blocks a stale eligible click after sleep even before the expiration timer runs", async () => {
  render(<StartupTrialWidget />)
  await advance()
  jest.setSystemTime(new Date(Date.now() + 61_000))
  fireEvent.click(screen.getByRole("link", { name: "Activate trial" }))
  expect(navigateOrAssign).not.toHaveBeenCalled()
  expect(screen.queryByRole("link", { name: "Activate trial" })).not.toBeInTheDocument()
})

it("shows the independent shortcut when CreditsWidget hides a full balance", async () => {
  const { container } = render(<><CreditsWidget /><StartupTrialWidget /></>)
  expect(container).toBeEmptyDOMElement()
  await advance()
  expect(screen.getByRole("link", { name: "Activate trial" })).toBeVisible()
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
})

it("uses an accessible collapsed icon button with a tooltip and only navigates", async () => {
  render(<StartupTrialWidget isCollapsed />)
  await advance()
  const button = screen.getByRole("button", { name: "Activate trial" })
  expect(button.querySelector("svg")).toBeInTheDocument()
  fireEvent.focus(button)
  await advance()
  expect(screen.getByRole("tooltip")).toHaveTextContent("Startup trial")
  expect(screen.getByRole("tooltip")).toHaveTextContent("15 days · 50 credits · No card")
  fireEvent.click(button)
  expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), target())
  expect(fetchMock).toHaveBeenCalledTimes(1)
})