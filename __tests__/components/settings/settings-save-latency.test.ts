/** @jest-environment node */

import { requestVoiceAgentResync } from "@/app/agents/voice-sync"
import { persistSiteSettings } from "@/app/context/site-update-settings"
import { updateSiteRecord } from "@/app/context/site-crud"
import type { Site, SiteSettings } from "@/app/context/site-types"

jest.mock("@/lib/sites/logo-cache", () => ({ saveLogoToCache: jest.fn().mockResolvedValue(undefined) }))

const siteId = "00000000-0000-4000-8000-000000000001"
const initialSettings = { site_id: siteId, about: "Old", channels: { connections: [] } } as unknown as SiteSettings
const initialSite = { id: siteId, name: "Old name", settings: initialSettings } as Site

function fixture() {
  let currentSite: Site | null = initialSite
  let sites = [initialSite]
  const latestSettings = { ...initialSettings, about: "Latest", custom_settings: { keep: true } }
  const upsert = jest.fn().mockResolvedValue({ error: null })
  const settingsQuery = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: latestSettings, error: null }), upsert,
  }
  const siteQuery = {
    update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue({ data: [{ ...initialSite, name: "New name" }], error: null }),
  }
  const deps = {
    supabase: { from: jest.fn(table => table === "sites" ? siteQuery : settingsQuery) },
    currentSite: initialSite, sites,
    setCurrentSite: jest.fn((value: Site | null | ((previous: Site | null) => Site | null)) => {
      currentSite = typeof value === "function" ? value(currentSite) : value
    }),
    setSites: jest.fn((value: Site[] | ((previous: Site[]) => Site[])) => {
      sites = typeof value === "function" ? value(sites) : value
    }),
    loadSites: jest.fn(), setError: jest.fn(), setIsLoading: jest.fn(),
    selectSite: jest.fn(), updateSettings: jest.fn(),
    shouldPreventRefresh: () => true, isOnProtectedPage: () => false,
  }
  return { deps, upsert, settingsQuery, siteQuery, current: () => currentSite, sites: () => sites }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(fetch).mockReset().mockResolvedValue({ status: 202 } as Response)
  jest.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it("awaits persistence and only server acceptance, with no verification query or external provider wait", async () => {
  const state = fixture()
  let accept!: (response: Response) => void
  jest.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { accept = resolve }))
  const save = persistSiteSettings({ ...state.deps, siteId, settings: { about: "Updated" } })
  // Flush the existing-row read and the confirmed write.
  await Promise.resolve()
  await Promise.resolve()
  expect(state.upsert).toHaveBeenCalledTimes(1)
  expect(state.deps.setCurrentSite).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledWith("/api/settings/voice-sync", expect.objectContaining({
    method: "POST", credentials: "same-origin", redirect: "error", body: JSON.stringify({ siteId }),
    signal: expect.any(AbortSignal),
  }))
  accept({ status: 202 } as Response)
  await save
  expect(state.settingsQuery.single).toHaveBeenCalledTimes(1)
  expect(state.current()?.settings).toMatchObject({ about: "Updated", custom_settings: { keep: true } })
  expect(state.sites()[0].settings).toEqual(state.current()?.settings)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("publishes paired site/settings writes without clearing settings, reverting site fields or resyncing twice", async () => {
  const state = fixture()
  await updateSiteRecord({ ...initialSite, name: "New name", settings: undefined }, state.deps, { syncVoiceAgent: false })
  expect(state.current()).toMatchObject({ name: "New name", settings: initialSettings })
  expect(fetch).not.toHaveBeenCalled()
  // The dependency closure deliberately still contains the old site name.
  await persistSiteSettings({ ...state.deps, siteId, settings: { about: "Updated" } })
  expect(state.current()).toMatchObject({ name: "New name", settings: { about: "Updated" } })
  expect(state.sites()[0]).toEqual(state.current())
  expect(state.upsert).toHaveBeenCalledTimes(1)
  expect(state.siteQuery.update).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("does not switch the active site back when a save finishes late", async () => {
  const state = fixture()
  const otherSite = { ...initialSite, id: "other-site" }
  state.deps.setCurrentSite(otherSite)
  await persistSiteSettings({ ...state.deps, siteId, settings: { about: "Updated" } })
  expect(state.current()).toBe(otherSite)
  expect(state.sites()[0].settings?.about).toBe("Updated")
})

it("does not schedule a sync or publish success after a failed write", async () => {
  const state = fixture()
  state.upsert.mockResolvedValueOnce({ error: new Error("Write denied") })
  await expect(persistSiteSettings({ ...state.deps, siteId, settings: { about: "Updated" } })).rejects.toThrow("Write denied")
  expect(fetch).not.toHaveBeenCalled()
  expect(state.deps.setCurrentSite).not.toHaveBeenCalled()
  expect(state.deps.setError).toHaveBeenCalled()
})

it("does not misreport an already persisted setting as failed when sync acceptance fails", async () => {
  const state = fixture()
  jest.mocked(fetch).mockRejectedValueOnce(new Error("Network unavailable"))
  await persistSiteSettings({ ...state.deps, siteId, settings: { about: "Updated" } })
  expect(state.current()?.settings?.about).toBe("Updated")
  expect(state.deps.setError).not.toHaveBeenCalled()
  expect(console.error).toHaveBeenCalledWith("Voice agent background synchronization could not be requested")
})

it("keeps resync enabled for standalone site writes", async () => {
  const state = fixture()
  await updateSiteRecord({ ...initialSite, name: "New name", settings: undefined }, state.deps)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(state.current()?.settings).toEqual(initialSettings)
})

it("logs rejection without retrying or accepting a non-202 response as queued", async () => {
  jest.mocked(fetch).mockResolvedValueOnce({ status: 503 } as Response)
  await expect(requestVoiceAgentResync(siteId)).resolves.toBeUndefined()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(console.error).toHaveBeenCalledWith("Voice agent background synchronization was not accepted:", 503)
})

it("preserves demo settings across paired local saves without database or provider traffic", async () => {
  const state = fixture()
  const demoSite = { ...initialSite, id: "demo-site", settings: { ...initialSettings, site_id: "demo-site" } }
  state.deps.setCurrentSite(demoSite)
  state.deps.setSites([demoSite])
  await updateSiteRecord({ ...demoSite, name: "Demo renamed", settings: undefined }, state.deps, { syncVoiceAgent: false })
  expect(state.current()).toMatchObject({ name: "Demo renamed", settings: demoSite.settings })
  await persistSiteSettings({ ...state.deps, siteId: demoSite.id, settings: { about: "Demo updated" } })
  expect(state.current()).toMatchObject({ name: "Demo renamed", settings: { about: "Demo updated", channels: { connections: [] } } })
  expect(state.sites()[0]).toEqual(state.current())
  await requestVoiceAgentResync(demoSite.id)
  expect(fetch).not.toHaveBeenCalled()
  expect(state.deps.supabase.from).not.toHaveBeenCalled()
})

it("publishes settings-only demo saves locally without discarding unrelated settings", async () => {
  const state = fixture()
  const demoSite = {
    ...initialSite, id: "demo-site",
    settings: { ...initialSettings, site_id: "demo-site", shop: { hero_title: "Keep", hero_subtitle: "Old" } },
  }
  state.deps.setCurrentSite(demoSite)
  state.deps.setSites([demoSite])
  await persistSiteSettings({ ...state.deps, siteId: demoSite.id, settings: { shop: { hero_subtitle: "Updated" } } })
  expect(state.current()).toMatchObject({
    name: "Old name", settings: { about: "Old", shop: { hero_title: "Keep", hero_subtitle: "Updated" } },
  })
  expect(state.sites()[0]).toEqual(state.current())
  expect(fetch).not.toHaveBeenCalled()
  expect(state.deps.supabase.from).not.toHaveBeenCalled()
})