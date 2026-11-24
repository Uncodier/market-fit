import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { User } from "@supabase/supabase-js"
import { AuthContext } from "@/app/components/auth/auth-context"
import { SiteSelector } from "@/app/components/navigation/SiteSelector"
import { SiteProvider, useSite } from "@/app/context/SiteContext"
import { SITE_HYDRATION_TIMEOUT_MS } from "@/app/context/site-loading-lifecycle"
import { cacheSiteSelection, readSiteSelection, SITE_SELECTION_CACHE_KEY, SITE_SELECTION_CACHE_TTL_MS } from "@/app/context/site-selection-cache"
import type { Site } from "@/app/context/site-types"

const actor = "member-a"
const savedSite = {
  id: "11111111-1111-4111-8111-111111111111", name: "Saved project", user_id: "different-owner",
  url: "https://private.example.test", description: "Private description", logo_url: "https://logo.example.test/private",
  created_at: "", updated_at: "", resource_urls: null,
} satisfies Site
const freshSite = { ...savedSite, name: "Verified project" }
const unrelated = { ...savedSite, id: "22222222-2222-4222-8222-222222222222", name: "Unrelated project" }
const ready = { data: { site_id: savedSite.id, about: "Verified settings" }, error: null }

type Session = { user: { id: string } } | null
let mockAuthEvent: (event: string, session: Session) => void
const mockSettings = jest.fn()
const mockClient = {
  auth: {
    getSession: jest.fn(async () => ({ data: { session: { user: { id: actor } } as Session } })),
    onAuthStateChange: jest.fn((listener: typeof mockAuthEvent) => {
      mockAuthEvent = listener
      return { data: { subscription: { unsubscribe: jest.fn() } } }
    }),
  },
  from: (table: string) => {
    if (table !== "settings") throw new Error(`Unexpected ${table} query`)
    return { select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: mockSettings }), single: mockSettings }) }) }
  },
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: jest.fn(),
}
jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockClient }))
jest.mock("@/app/context/site-resource-sync", () => ({ useSiteResourceSync: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))

function response(status: number, payload: unknown): Response {
  return { status, ok: status === 200, json: async () => payload } as Response
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function ContextProbe() {
  const { currentSite, sites, isLoading } = useSite()
  return <pre data-testid="context">{JSON.stringify({ selection: currentSite?.id ?? null,
    settings: currentSite?.settings?.about ?? null, listSize: sites.length, loading: isLoading })}</pre>
}
const context = () => JSON.parse(screen.getByTestId("context").textContent!)
function tree(actorId: string | null = actor, collapsed = false, checkingAuth = false) {
  return (
    <AuthContext.Provider value={{ user: actorId ? { id: actorId } as User : null,
      isLoading: checkingAuth, isAuthenticated: Boolean(actorId),
      signInWithEmail: jest.fn(), signInWithOAuth: jest.fn(), signUpWithEmail: jest.fn(), signOut: jest.fn() }}>
      <SiteProvider><SiteSelector isCollapsed={collapsed} /><ContextProbe /></SiteProvider>
    </AuthContext.Provider>
  )
}
const fetchSites = jest.mocked(global.fetch)
beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState({}, "", "/settings")
  sessionStorage.setItem("preventAutoRefresh", "true")
  localStorage.setItem("currentSiteId", savedSite.id)
  cacheSiteSelection(actor, savedSite)
  mockClient.auth.getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: actor } } } })
  mockSettings.mockReset().mockResolvedValue(ready)
  fetchSites.mockReset().mockResolvedValue(response(200, { sites: [freshSite, unrelated], authoritative: true }))
})
afterEach(() => {
  window.history.replaceState({}, "", "/")
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it.each([false, true])("shows only skeletons while Settings is suspended (collapsed=%s)", async collapsed => {
  const session = deferred<Awaited<ReturnType<typeof mockClient.auth.getSession>>>()
  mockClient.auth.getSession.mockReturnValueOnce(session.promise)
  const settings = deferred<typeof ready>()
  mockSettings.mockReturnValueOnce(settings.promise)
  const list = deferred<Response>()
  fetchSites.mockReturnValueOnce(list.promise)
  render(tree(actor, collapsed))

  // AuthContext is already resolved. The hint is present even before SiteContext
  // has an active selection; the selector must not create one itself.
  expect(screen.getByRole("status")).toHaveAccessibleName("Saved project")
  expect(context()).toMatchObject({ selection: null, settings: null, loading: true })
  expect(screen.getByRole("status").textContent).toBe("")
  expect(mockSettings).not.toHaveBeenCalled()
  expect(fetchSites).not.toHaveBeenCalled()
  await act(async () => session.resolve({ data: { session: { user: { id: actor } } } }))
  expect(mockSettings).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
  await act(async () => list.resolve(response(200, { sites: [savedSite, unrelated] })))
  expect(context()).toMatchObject({ settings: null, listSize: 2, loading: true })
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
  expect(document.body.innerHTML).not.toMatch(/Unrelated project|private\.example|logo\.example|Private description|different-owner/)
  expect(mockClient.auth.getSession).toHaveBeenCalledTimes(1)
  expect(mockClient.auth.onAuthStateChange).toHaveBeenCalledTimes(1)

  await act(async () => settings.resolve(ready))
  expect(context()).toMatchObject({ settings: "Verified settings", loading: false })
  const trigger = screen.getByRole("button", { name: "Saved project" })
  fireEvent.keyDown(trigger, { key: "Enter" })
  expect(await screen.findByRole("menuitem", { name: /Unrelated project/ })).toBeInTheDocument()
})

it.each(["settings error", "deadline"])("keeps a label, not global selection, on %s and retries the actual protected load", async failure => {
  jest.useFakeTimers()
  jest.spyOn(console, "error").mockImplementation(() => {})
  fetchSites.mockResolvedValueOnce(response(503, { error: "Unavailable diagnostic detail" }))
  const settings = deferred<typeof ready>()
  mockSettings.mockReturnValueOnce(failure === "deadline" ? settings.promise
    : Promise.resolve({ data: null, error: { code: "NETWORK", message: "Network error" } }))
  render(tree())
  await act(async () => {})
  if (failure === "deadline") await act(async () => jest.advanceTimersByTime(SITE_HYDRATION_TIMEOUT_MS))
  expect(context()).toMatchObject({ selection: null, settings: null, listSize: 0, loading: false })
  expect(screen.getByRole("status")).toHaveTextContent("Saved project")
  expect(screen.getByRole("status")).toHaveTextContent("Couldn't load project")
  expect(screen.queryByText(/diagnostic detail/i)).not.toBeInTheDocument()
  expect(screen.getAllByRole("button")).toHaveLength(1)
  expect(fetchSites).toHaveBeenCalledTimes(1)

  const recovering = deferred<Response>()
  fetchSites.mockReturnValueOnce(recovering.promise)
  const button = screen.getByRole("button", { name: "Retry loading project" })
  act(() => { fireEvent.click(button); fireEvent.click(button) })
  await act(async () => {})
  expect(fetchSites).toHaveBeenCalledTimes(2)
  expect(fetchSites).toHaveBeenLastCalledWith("/api/sites?view=selector&fresh=1", expect.objectContaining({ credentials: "include" }))
  await act(async () => recovering.resolve(response(200, { sites: [freshSite], authoritative: true })))
  expect(screen.getByRole("button", { name: "Verified project" })).toBeInTheDocument()
  expect(context()).toMatchObject({ selection: savedSite.id, settings: "Verified settings", listSize: 1, loading: false })
  await act(async () => settings.resolve({ data: { site_id: savedSite.id, about: "Late" }, error: null }))
  expect(context().settings).toBe("Verified settings")
})

it.each([401, 403, 200])("retires the label on confirmed denial/removal (%i), even with a late settings read", async status => {
  jest.useFakeTimers()
  const settings = deferred<typeof ready>()
  mockSettings.mockReturnValueOnce(settings.promise)
  const list = deferred<Response>()
  fetchSites.mockReturnValue(list.promise)
  render(tree())
  await act(async () => {})
  expect(screen.getByRole("status")).toHaveAccessibleName("Saved project")
  await act(async () => list.resolve(response(status, status === 200 ? { sites: [unrelated] } : { error: "Denied" })))
  if (status === 401) await act(async () => jest.advanceTimersByTimeAsync(800))
  expect(fetchSites).toHaveBeenCalledTimes(status === 401 ? 3 : 1)
  expect(readSiteSelection(actor)).toBeNull()
  expect(screen.queryByText(savedSite.name)).not.toBeInTheDocument()
  await act(async () => settings.resolve(ready))
  expect(context()).toMatchObject({ selection: null, settings: null, loading: false })
  expect(screen.queryByText(savedSite.name)).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: savedSite.name })).not.toBeInTheDocument()
  expect(screen.queryByText(unrelated.name)).not.toBeInTheDocument()
  await act(async () => jest.advanceTimersByTimeAsync(120_000))
  expect(fetchSites).toHaveBeenCalledTimes(status === 401 ? 3 : 1)
})

