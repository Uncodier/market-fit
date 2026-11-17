import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { SiteProvider, useSite } from "@/app/context/SiteContext"
import type { Site } from "@/app/context/site-types"
import { fetchAccessibleSitesClient } from "@/lib/sites/fetch-accessible-sites"
import { SITE_HYDRATION_TIMEOUT_MS } from "@/app/context/site-loading-lifecycle"
import { cacheSiteSelection, SITE_SELECTION_CACHE_KEY } from "@/app/context/site-selection-cache"
import { snapshotPostgrestError } from "@/lib/supabase/postgrest-error"

const mockSession = { user: { id: "owner" } }
let mockAuth: (event: string, session: unknown) => void
const mockSettings = jest.fn()
const mockClient = {
  auth: {
    getSession: jest.fn(async () => ({ data: { session: mockSession } })),
    onAuthStateChange: (callback: typeof mockAuth) => {
      mockAuth = callback
      return { data: { subscription: { unsubscribe: jest.fn() } } }
    },
  },
  from: () => ({ select: () => ({ eq: () => ({ single: mockSettings }) }) }),
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  removeChannel: jest.fn(),
}
jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockClient }))
jest.mock("@/lib/sites/fetch-accessible-sites", () => ({ fetchAccessibleSitesClient: jest.fn() }))
jest.mock("@/app/context/site-resource-sync", () => ({ useSiteResourceSync: jest.fn() }))
jest.mock("@/lib/sites/logo-background-sync", () => ({ syncSiteLogosInBackground: jest.fn() }))
jest.mock("@/lib/demo-utils", () => ({
  isDemoModeActive: () => false, getDemoSiteId: () => null,
  isRealSiteId: () => true,
  resolvePreferredSiteId: ({ savedSiteId }: { savedSiteId: string }) => savedSiteId,
}))

const first = { id: "11111111-1111-4111-8111-111111111111", name: "First",
  logo_url: "logo", description: "Description", user_id: "owner" } as Site
const second = { ...first, id: "22222222-2222-4222-8222-222222222222", name: "Second" }
const response = (sites: Site[] = [first, second]) => ({ sites, error: null, unauthorized: false, aborted: false })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function mount() {
  return renderHook(() => useSite(), {
    wrapper: ({ children }: { children: ReactNode }) => <SiteProvider>{children}</SiteProvider>,
  })
}
async function hydrated() {
  const view = mount()
  await waitFor(() => expect(view.result.current.isLoading).toBe(false))
  expect(view.result.current.currentSite?.settings?.about).toBe("Hydrated settings")
  return view
}
beforeEach(() => {
  jest.clearAllMocks()
  mockSettings.mockReset()
  mockClient.auth.getSession.mockReset().mockResolvedValue({ data: { session: mockSession } })
  jest.mocked(fetchAccessibleSitesClient).mockReset()
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem("currentSiteId", first.id)
  jest.mocked(fetchAccessibleSitesClient).mockResolvedValue(response())
  mockSettings.mockResolvedValue({ data: { about: "Hydrated settings" }, error: null })
})

it("restores the same actor's selected site while the list is unavailable", async () => {
  cacheSiteSelection("owner", first)
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(pending.promise)
  const { result } = await hydrated()
  expect(result.current.currentSite?.id).toBe(first.id)
  expect(result.current.sites).toEqual([])
  const previous = result.current.currentSite
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
  await act(async () => pending.reject(new Error("Network unavailable")))
  expect(result.current.currentSite).toBe(previous)
  expect(result.current.isLoading).toBe(false)
  expect(result.current.error?.message).toBe("Network unavailable")
  consoleError.mockRestore()
})

it("keeps restored settings and selection when the list deadline expires", async () => {
  cacheSiteSelection("owner", first)
  jest.useFakeTimers()
  try {
    const pending = deferred<ReturnType<typeof response>>()
    jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(pending.promise)
    const { result } = mount()
    await act(async () => { await Promise.resolve() })
    expect(result.current.currentSite?.settings?.about).toBe("Hydrated settings")
    await act(async () => jest.advanceTimersByTime(SITE_HYDRATION_TIMEOUT_MS))
    expect(result.current.currentSite?.id).toBe(first.id)
    expect(result.current.isLoading).toBe(false)
    await act(async () => pending.resolve(response([])))
    expect(result.current.currentSite?.id).toBe(first.id)
  } finally { jest.useRealTimers() }
})

it("revalidates a cached site without loading its settings twice", async () => {
  cacheSiteSelection("owner", first)
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(pending.promise)
  const { result } = await hydrated()
  await act(async () => pending.resolve(response()))
  expect(result.current.currentSite?.settings?.about).toBe("Hydrated settings")
  expect(mockSettings).toHaveBeenCalledTimes(1)
  expect(result.current.isLoading).toBe(false)
  expect(result.current.sites).toHaveLength(2)
})

