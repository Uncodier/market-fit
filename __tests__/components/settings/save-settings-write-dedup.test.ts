import { toast } from "sonner"
import { siteFormSchema, type SiteFormValues } from "@/app/components/settings/form-schema"
import {
  handleSaveCompany,
  handleSaveGeneral,
  handleSavePrinters,
  handleSaveShop,
} from "@/app/components/settings/save-general-settings"
import {
  handleSaveBranding,
  handleSaveCustomerJourney,
  handleSaveMarketing,
  handleSaveSocial,
} from "@/app/components/settings/save-marketing-settings"
import { handleSaveChannels } from "@/app/components/settings/save-channel-settings"
import { handleSave } from "@/app/components/settings/save-all-settings"
import { saveSiteWithSettings, shouldPreventRefresh, type SaveOptions } from "@/app/components/settings/save-settings-shared"
import { requestVoiceAgentResync } from "@/app/agents/voice-sync"
import type { Site, SiteSettings } from "@/app/context/site-types"

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/agents/voice-sync", () => ({
  requestVoiceAgentResync: jest.fn().mockResolvedValue(undefined),
}))
jest.mock("@/app/components/settings/outreach-segments", () => ({
  fetchOutreachSegments: jest.fn().mockResolvedValue([]),
}))
jest.mock("@/app/services/secure-tokens-service", () => ({
  secureTokensService: { storeToken: jest.fn().mockResolvedValue(undefined) },
}))
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-a" } }, error: null }) },
  })),
}))
jest.mock("@/app/context/copywriting-actions", () => ({
  copywritingService: { syncCopywritingItems: jest.fn().mockResolvedValue({ success: true }) },
}))

function createOptions() {
  const currentSite: Site = {
    id: "site-a",
    name: "Original site",
    url: "https://example.com",
    description: null,
    logo_url: null,
    user_id: "user-a",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    resource_urls: [],
    settings: {
      id: "settings-a",
      site_id: "site-a",
      about: "Stale company information",
      focus_mode: 10,
      marketing_budget: { total: 10, available: 5 },
      channels: {
        email: { enabled: false, email: "old@example.com", password: "" },
        website: { chat_title: "Stale chat title" },
      },
      shop: { hero_title: "Stale shop title" },
      goals: { quarterly: "Stale goal" },
    },
  }
  const updateSettings = jest.fn<Promise<void>, [string, Partial<SiteSettings>]>()
    .mockResolvedValue(undefined)
  // Model the writer contract: nested settings cause an implicit settings write.
  const updateSite = jest.fn<Promise<void>, [Site, { syncVoiceAgent?: boolean }?]>(async site => {
    if (site.settings) await updateSettings(site.id, site.settings)
  })

  return {
    currentSite,
    updateSite,
    updateSettings,
    refreshSites: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    setIsSaving: jest.fn(),
  } satisfies SaveOptions
}

function createForm(): SiteFormValues {
  return siteFormSchema.parse({
    name: "Updated site",
    url: "https://updated.example.com",
    focusMode: 72,
    default_locale: "fr",
    company: {},
    about: "Updated company information",
    channels: { email: { email: "new@example.com" }, whatsapp: {} },
    tracking: { enable_chat: true, chat_title: "Updated chat title" },
    marketing_budget: { total: 400, available: 200 },
    branding: { brand_essence: "Updated brand" },
    shop: { hero_title: "Updated shop title" },
    printers: { devices: [] },
    customer_journey: { awareness: { actions: ["Updated action"] } },
    social_media: [{ platform: "linkedin", handle: "updated-company", isActive: true }],
    goals: { quarterly: "Updated goal", yearly: "", fiveYear: "", tenYear: "" },
  })
}

const settingsOnlySaves = [
  { name: "Shop", save: handleSaveShop, settingsKey: "shop" },
  { name: "Printers", save: handleSavePrinters, settingsKey: "printers" },
  { name: "Company", save: handleSaveCompany, settingsKey: "about" },
  { name: "Branding", save: handleSaveBranding, settingsKey: "branding" },
  { name: "Customer Journey", save: handleSaveCustomerJourney, settingsKey: "customer_journey" },
  { name: "Social", save: handleSaveSocial, settingsKey: "social_media" },
  { name: "Marketing without resources", save: handleSaveMarketing, settingsKey: "marketing_budget" },
] as const

const combinedSaves = [
  { name: "General", save: handleSaveGeneral, settingsKey: "default_locale" },
  { name: "Marketing", save: handleSaveMarketing, settingsKey: "marketing_budget" },
  { name: "Marketing clearing resources", save: handleSaveMarketing, settingsKey: "marketing_budget" },
  { name: "Channels", save: handleSaveChannels, settingsKey: "channels" },
  { name: "Save All", save: handleSave, settingsKey: "goals" },
] as const

