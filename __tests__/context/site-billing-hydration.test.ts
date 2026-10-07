import type { Dispatch, SetStateAction } from "react"
import type { Site } from "@/app/context/site-types"
import { applyCurrentSite } from "@/app/context/site-set-current"
import { refreshSiteBillingRecord } from "@/app/context/site-refresh-billing"
import { createClient } from "@/lib/supabase/client"
import { captureBillingRevision, markBillingRefreshed, mergeLoadedSiteBilling } from "@/app/context/site-billing-freshness"
import { loadAccessibleSites } from "@/app/context/site-load-sites"
import { fetchAccessibleSitesClient } from "@/lib/sites/fetch-accessible-sites"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/sites/fetch-accessible-sites", () => ({ fetchAccessibleSitesClient: jest.fn() }))
jest.mock("@/lib/demo-utils", () => ({ isDemoModeActive: () => false, getDemoSiteId: () => null, resolvePreferredSiteId: () => null }))

const siteId = "11111111-1111-4111-8111-111111111111"
const saved = { id: siteId, name: "Saved project", user_id: "owner", description: null, logo_url: null } as Site
const balance = { plan: "commission", credits_available: 1, auto_renew: true } as NonNullable<Site["billing"]>
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function state(site: Site = saved) {
  let sites = [site]
  let current: Site | null = null
  const setSites: Dispatch<SetStateAction<Site[]>> = value => { sites = typeof value === "function" ? value(sites) : value }
  const setCurrentSite: Dispatch<SetStateAction<Site | null>> = value => { current = typeof value === "function" ? value(current) : value }
  return { setSites, setCurrentSite, sites: () => sites, current: () => current }
}
beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  const query = { select: jest.fn(), eq: jest.fn(), abortSignal: jest.fn(), single: jest.fn() }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.abortSignal.mockReturnValue(query)
  query.single.mockResolvedValue({ data: balance, error: null })
  jest.mocked(createClient).mockReturnValue({ from: () => query } as never)
})

it("keeps the freshly loaded credit in both states when earlier details/settings finally arrive", async () => {
  const details = deferred<{ data: Record<string, unknown>; error: null }>()
  const settings = deferred<{ data: Record<string, unknown>; error: null }>()
  const model = state()
  const supabase = { from: (table: string) => ({ select: () => ({ eq: () => ({ single: () => table === "sites" ? details.promise : settings.promise }) }) }) }
  const selecting = applyCurrentSite({ site: saved, currentSite: null, supabase, ...model })
  await refreshSiteBillingRecord(siteId, model)
  expect(model.current()?.billing?.credits_available).toBe(1)
  details.resolve({ data: { name: "Loaded project", description: "Saved details" }, error: null })
  settings.resolve({ data: { id: "settings", site_id: siteId, about: "Saved context" }, error: null })
  await selecting
  expect(model.current()?.billing?.credits_available).toBe(1)
  expect(model.sites()[0].billing?.credits_available).toBe(1)
  expect(model.current()?.settings?.about).toBe("Saved context")
})

it("does not switch the active project when a stale detail response completes", async () => {
  const details = deferred<{ data: Record<string, unknown>; error: null }>()
  const model = state({ ...saved, settings: { about: "Saved" } } as Site)
  const selecting = applyCurrentSite({ site: model.sites()[0], currentSite: null,
    supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => details.promise }) }) }) }, ...model })
  const other = { ...saved, id: "22222222-2222-4222-8222-222222222222" }
  model.setCurrentSite(other)
  details.resolve({ data: { name: "Loaded" }, error: null })
  await selecting
  expect(model.current()).toBe(other)
})

it("a full-site load begun before initialization cannot erase the targeted billing read", async () => {
  const model = state()
  const response = deferred<Awaited<ReturnType<typeof fetchAccessibleSitesClient>>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValue(response.promise)
  const loading = loadAccessibleSites({
    supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: "owner" } } } }) } },
    isMounted: true, isInitialized: true, currentSite: null, unauthorizedRetryRef: { current: 0 },
    setSitesLoaded: jest.fn(), setSitesLoadAttempted: jest.fn(), setIsLoading: jest.fn(),
    setError: jest.fn(), setHasValidSession: jest.fn(), setIsInitialized: jest.fn(),
    setSites: model.setSites, selectSite: jest.fn(), reload: jest.fn(),
  })
  await refreshSiteBillingRecord(siteId, model)
  response.resolve({ sites: [saved], detail: null, error: null, aborted: false, unauthorized: false })
  await loading
  expect(model.sites()[0].billing?.credits_available).toBe(1)
})

it("lets later full loads replace a previous targeted balance without permanently caching credit", () => {
  const billing = { ...balance }
  markBillingRefreshed(billing)
  const began = captureBillingRevision()
  const spent = { ...saved, billing: { ...balance, credits_available: 0.6 } }
  expect(mergeLoadedSiteBilling([{ ...saved, billing }], [spent], began)[0]).toBe(spent)
})

it("preserves refreshed active billing when a stale selection closure begins after the credit read", async () => {
  const model = state({ ...saved, settings: { about: "Saved" } } as Site)
  model.setCurrentSite(model.sites()[0])
  await refreshSiteBillingRecord(siteId, model)
  // A loader captured currentSite=null before initialization, but invokes selection later.
  await applyCurrentSite({ site: { ...saved, settings: { about: "Saved" } } as Site, currentSite: null, supabase: null, ...model })
  expect(model.current()?.billing?.credits_available).toBe(1)
})