it("removes both the hint and already-hydrated UI on an AuthContext actor change, without waiting for SiteContext", async () => {
  const settings = deferred<typeof ready>()
  mockSettings.mockReturnValueOnce(settings.promise)
  const list = deferred<Response>()
  fetchSites.mockReturnValueOnce(list.promise)
  const view = render(tree(actor, true, true))
  await waitFor(() => expect(mockSettings).toHaveBeenCalledTimes(1))
  expect(screen.queryByText(savedSite.name)).not.toBeInTheDocument()
  view.rerender(tree(actor, true))
  expect(screen.getByRole("status")).toHaveAccessibleName(savedSite.name)
  view.rerender(tree("other-member", true))
  expect(document.body.innerHTML).not.toContain(savedSite.name)

  view.rerender(tree(actor, true))
  await act(async () => { settings.resolve(ready); list.resolve(response(200, { sites: [freshSite, unrelated] })) })
  const trigger = screen.getByRole("button", { name: freshSite.name })
  fireEvent.keyDown(trigger, { key: "Enter" })
  expect(await screen.findByRole("menuitem", { name: /Unrelated project/ })).toBeInTheDocument()
  view.rerender(tree("other-member", true))
  expect(context().selection).toBe(savedSite.id) // SiteContext has not observed the event yet.
  expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  expect(document.body.innerHTML).not.toMatch(/Saved project|Verified project|Unrelated project/)
  view.rerender(tree(null, true))
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  act(() => mockAuthEvent("SIGNED_OUT", null))
  expect(context().selection).toBeNull()
  expect(readSiteSelection(actor)).toBeNull()
})