it("clears a restored site and cache after authoritative removal", async () => {
  cacheSiteSelection("owner", first)
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(pending.promise)
  const { result } = await hydrated()
  await act(async () => pending.resolve(response([second])))
  expect(result.current.currentSite).toBeNull()
  expect(localStorage.getItem(SITE_SELECTION_CACHE_KEY)).toBeNull()
  expect(localStorage.getItem("currentSiteId")).toBeNull()
  expect(result.current.isLoading).toBe(false)
})

it("does not restore another user's cached site when the list fails", async () => {
  cacheSiteSelection("another-user", first)
  jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce({
    ...response([]), error: snapshotPostgrestError(new Error("Network unavailable")),
  })
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
  const { result } = mount()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.currentSite).toBeNull()
  expect(mockSettings).not.toHaveBeenCalled()
  consoleError.mockRestore()
})

it("deduplicates initial auth events while restoring the site", async () => {
  cacheSiteSelection("owner", first)
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(pending.promise)
  const view = mount()
  act(() => mockAuth("INITIAL_SESSION", mockSession))
  await waitFor(() => expect(view.result.current.isLoading).toBe(false))
  expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(1)
  expect(mockSettings).toHaveBeenCalledTimes(1)
  await act(async () => pending.resolve(response()))
})

it("does not expose a restored site with unavailable checkout settings", async () => {
  cacheSiteSelection("owner", first)
  mockSettings.mockResolvedValue({ data: null, error: { code: "NETWORK", message: "Offline" } })
  const { result } = mount()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.currentSite).toBeNull()
  expect(result.current.error?.message).toContain("settings could not be loaded")
})

it("cannot resurrect removed cached selection through late settings", async () => {
  cacheSiteSelection("owner", first)
  const settings = deferred<{ data: { about: string }; error: null }>()
  mockSettings.mockReturnValueOnce(settings.promise)
  jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce(response([]))
  const { result } = mount()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.currentSite).toBeNull()
  await act(async () => settings.resolve({ data: { about: "Late" }, error: null }))
  expect(result.current.currentSite).toBeNull()
  expect(localStorage.getItem(SITE_SELECTION_CACHE_KEY)).toBeNull()
})

it("clears cached selection on signout and ignores the pending list", async () => {
  cacheSiteSelection("owner", first)
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(pending.promise)
  const { result } = await hydrated()
  act(() => mockAuth("SIGNED_OUT", null))
  await act(async () => pending.resolve(response()))
  expect(result.current.currentSite).toBeNull()
  expect(localStorage.getItem(SITE_SELECTION_CACHE_KEY)).toBeNull()
})

it("retires cached scope after repeated authentication denial", async () => {
  cacheSiteSelection("owner", first)
  jest.useFakeTimers()
  try {
    jest.mocked(fetchAccessibleSitesClient).mockResolvedValue({ ...response([]), unauthorized: true })
    const { result } = mount()
    await act(async () => { await Promise.resolve() })
    await act(async () => jest.advanceTimersByTime(400))
    await act(async () => jest.advanceTimersByTime(400))
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(3)
    expect(result.current.currentSite).toBeNull()
    expect(localStorage.getItem(SITE_SELECTION_CACHE_KEY)).toBeNull()
    expect(result.current.isLoading).toBe(false)
  } finally { jest.useRealTimers() }
})

it.each(['session', 'settings'])('bounds stalled initial %s hydration and ignores late data', async kind => {
  jest.useFakeTimers()
  const pending = deferred<{ data: { about: string }; error: null }>()
  try {
    if (kind === 'session') mockClient.auth.getSession.mockImplementationOnce(() => new Promise(() => {}))
    else mockSettings.mockReturnValueOnce(pending.promise)
    const { result } = mount()
    await act(async () => { await Promise.resolve() })
    await act(async () => { jest.advanceTimersByTime(SITE_HYDRATION_TIMEOUT_MS) })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error?.message).toContain('timed out')
    expect(result.current.currentSite).toBeNull()
    await act(async () => pending.resolve({ data: { about: 'Late' }, error: null }))
    expect(result.current.currentSite).toBeNull()
    await act(async () => { await result.current.refreshSites() })
    expect(result.current.currentSite?.settings?.about).toBe('Hydrated settings')
  } finally { jest.useRealTimers() }
})

it('preserves a pending explicit selection when a background refresh is requested', async () => {
  const { result } = await hydrated()
  const pending = deferred<{ data: { about: string }; error: null }>()
  mockSettings.mockReturnValueOnce(pending.promise)
  act(() => { result.current.setCurrentSite(second) })
  let refresh!: Promise<void>
  act(() => { refresh = result.current.refreshSites() })
  expect(result.current.isLoading).toBe(true)
  expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(1)
  await act(async () => { pending.resolve({ data: { about: 'Second settings' }, error: null }); await refresh })
  expect(result.current.currentSite?.settings?.about).toBe('Second settings')
  expect(result.current.isLoading).toBe(false)
})

