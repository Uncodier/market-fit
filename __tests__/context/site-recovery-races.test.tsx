import { act, fireEvent, renderHook, screen, waitFor } from "@testing-library/react"
import { StrictMode, type ReactNode } from "react"
import { SiteProvider, useSite } from "@/app/context/SiteContext"
import { SiteSelector } from "@/app/components/navigation/SiteSelector"
import type { Site } from "@/app/context/site-types"
import { fetchAccessibleSitesClient } from "@/lib/sites/fetch-accessible-sites"
import { cacheSiteSelection, SITE_SELECTION_CACHE_KEY } from "@/app/context/site-selection-cache"
import { SITE_HYDRATION_TIMEOUT_MS } from "@/app/context/site-loading-lifecycle"

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
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: mockSession.user }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/lib/demo-utils", () => ({
  isDemoModeActive: () => false, getDemoSiteId: () => null, isRealSiteId: () => true,
  resolvePreferredSiteId: ({ savedSiteId }: { savedSiteId: string }) => savedSiteId,
}))

const first = { id: "11111111-1111-4111-8111-111111111111", name: "First",
  logo_url: "logo", description: "Description", user_id: "owner" } as Site
const second = { ...first, id: "22222222-2222-4222-8222-222222222222", name: "Second" }
const response = (sites: Site[] = [first, second]) => ({ sites, error: null, unauthorized: false, aborted: false })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function mount(strict = false) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SiteProvider><SiteSelector />{children}</SiteProvider>
  )
  return renderHook(() => useSite(), { wrapper: strict
    ? ({ children }) => <StrictMode>{wrapper({ children })}</StrictMode> : wrapper })
}
beforeEach(() => {
  window.history.replaceState({}, "", "/")
  jest.clearAllMocks()
  mockSettings.mockReset().mockResolvedValue({ data: { about: "Hydrated settings" }, error: null })
  mockClient.auth.getSession.mockReset().mockResolvedValue({ data: { session: mockSession } })
  jest.mocked(fetchAccessibleSitesClient).mockReset().mockResolvedValue(response())
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem("currentSiteId", first.id)
  cacheSiteSelection("owner", first)
})

it("shows the cached project and recovers its list on POS without rehydrating settings", async () => {
  jest.useFakeTimers()
  window.history.replaceState({}, "", "/pos")
  sessionStorage.setItem("preventAutoRefresh", "true")
  try {
    jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(new Promise(() => {}))
    const { result } = mount()
    await act(async () => { await Promise.resolve() })
    expect(result.current.sites).toEqual([])
    expect(screen.getByRole("button", { name: "First" })).toBeInTheDocument()
    expect(result.current.isLoading).toBe(false)
    await act(async () => jest.advanceTimersByTime(SITE_HYDRATION_TIMEOUT_MS))
    expect(screen.getByRole("button", { name: "First" })).toBeInTheDocument()
    await act(async () => jest.advanceTimersByTime(5_000))
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2)
    expect(result.current.sites).toHaveLength(2)
    expect(result.current.currentSite?.id).toBe(first.id)
    expect(result.current.isLoading).toBe(false)
    expect(mockSettings).toHaveBeenCalledTimes(1)
    await act(async () => jest.advanceTimersByTime(120_000))
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2)
  } finally {
    window.history.replaceState({}, "", "/")
    jest.useRealTimers()
  }
})

it("does not bypass POS refresh prevention once the list has loaded", async () => {
  window.history.replaceState({}, "", "/pos")
  sessionStorage.setItem("preventAutoRefresh", "true")
  const { result } = mount()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => { await result.current.refreshSites({ recoverMissingList: true }) })
  expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(1)
  window.history.replaceState({}, "", "/")
})

