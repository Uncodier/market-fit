import { act, renderHook } from "@testing-library/react"
import { useRef, useState } from "react"
import { useSiteLoadingLifecycle, SITE_HYDRATION_TIMEOUT_MS } from "@/app/context/site-loading-lifecycle"
import { fetchAccessibleSitesClient } from "@/lib/sites/fetch-accessible-sites"
import { refreshSiteBillingRecord } from "@/app/context/site-refresh-billing"
import type { Site } from "@/app/context/site-types"

jest.mock("@/lib/sites/fetch-accessible-sites", () => ({ fetchAccessibleSitesClient: jest.fn() }))
jest.mock("@/app/context/site-refresh-billing", () => ({ refreshSiteBillingRecord: jest.fn() }))
jest.mock("@/lib/demo-utils", () => ({ isDemoModeActive: () => false, getDemoSiteId: () => null,
  resolvePreferredSiteId: ({ savedSiteId }: { savedSiteId: string }) => savedSiteId }))

const first = { id: "11111111-1111-4111-8111-111111111111", name: "First", user_id: "owner",
  settings: { about: "Ready" }, billing_read_status: "unavailable" } as Site
const second = { ...first, id: "22222222-2222-4222-8222-222222222222", name: "Second" }
const response = (sites: Site[], authoritative = true) => ({ sites, authoritative,
  error: null, aborted: false, unauthorized: false })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function mount(initialized = true, initialSite: Site | null = first) {
  return renderHook(() => {
    const [currentSite, setCurrentSite] = useState<Site | null>(initialSite)
    const [sites, setSites] = useState<Site[]>([first])
    const [isInitialized, setIsInitialized] = useState(initialized)
    const [isLoading, setIsLoading] = useState(false)
    const [sitesLoaded, setSitesLoaded] = useState(false)
    const authUserIdRef = useRef<string | null>("owner")
    const lifecycle = useSiteLoadingLifecycle({
      currentSite, setCurrentSite,
      setSites, isInitialized, setIsInitialized, isMounted: true,
      supabaseRef: useRef({ auth: { getSession: async () => ({ data: { session: null } }) },
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: first.settings, error: null }) }) }) }) }),
      authUserIdRef, unauthorizedRetryRef: useRef(0), setIsLoading,
      setSitesLoaded, setSitesLoadAttempted: jest.fn(),
      setError: jest.fn(), setHasValidSession: jest.fn(),
    })
    return { ...lifecycle, currentSite, sites, isLoading, sitesLoaded, authUserIdRef }
  })
}
beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  localStorage.setItem("currentSiteId", first.id)
  jest.mocked(fetchAccessibleSitesClient).mockReset().mockResolvedValue(response([first]))
  jest.mocked(refreshSiteBillingRecord).mockReset().mockResolvedValue(undefined)
})

it.each([false, true])("keeps an absent selection on the first cache hit (initialized=%s), then revalidates", async initialized => {
  const fresh = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce({ ...response([second], false), revalidateAfterMs: 60_000 })
    .mockReturnValueOnce(fresh.promise)
  const { result } = mount(initialized)
  let loading!: Promise<void>
  await act(async () => { loading = result.current.loadSites() })
  expect(result.current.currentSite?.id).toBe(first.id)
  expect(result.current.sites.map(site => site.id)).toEqual([second.id, first.id])
  expect(localStorage.getItem("currentSiteId")).toBe(first.id)
  expect(result.current.isLoading).toBe(false)
  expect(fetchAccessibleSitesClient).toHaveBeenLastCalledWith(expect.anything(), first.id,
    expect.any(AbortSignal), true)
  await act(async () => { fresh.resolve(response([second])); await loading })
  expect(result.current.currentSite).toBeNull()
  expect(localStorage.getItem("currentSiteId")).toBeNull()
})

it('uses a fresh cache hit without querying again until its freshness budget expires', async () => {
  jest.useFakeTimers()
  try {
    jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce({ ...response([first], false), revalidateAfterMs: 35_000 })
    const { result } = mount()
    await act(async () => { await result.current.loadSites() })
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(1)
    expect(result.current.isLoading).toBe(false)
    await act(async () => jest.advanceTimersByTime(34_999))
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(1)
    await act(async () => jest.advanceTimersByTime(1))
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2)
    expect(fetchAccessibleSitesClient).toHaveBeenLastCalledWith(expect.anything(), first.id, expect.any(AbortSignal), true)
    expect(result.current.currentSite?.id).toBe(first.id)
    await act(async () => jest.advanceTimersByTime(120_000))
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2)
  } finally { jest.useRealTimers() }
})

it.each(['signout', 'selection', 'unmount', 'refresh'])('cancels scheduled cache revalidation on %s', async reason => {
  jest.useFakeTimers()
  try {
    jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce({ ...response([first], false), revalidateAfterMs: 60_000 })
    const view = mount()
    await act(async () => { await view.result.current.loadSites() })
    await act(async () => {
      if (reason === 'signout') view.result.current.invalidate()
      if (reason === 'selection') await view.result.current.selectSite(second)
      if (reason === 'refresh') await view.result.current.loadSites(true)
      if (reason === 'unmount') view.unmount()
    })
    await act(async () => jest.advanceTimersByTime(120_000))
    expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(reason === 'refresh' ? 2 : 1)
  } finally { jest.useRealTimers() }
})