it('hydrates a new identity even on protected settings routes', async () => {
  const { result } = await hydrated()
  act(() => mockAuth('SIGNED_IN', mockSession))
  window.history.replaceState({}, '', '/settings')
  try {
    act(() => mockAuth('SIGNED_IN', { user: { id: 'other-owner' } }))
    await waitFor(() => expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentSite).toBeNull()
  } finally { window.history.replaceState({}, '', '/') }
})

it('keeps hydrated workspace data when a background refresh times out', async () => {
  const { result } = await hydrated()
  jest.useFakeTimers()
  try {
    const previous = result.current.currentSite
    const pending = deferred<ReturnType<typeof response>>()
    jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(pending.promise)
    act(() => { void result.current.refreshSites() })
    await act(async () => { await Promise.resolve() })
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2)
    await act(async () => { jest.advanceTimersByTime(SITE_HYDRATION_TIMEOUT_MS) })
    expect(result.current.currentSite).toBe(previous)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error?.message).toContain('timed out')
    await act(async () => pending.resolve(response([])))
    expect(result.current.currentSite).toBe(previous)
  } finally { jest.useRealTimers() }
})

it('allows missing-site retry on a protected page after a loading deadline', async () => {
  jest.useFakeTimers()
  window.history.replaceState({}, '', '/settings')
  try {
    mockSettings.mockReturnValueOnce(new Promise(() => {}))
    const { result } = mount()
    await act(async () => { await Promise.resolve() })
    await act(async () => { jest.advanceTimersByTime(SITE_HYDRATION_TIMEOUT_MS) })
    expect(result.current.currentSite).toBeNull()
    await act(async () => { await result.current.refreshSites() })
    expect(result.current.currentSite?.settings?.about).toBe('Hydrated settings')
    expect(result.current.isLoading).toBe(false)
  } finally { jest.useRealTimers(); window.history.replaceState({}, '', '/') }
})

it("gates initial hydration until the selected site's settings finish", async () => {
  const settings = deferred<{ data: { about: string }; error: null }>()
  mockSettings.mockReturnValue(settings.promise)
  const { result } = mount()
  await waitFor(() => expect(mockSettings).toHaveBeenCalled())
  expect(result.current.isLoading).toBe(true)
  await act(async () => settings.resolve({ data: { about: "Ready" }, error: null }))
  expect(result.current.isLoading).toBe(false)
  expect(result.current.currentSite?.settings?.about).toBe("Ready")
})

it("keeps loading false and hydrated settings during a background refresh and success", async () => {
  const { result } = await hydrated()
  const settings = result.current.currentSite?.settings
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValue(pending.promise)
  let refresh!: Promise<void>
  act(() => { refresh = result.current.refreshSites() })
  expect(result.current.isLoading).toBe(false)
  expect(result.current.currentSite?.settings).toBe(settings)
  await act(async () => {
    pending.resolve(response([{ ...first, name: "Updated" }, second]))
    await refresh
  })
  expect(result.current.isLoading).toBe(false)
  expect(result.current.currentSite?.name).toBe("Updated")
  expect(result.current.currentSite?.settings).toBe(settings)
  expect(mockSettings).toHaveBeenCalledTimes(1)
})

it("preserves usable state on a background error", async () => {
  const { result } = await hydrated()
  const previous = result.current.currentSite
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValue(pending.promise)
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
  let refresh!: Promise<void>
  act(() => { refresh = result.current.refreshSites() })
  await act(async () => { pending.reject(new Error("Offline")); await refresh })
  expect(result.current.isLoading).toBe(false)
  expect(result.current.currentSite).toBe(previous)
  expect(result.current.error?.message).toBe("Offline")
  consoleError.mockRestore()
})

it("does not switch this tab when another tab changes the saved site preference", async () => {
  const { result } = await hydrated()
  localStorage.setItem('currentSiteId', second.id)
  await act(async () => { await result.current.refreshSites() })
  expect(result.current.currentSite?.id).toBe(first.id)
  expect(mockSettings).toHaveBeenCalledTimes(1)
})

it("uses the latest initialized site from the original auth listener", async () => {
  const { result } = await hydrated()
  act(() => mockAuth("TOKEN_REFRESHED", null))
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValue(pending.promise)
  act(() => mockAuth("TOKEN_REFRESHED", mockSession))
  await waitFor(() => expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2))
  expect(result.current.isLoading).toBe(false)
  expect(result.current.currentSite?.settings?.about).toBe("Hydrated settings")
  await act(async () => pending.resolve(response()))
  expect(mockSettings).toHaveBeenCalledTimes(1)
})