const allSaves = [...settingsOnlySaves, ...combinedSaves]
const resource = { key: "Guide", url: "https://example.com/guide" }

describe("settings save write ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "log").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    sessionStorage.clear()
    localStorage.clear()
  })

  describe.each([true, false])("preventAutoRefresh=%s", preventAutoRefresh => {
    beforeEach(() => {
      sessionStorage.setItem("preventAutoRefresh", String(preventAutoRefresh))
    })

    it.each(settingsOnlySaves)("$name writes settings once and never writes the site", async ({ save, settingsKey }) => {
      const options = createOptions()
      const data = createForm()
      const originalSettings = options.currentSite.settings

      await save(data, options)

      expect(options.updateSettings).toHaveBeenCalledTimes(1)
      expect(options.updateSettings).toHaveBeenCalledWith(options.currentSite.id, expect.objectContaining({
        site_id: options.currentSite.id,
        id: originalSettings?.id,
        [settingsKey]: data[settingsKey],
      }))
      expect(options.updateSite).not.toHaveBeenCalled()
      expect(requestVoiceAgentResync).not.toHaveBeenCalled()
      expect(options.currentSite.settings).toBe(originalSettings)
      expect(options.refreshSites).toHaveBeenCalledTimes(preventAutoRefresh ? 0 : 1)
      expect(toast.error).not.toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledTimes(1)
      expect(options.setIsSaving.mock.calls).toEqual([[true], [false]])
    })

    it.each(combinedSaves)("$name writes each record once without stale nested settings", async ({ name, save, settingsKey }) => {
      const options = createOptions()
      const data = createForm()
      if (name === "Save All") {
        data.channels.connections = [{ id: "voice-1", name: "Support voice", status: "connected", type: "voice", enabled: true }]
      }
      if (name === "Marketing clearing resources") options.currentSite.resource_urls = [resource]
      else data.resource_urls = [resource]

      await save(data, options)

      expect(options.updateSite).toHaveBeenCalledTimes(1)
      const [siteWrite, writeOptions] = options.updateSite.mock.calls[0]
      expect(siteWrite).toHaveProperty("settings", undefined)
      expect(writeOptions).toEqual({ syncVoiceAgent: false })
      expect(siteWrite.id).toBe(options.currentSite.id)
      expect(options.updateSettings).toHaveBeenCalledTimes(1)
      const [siteId, settingsWrite] = options.updateSettings.mock.calls[0]
      expect(requestVoiceAgentResync).not.toHaveBeenCalled()
      expect(siteId).toBe(options.currentSite.id)
      expect(settingsWrite).toMatchObject({ id: "settings-a", site_id: "site-a" })
      if (settingsKey === "channels") {
        expect(settingsWrite.channels?.email?.email).toBe("new@example.com")
        expect(settingsWrite.channels?.website?.chat_title).toBe("Updated chat title")
        expect(siteWrite.tracking?.chat_title).toBe("Updated chat title")
      } else {
        expect(settingsWrite[settingsKey]).toEqual(data[settingsKey])
        expect(siteWrite.resource_urls).toEqual(data.resource_urls)
      }
      if (name === "General" || name === "Save All") expect(siteWrite.name).toBe(data.name)
      if (name === "Save All") {
        expect(settingsWrite.shop).toEqual({ ...options.currentSite.settings?.shop, ...data.shop })
        expect(settingsWrite.channels?.connections).toEqual(data.channels.connections)
      }
      expect(options.updateSite.mock.invocationCallOrder[0]).toBeLessThan(options.updateSettings.mock.invocationCallOrder[0])
      expect(options.refreshSites).toHaveBeenCalledTimes(preventAutoRefresh ? 0 : 1)
      if (!preventAutoRefresh) {
        expect(options.updateSettings.mock.invocationCallOrder[0]).toBeLessThan(options.refreshSites.mock.invocationCallOrder[0])
      }
      expect(toast.error).not.toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledTimes(1)
      expect(options.setIsSaving.mock.calls).toEqual([[true], [false]])
    })

    it.each(combinedSaves)("$name resyncs persisted site changes when the settings write fails", async ({ name, save }) => {
      const options = createOptions()
      const data = createForm()
      if (name === "Marketing clearing resources") options.currentSite.resource_urls = [resource]
      else data.resource_urls = [resource]
      const settingsError = new Error("Settings write failed")
      options.updateSettings.mockRejectedValueOnce(settingsError)

      await save(data, options)

      expect(options.updateSite).toHaveBeenCalledTimes(1)
      expect(options.updateSite).toHaveBeenCalledWith(
        expect.objectContaining({ settings: undefined }), { syncVoiceAgent: false },
      )
      expect(options.updateSettings).toHaveBeenCalledTimes(1)
      expect(requestVoiceAgentResync).toHaveBeenCalledTimes(1)
      expect(requestVoiceAgentResync).toHaveBeenCalledWith(options.currentSite.id)
      expect(options.updateSettings.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(requestVoiceAgentResync).mock.invocationCallOrder[0])
      expect(toast.error).toHaveBeenCalledWith(`Error: ${settingsError.message}`)
      expect(toast.success).not.toHaveBeenCalled()
      expect(options.refreshSites).not.toHaveBeenCalled()
      expect(options.setIsSaving.mock.calls).toEqual([[true], [false]])
    })

    it.each(combinedSaves)("$name does not write settings or request resync if the site write fails", async ({ name, save }) => {
      const options = createOptions()
      const data = createForm()
      if (name === "Marketing clearing resources") options.currentSite.resource_urls = [resource]
      else data.resource_urls = [resource]
      const siteError = new Error("Site write failed")
      options.updateSite.mockRejectedValueOnce(siteError)

      await save(data, options)

      expect(options.updateSite).toHaveBeenCalledTimes(1)
      expect(options.updateSettings).not.toHaveBeenCalled()
      expect(requestVoiceAgentResync).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith(`Error: ${siteError.message}`)
      expect(toast.success).not.toHaveBeenCalled()
      expect(options.refreshSites).not.toHaveBeenCalled()
      expect(options.setIsSaving.mock.calls).toEqual([[true], [false]])
    })

    it.each(settingsOnlySaves)("$name does not request a fallback resync if its settings-only write fails", async ({ save }) => {
      const options = createOptions()
      options.updateSettings.mockRejectedValueOnce(new Error("Settings write failed"))

      await save(createForm(), options)

      expect(options.updateSettings).toHaveBeenCalledTimes(1)
      expect(options.updateSite).not.toHaveBeenCalled()
      expect(requestVoiceAgentResync).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledTimes(1)
      expect(toast.success).not.toHaveBeenCalled()
      expect(options.refreshSites).not.toHaveBeenCalled()
    })
  })

  it("awaits fallback synchronization acceptance and rethrows the original settings error", async () => {
    const options = createOptions()
    const settingsError = new Error("Settings write failed")
    options.updateSettings.mockRejectedValueOnce(settingsError)
    let acceptSync!: () => void
    let syncStarted!: () => void
    const started = new Promise<void>(resolve => { syncStarted = resolve })
    const acceptance = new Promise<void>(resolve => { acceptSync = resolve })
    jest.mocked(requestVoiceAgentResync).mockImplementationOnce(() => {
      syncStarted()
      return acceptance
    })
    let settled = false
    const save = saveSiteWithSettings(options.currentSite, { about: "Updated" }, options)
      .catch(error => { settled = true; return error })

    await started
    try {
      expect(settled).toBe(false)
      expect(requestVoiceAgentResync).toHaveBeenCalledTimes(1)
    } finally {
      acceptSync()
    }
    expect(await save).toBe(settingsError)
  })

  it.each(allSaves)("$name awaits the permitted refresh before reporting success", async ({ name, save }) => {
    const options = createOptions()
    const data = createForm()
    if (name === "Marketing") data.resource_urls = [resource]
    if (name === "Marketing clearing resources") options.currentSite.resource_urls = [resource]
    let finishRefresh!: () => void
    let refreshStarted!: () => void
    const started = new Promise<void>(resolve => { refreshStarted = resolve })
    const pendingRefresh = new Promise<void>(resolve => { finishRefresh = resolve })
    options.refreshSites.mockImplementation(() => {
      refreshStarted()
      return pendingRefresh
    })

    const saving = save(data, options)
    await started

    try {
      expect(toast.error).not.toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()
      expect(options.setIsSaving.mock.calls).toEqual([[true]])
    } finally {
      finishRefresh()
      await saving
    }
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(options.setIsSaving.mock.calls).toEqual([[true], [false]])
  })

  it.each(["JUST_BECAME_VISIBLE", "JUST_GAINED_FOCUS"])("continues respecting %s independently of preventAutoRefresh", flag => {
    sessionStorage.setItem("preventAutoRefresh", "false")
    expect(shouldPreventRefresh()).toBe(false)
    sessionStorage.setItem(flag, "true")
    expect(shouldPreventRefresh()).toBe(true)
  })
})