it.each(["foreign actor", "expired", "mismatched site", "malformed"])("rejects invalid hints (%s), including in its collapsed title", badHint => {
  mockClient.auth.getSession.mockReturnValueOnce(new Promise(() => {}))
  if (badHint === "foreign actor") cacheSiteSelection("different-owner", savedSite)
  if (badHint === "mismatched site") localStorage.setItem("currentSiteId", unrelated.id)
  if (badHint === "malformed") localStorage.setItem(SITE_SELECTION_CACHE_KEY, "{")
  if (badHint === "expired") localStorage.setItem(SITE_SELECTION_CACHE_KEY, JSON.stringify({ userId: actor,
    savedAt: Date.now() - SITE_SELECTION_CACHE_TTL_MS - 1, site: savedSite }))
  render(tree(actor, true))
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
  expect(document.body.innerHTML).not.toContain(savedSite.name)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})

it('does not scan project-list logos at startup, then decorates the opened selector once without switching workspaces', async () => {
  const { logo_url: _unloaded, ...other } = unrelated
  fetchSites.mockResolvedValueOnce(response(200, { sites: [freshSite, other], authoritative: true }))
  fetchSites.mockResolvedValueOnce(response(200, { success: true, actorId: actor, logos: { [other.id]: 'project-logo' } }))
  render(tree())
  const trigger = await screen.findByRole('button', { name: /project/i })
  expect(fetchSites.mock.calls.map(([url]) => url)).toEqual(['/api/sites?view=selector'])
  fireEvent.keyDown(trigger, { key: 'Enter' })
  await screen.findByRole('menuitem', { name: /Unrelated project/ })
  expect(fetchSites).toHaveBeenCalledTimes(2)
  expect(fetchSites).toHaveBeenLastCalledWith('/api/sites/logos', expect.objectContaining({ body: JSON.stringify({ ids: [other.id] }) }))
  expect(context().selection).toBe(savedSite.id)
})

it("drops the label at the existing cache deadline while a temporary failure is still on screen", async () => {
  jest.useFakeTimers()
  jest.spyOn(console, "error").mockImplementation(() => {})
  const savedAt = Date.now() - SITE_SELECTION_CACHE_TTL_MS + 99
  localStorage.setItem(SITE_SELECTION_CACHE_KEY, JSON.stringify({ userId: actor, savedAt, site: savedSite }))
  mockSettings.mockResolvedValueOnce({ data: null, error: { code: "NETWORK" } })
  fetchSites.mockResolvedValueOnce(response(503, {}))
  render(tree())
  await act(async () => {})
  expect(screen.getByRole("status")).toHaveTextContent(savedSite.name)
  await act(async () => jest.advanceTimersByTime(100))
  expect(screen.queryByText(savedSite.name)).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Retry loading project" })).toBeEnabled()
  expect(context().selection).toBeNull()
  expect(fetchSites).toHaveBeenCalledTimes(1)
})

it("does not show a selection from another tab in place of this tab's pending site", async () => {
  mockSettings.mockReturnValueOnce(new Promise(() => {}))
  fetchSites.mockReturnValueOnce(new Promise(() => {}))
  render(tree())
  await waitFor(() => expect(context().selection).toBe(savedSite.id))
  expect(screen.getByRole("status")).toHaveAccessibleName(savedSite.name)
  act(() => {
    localStorage.setItem("currentSiteId", unrelated.id)
    cacheSiteSelection(actor, unrelated)
    window.dispatchEvent(new StorageEvent("storage", { key: SITE_SELECTION_CACHE_KEY }))
  })
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
  expect(screen.queryByText(savedSite.name)).not.toBeInTheDocument()
  expect(screen.queryByText(unrelated.name)).not.toBeInTheDocument()
  expect(context().selection).toBe(savedSite.id)
  expect(fetchSites).toHaveBeenCalledTimes(1)
})