it("ignores a late full-site refresh after a site switch, keeping the switch gated", async () => {
  const { result } = await hydrated()
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValue(pending.promise)
  let refresh!: Promise<void>
  act(() => { refresh = result.current.refreshSites() })
  await waitFor(() => expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2))
  const settings = deferred<{ data: { about: string }; error: null }>()
  mockSettings.mockReturnValue(settings.promise)
  let selection!: Promise<void>
  act(() => { selection = Promise.resolve(result.current.setCurrentSite(second)) })
  await act(async () => { pending.resolve(response([{ ...first, name: "Stale" }])); await refresh })
  expect(result.current.currentSite?.id).toBe(second.id)
  expect(result.current.isLoading).toBe(true)
  expect(result.current.sites).toHaveLength(2)
  await act(async () => { settings.resolve({ data: { about: "Second settings" }, error: null }); await selection })
  expect(result.current.isLoading).toBe(false)
  expect(result.current.currentSite?.settings?.about).toBe("Second settings")
})

it("ignores older overlapping results and their errors", async () => {
  const { result } = await hydrated()
  const older = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(older.promise)
  let oldRefresh!: Promise<void>
  act(() => { oldRefresh = result.current.refreshSites() })
  await waitFor(() => expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2))
  jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce(response([{ ...first, name: "Newest" }]))
  await act(async () => { await result.current.refreshSites() })
  await act(async () => { older.reject(new Error("Stale failure")); await oldRefresh })
  expect(result.current.currentSite?.name).toBe("Newest")
  expect(result.current.error).toBeNull()
  expect(result.current.isLoading).toBe(false)
})

it("does not restore sites or loading after signout while a refresh is pending", async () => {
  const { result } = await hydrated()
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValue(pending.promise)
  let refresh!: Promise<void>
  act(() => { refresh = result.current.refreshSites() })
  await waitFor(() => expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2))
  act(() => mockAuth("SIGNED_OUT", null))
  await act(async () => { pending.resolve(response()); await refresh })
  expect(result.current.currentSite).toBeNull()
  expect(result.current.sites).toEqual([])
  expect(result.current.isLoading).toBe(false)
  expect(localStorage.getItem("currentSiteId")).toBeNull()
})

it("does not publish settings from a pre-signout selection into the next session", async () => {
  const { result } = await hydrated()
  const pending = deferred<{ data: { about: string }; error: null }>()
  mockSettings.mockReturnValueOnce(pending.promise)
  let selection!: Promise<void>
  act(() => { selection = Promise.resolve(result.current.setCurrentSite(second)) })
  act(() => mockAuth("SIGNED_OUT", null))
  localStorage.setItem("currentSiteId", second.id)
  act(() => mockAuth("SIGNED_IN", mockSession))
  await waitFor(() => expect(result.current.currentSite?.settings?.about).toBe("Hydrated settings"))
  await act(async () => { pending.resolve({ data: { about: "Stale" }, error: null }); await selection })
  expect(result.current.currentSite?.id).toBe(second.id)
  expect(result.current.currentSite?.settings?.about).toBe("Hydrated settings")
  expect(result.current.isLoading).toBe(false)
})

it("clears a revoked selection only after an authoritative successful list", async () => {
  const { result } = await hydrated()
  jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce(response([second]))
  await act(async () => { await result.current.refreshSites() })
  expect(result.current.currentSite).toBeNull()
  expect(result.current.sites).toEqual([expect.objectContaining({ id: second.id })])
  expect(result.current.isLoading).toBe(false)
})

it("does not execute an unauthorized retry after signout", async () => {
  const { result } = await hydrated()
  jest.useFakeTimers()
  try {
    jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce({
      ...response([]), unauthorized: true,
    })
    let refresh!: Promise<void>
    await act(async () => { refresh = result.current.refreshSites() })
    expect(result.current.isLoading).toBe(false)
    act(() => mockAuth("SIGNED_OUT", null))
    await act(async () => { jest.advanceTimersByTime(500); await refresh })
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2)
    expect(result.current.currentSite).toBeNull()
  } finally {
    jest.useRealTimers()
  }
})

it("clears the previous actor's snapshot on a direct auth identity change", async () => {
  const { result } = await hydrated()
  act(() => mockAuth("SIGNED_IN", mockSession))
  const pending = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValue(pending.promise)
  act(() => mockAuth("SIGNED_IN", { user: { id: "other-owner" } }))
  expect(result.current.currentSite).toBeNull()
  expect(result.current.sites).toEqual([])
  expect(result.current.isLoading).toBe(true)
  await act(async () => pending.resolve(response([second])))
  expect(result.current.currentSite).toBeNull()
  expect(result.current.isLoading).toBe(false)
})