it("offers recovery instead of an empty-project message when opening a cached selector", async () => {
  jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(new Promise(() => {}))
  const { result } = mount()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  fireEvent.keyDown(screen.getByRole("button", { name: "First" }), { key: "Enter" })
  expect(await screen.findByText(/project list is not available yet/i)).toBeInTheDocument()
  expect(screen.queryByText("layout.sidebar.noProjectsFound")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Choose project" })).toBeInTheDocument()
  expect(mockSettings).toHaveBeenCalledTimes(1)
})

it("prefers the newer auth event over a pending session read, including shared sites", async () => {
  const session = deferred<{ data: { session: typeof mockSession } }>()
  mockClient.auth.getSession.mockReturnValueOnce(session.promise)
  const { result } = mount()
  await waitFor(() => expect(mockClient.auth.getSession).toHaveBeenCalledTimes(1))
  act(() => mockAuth("SIGNED_IN", { user: { id: "other-owner" } }))
  await act(async () => session.resolve({ data: { session: mockSession } }))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.sites).toHaveLength(2)
  expect(result.current.currentSite).toBeNull()
  expect(mockSettings).not.toHaveBeenCalled()
  expect(localStorage.getItem(SITE_SELECTION_CACHE_KEY)).toBeNull()
  expect(localStorage.getItem("currentSiteId")).toBeNull()
})

it.each([false, true])("requires explicit selection after removal with the real sidebar (StrictMode=%s)", async strict => {
  const { result } = mount(strict)
  await waitFor(() => expect(result.current.currentSite?.settings?.about).toBe("Hydrated settings"))
  jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce(response([second]))
  await act(async () => { await result.current.refreshSites() })
  expect(result.current.sites).toHaveLength(1)
  expect(result.current.currentSite).toBeNull()
  expect(localStorage.getItem("currentSiteId")).toBeNull()
  expect(localStorage.getItem(SITE_SELECTION_CACHE_KEY)).toBeNull()
  await act(async () => { await result.current.setCurrentSite(second) })
  expect(result.current.currentSite?.id).toBe(second.id)
})

it.each(["success", "denial", "signout"])("retries the list independently of slow settings: %s", async outcome => {
  jest.useFakeTimers()
  try {
    const settings = deferred<{ data: { about: string }; error: null }>()
    mockSettings.mockReturnValueOnce(settings.promise)
    const denied = { ...response([]), unauthorized: true }
    jest.mocked(fetchAccessibleSitesClient).mockResolvedValue(denied)
    if (outcome === "success") jest.mocked(fetchAccessibleSitesClient)
      .mockResolvedValueOnce(denied).mockResolvedValue(response())
    const { result } = mount()
    await act(async () => { await Promise.resolve() })
    expect(mockSettings).toHaveBeenCalledTimes(1)
    if (outcome === "signout") act(() => mockAuth("SIGNED_OUT", null))
    await act(async () => jest.advanceTimersByTime(400))
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(outcome === "signout" ? 1 : 2)
    if (outcome === "success") {
      expect(result.current.sites).toHaveLength(2)
      expect(result.current.isLoading).toBe(true)
    } else {
      await act(async () => jest.advanceTimersByTime(400))
      expect(result.current.currentSite).toBeNull()
      expect(result.current.isLoading).toBe(false)
    }
    await act(async () => settings.resolve({ data: { about: "Hydrated settings" }, error: null }))
    expect(result.current.currentSite?.id ?? null).toBe(outcome === "success" ? first.id : null)
    expect(mockSettings).toHaveBeenCalledTimes(1)
    expect(result.current.isLoading).toBe(false)
  } finally { jest.useRealTimers() }
})

it("shares the original deadline with a stalled retry and ignores its late success", async () => {
  jest.useFakeTimers()
  try {
    const retry = deferred<ReturnType<typeof response>>()
    jest.mocked(fetchAccessibleSitesClient)
      .mockResolvedValueOnce({ ...response([]), unauthorized: true })
      .mockReturnValueOnce(retry.promise)
    const { result } = mount()
    await act(async () => { await Promise.resolve() })
    await act(async () => jest.advanceTimersByTime(400))
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2)
    await act(async () => jest.advanceTimersByTime(SITE_HYDRATION_TIMEOUT_MS - 400))
    expect(result.current.error?.message).toContain("timed out")
    expect(result.current.currentSite?.id).toBe(first.id)
    await act(async () => retry.resolve(response([])))
    expect(result.current.currentSite?.id).toBe(first.id)
    expect(result.current.sites).toEqual([])
    expect(result.current.isLoading).toBe(false)
  } finally { jest.useRealTimers() }
})