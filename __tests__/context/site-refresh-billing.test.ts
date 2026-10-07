import { BILLING_READ_TIMEOUT_MS, refreshSiteBillingRecord } from "@/app/context/site-refresh-billing"
import { createClient } from "@/lib/supabase/client"
import type { Site } from "@/app/context/site-types"
import { renderHook, act } from "@testing-library/react"
import { useBilling } from "@/app/hooks/use-billing"
import { useSite } from "@/app/context/SiteContext"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const site = { id: siteId, name: "Saved project", settings: { about: "Keep this" } } as Site
const otherSite = { id: "33333333-3333-4333-8333-333333333333", name: "Other project" } as Site
const billing = { plan: "commission", credits_available: 1, auto_renew: true }
const query = { select: jest.fn(), eq: jest.fn(), abortSignal: jest.fn(), single: jest.fn() }
const from = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.abortSignal.mockReturnValue(query)
  query.single.mockResolvedValue({ data: billing, error: null })
  from.mockReturnValue(query)
  jest.mocked(createClient).mockReturnValue({ from } as never)
})

it("reads RLS billing and refreshes both visible active credits and the site list without losing settings", async () => {
  let sites = [site, otherSite]
  let current: Site | null = site
  const deps = {
    setSites: jest.fn(updater => { sites = updater(sites) }),
    setCurrentSite: jest.fn(updater => { current = updater(current) }),
  }
  await refreshSiteBillingRecord(siteId, deps)
  expect(from).toHaveBeenCalledWith("billing")
  expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
  expect(query.select.mock.calls[0][0].split(", ")).not.toContain("card_number")
  expect(query.select.mock.calls[0][0].split(", ")).not.toContain("card_cvc")
  expect(current).toEqual({ ...site, billing })
  expect(sites).toEqual([{ ...site, billing }, otherSite])
})

it("cannot switch the active site if the user switches while the billing read is pending", async () => {
  let current: Site | null = otherSite
  await refreshSiteBillingRecord(siteId, {
    setSites: jest.fn(), setCurrentSite: updater => { current = typeof updater === "function" ? updater(current) : updater },
  })
  expect(current).toBe(otherSite)
})

it("does not replace persisted credits on missing/failed read", async () => {
  query.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } })
  const deps = { setSites: jest.fn(), setCurrentSite: jest.fn() }
  await expect(refreshSiteBillingRecord(siteId, deps)).rejects.toThrow("could not be loaded")
  expect(deps.setCurrentSite).not.toHaveBeenCalled()
  expect(deps.setSites).not.toHaveBeenCalled()
})

it("does not call a real billing read for demos", async () => {
  await refreshSiteBillingRecord("demo-test", { setSites: jest.fn(), setCurrentSite: jest.fn() })
  expect(createClient).not.toHaveBeenCalled()
})

it("bounds a stalled read, aborts it and never applies a response arriving after timeout", async () => {
  jest.useFakeTimers()
  try {
    let resolve!: (result: { data: typeof billing; error: null }) => void
    query.single.mockReturnValue(new Promise(done => { resolve = done }))
    const deps = { setSites: jest.fn(), setCurrentSite: jest.fn() }
    const pending = refreshSiteBillingRecord(siteId, deps)
    const rejected = expect(pending).rejects.toThrow("could not be loaded")
    await jest.advanceTimersByTimeAsync(BILLING_READ_TIMEOUT_MS)
    await rejected
    const signal = query.abortSignal.mock.calls[0][0] as AbortSignal
    expect(signal.aborted).toBe(true)
    resolve({ data: billing, error: null })
    await Promise.resolve()
    expect(deps.setSites).not.toHaveBeenCalled()
    expect(deps.setCurrentSite).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})

it("manual credit refresh uses billing-only freshness, not suppressed full-site reloads", async () => {
  const refreshSiteBilling = jest.fn().mockResolvedValue(undefined)
  const refreshSites = jest.fn()
  jest.mocked(useSite).mockReturnValue({ currentSite: { ...site, billing }, refreshSiteBilling, refreshSites } as never)
  const hook = renderHook(() => useBilling())
  await act(async () => { await hook.result.current.refreshCredits() })
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
  expect(refreshSites).not.toHaveBeenCalled()
  expect(hook.result.current.creditsAvailable).toBe(1)
})