it("loads billing independently and ignores its late setters after invalidation", async () => {
  const billing = deferred<void>()
  jest.mocked(refreshSiteBillingRecord).mockReturnValueOnce(billing.promise)
  const { result } = mount()
  await act(async () => { await result.current.loadSites() })
  expect(result.current.isLoading).toBe(false)
  expect(refreshSiteBillingRecord).toHaveBeenCalledWith(first.id, expect.anything())
  const setters = jest.mocked(refreshSiteBillingRecord).mock.calls[0][1]
  act(() => result.current.invalidate())
  act(() => setters.setCurrentSite(previous => previous ? { ...previous, name: "Stale" } : previous))
  expect(result.current.currentSite?.name).toBe("First")
  await act(async () => billing.resolve())
})

it("loads billing on explicit slim-row selection without blocking settings or surfacing billing errors", async () => {
  const billing = deferred<void>()
  jest.mocked(refreshSiteBillingRecord).mockReturnValueOnce(billing.promise)
  const { result } = mount()
  await act(async () => { await result.current.selectSite(second) })
  expect(result.current.currentSite?.id).toBe(second.id)
  expect(result.current.currentSite?.settings?.about).toBe("Ready")
  expect(result.current.isLoading).toBe(false)
  expect(refreshSiteBillingRecord).toHaveBeenCalledWith(second.id, expect.anything())
  await act(async () => billing.resolve())
  jest.mocked(refreshSiteBillingRecord).mockRejectedValueOnce(new Error("Unavailable"))
  await act(async () => { await result.current.selectSite(first) })
  expect(result.current.currentSite?.settings?.about).toBe("Ready")
  expect(result.current.isLoading).toBe(false)
})

it("does not enable redirects on a cache miss without a recovered identity", async () => {
  const fresh = deferred<ReturnType<typeof response>>()
  jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce(response([second], false))
    .mockReturnValueOnce(fresh.promise)
  const { result } = mount(false, null)
  let pending!: Promise<void>
  await act(async () => { pending = result.current.loadSites() })
  expect(result.current.sitesLoaded).toBe(false)
  expect(result.current.currentSite).toBeNull()
  expect(localStorage.getItem("currentSiteId")).toBe(first.id)
  await act(async () => { fresh.resolve(response([first, second])); await pending })
  expect(result.current.currentSite?.id).toBe(first.id)
  expect(result.current.sitesLoaded).toBe(true)
})

it("preserves a first-time hydrated selection when fresh revalidation reaches its deadline", async () => {
  jest.useFakeTimers()
  try {
    jest.mocked(fetchAccessibleSitesClient).mockResolvedValueOnce(response([first], false))
      .mockReturnValueOnce(new Promise(() => {}))
    const { result } = mount(false, null)
    let pending!: Promise<void>
    await act(async () => { pending = result.current.loadSites() })
    expect(result.current.currentSite?.settings?.about).toBe("Ready")
    expect(result.current.isLoading).toBe(false)
    await act(async () => { jest.advanceTimersByTime(SITE_HYDRATION_TIMEOUT_MS); await pending })
    expect(result.current.currentSite?.id).toBe(first.id)
    expect(result.current.currentSite?.settings?.about).toBe("Ready")
    expect(jest.mocked(fetchAccessibleSitesClient).mock.calls[1][2]?.aborted).toBe(true)
  } finally { jest.useRealTimers() }
})

it("aborts invalidated HTTP and lets a new identity load without the old promise settling", async () => {
  jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(new Promise(() => {}))
  const { result } = mount(false)
  let old!: Promise<void>
  await act(async () => { old = result.current.loadSites() })
  const signal = jest.mocked(fetchAccessibleSitesClient).mock.calls[0][2]!
  act(() => { result.current.invalidate(); result.current.authUserIdRef.current = "next-owner" })
  await act(async () => { await old; await result.current.loadSites() })
  expect(signal.aborted).toBe(true)
  expect(fetchAccessibleSitesClient).toHaveBeenCalledTimes(2)
})

it.each(["deadline", "unmount", "replacement"])("aborts pending HTTP on %s", async reason => {
  jest.useFakeTimers()
  try {
    jest.mocked(fetchAccessibleSitesClient).mockReturnValueOnce(new Promise(() => {}))
    const view = mount()
    let pending!: Promise<void>
    await act(async () => { pending = view.result.current.loadSites() })
    const signal = jest.mocked(fetchAccessibleSitesClient).mock.calls[0][2]!
    await act(async () => {
      if (reason === "deadline") jest.advanceTimersByTime(SITE_HYDRATION_TIMEOUT_MS)
      else if (reason === "unmount") view.unmount()
      else await view.result.current.loadSites()
      await pending
    })
    expect(signal.aborted).toBe(true)
  } finally { jest.useRealTimers() }
})