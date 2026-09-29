import { handleSaveActivities } from "@/app/components/settings/save-activities"
import { handleSave } from "@/app/components/settings/save-all-settings"
import { handleSaveChannels } from "@/app/components/settings/save-channel-settings"
import { fetchOutreachSegments } from "@/app/components/settings/outreach-segments"
import { applyCurrentSite } from "@/app/context/site-set-current"
import { normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { adaptSiteToForm } from "@/app/components/settings/data-adapter"
import { siteFormSchema, type SiteFormValues } from "@/app/components/settings/form-schema"

jest.mock("@/app/components/settings/outreach-segments", () => ({ fetchOutreachSegments: jest.fn() }))
jest.mock("@/app/services/secure-tokens-service", () => ({ secureTokensService: { storeToken: jest.fn() } }))
jest.mock("@/app/context/copywriting-actions", () => ({ copywritingService: { syncCopywritingItems: jest.fn() } }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const emailId = "11111111-1111-4111-8111-111111111111"
const channels = { connections: [{ id: emailId, type: "email", status: "connected", zavu_sender_id: "sender" }] }
const configured = { status: "active", channel_accounts: { email: [emailId], whatsapp: [] }, segment_ids: ["site-segment"], all_segments: false, daily_message_limit: 51, max_unanswered_messages: 8, weekdays: [0, 6] }
const dynamicChannels = ["sms", "telegram", "voice", "messenger", "instagram", "custom-chat_v2"]
const multichannel = {
  ...configured,
  channel_accounts: { email: [], whatsapp: [], ...Object.fromEntries(dynamicChannels.map(channel => [channel, [`${channel}-id`]])) },
}

describe("outreach persistence", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    jest.mocked(fetchOutreachSegments).mockResolvedValue([{ id: "site-segment", name: "Site segment" }])
    sessionStorage.clear()
  })
  afterEach(() => jest.restoreAllMocks())

  const options = () => ({
    currentSite: { id: "site-a", name: "Site A", url: "https://example.com", settings: { id: "settings-a", channels } } as any,
    updateSite: jest.fn().mockResolvedValue(undefined), updateSettings: jest.fn().mockResolvedValue(undefined),
    refreshSites: jest.fn().mockResolvedValue(undefined), setIsSaving: jest.fn(),
  })

  it("saves all activity parameters and reloads them through the adapter", async () => {
    const opts = options()
    const data = { activities: normalizeActivitySettings({ leads_follow_up: configured }) } as any
    await expect(handleSaveActivities(data, opts)).resolves.toBe(true)
    expect(fetchOutreachSegments).toHaveBeenCalledWith("site-a")
    const saved = opts.updateSettings.mock.calls[0][1]
    expect(saved.activities.leads_follow_up).toEqual(configured)
    expect(saved.activities.leads_initial_cold_outreach.status).toBe("inactive")
    expect(adaptSiteToForm({ ...opts.currentSite, settings: { ...opts.currentSite.settings, ...saved } }).activities.leads_follow_up).toEqual(configured)
  })

  it("validates the actual saved account list and site-scoped segments before saving", async () => {
    const opts = options()
    const data = { channels, activities: normalizeActivitySettings({ leads_follow_up: configured }) } as any
    opts.currentSite.settings.channels = { connections: [] }
    await expect(handleSaveActivities(data, opts)).rejects.toThrow("usable")
    expect(opts.updateSettings).not.toHaveBeenCalled()
    opts.currentSite.settings.channels = channels
    jest.mocked(fetchOutreachSegments).mockResolvedValue([{ id: "foreign-segment", name: "Other site" }])
    await expect(handleSaveActivities(data, opts)).rejects.toThrow("segment")
    expect(opts.updateSettings).not.toHaveBeenCalled()
  })

  it("propagates failed saves so the form does not reset its dirty state", async () => {
    const opts = options()
    opts.updateSettings.mockRejectedValue(new Error("Save failed"))
    await expect(handleSaveActivities({ activities: normalizeActivitySettings() } as any, opts)).rejects.toThrow("Save failed")
    expect(opts.refreshSites).not.toHaveBeenCalled()
    expect(opts.setIsSaving).toHaveBeenLastCalledWith(false)
  })

  it("preserves parameters through full settings save, not just the activity card", async () => {
    const opts = options()
    const data = adaptSiteToForm({ ...opts.currentSite, settings: { channels, activities: { leads_follow_up: configured } } })
    // This test concerns settings persistence, not the separate copywriting table.
    await handleSave({ ...data, copywriting: undefined } as any, opts)
    expect(opts.updateSettings).toHaveBeenCalledWith("site-a", expect.objectContaining({ activities: expect.objectContaining({ leads_follow_up: configured }) }))
  })

  it.each(["activity", "full"])("preserves all channels through schema, %s save and reload without email/WhatsApp selections", async mode => {
    const opts = options()
    opts.currentSite.settings.channels = { connections: dynamicChannels.map(type => ({ id: `${type}-id`, type, status: "connected", zavu_sender_id: `${type}-sender` })) }
    opts.currentSite.settings.activities = { leads_initial_cold_outreach: multichannel, leads_follow_up: multichannel }
    const adapted = adaptSiteToForm(opts.currentSite)
    // Unconfigured legacy email has an empty address; the schema expects that field omitted.
    const data = siteFormSchema.parse({ ...adapted, channels: { ...adapted.channels, email: {} } })
    if (mode === "activity") await handleSaveActivities(data, opts)
    else await handleSave({ ...data, copywriting: undefined } as unknown as SiteFormValues, opts)
    expect(opts.updateSettings).toHaveBeenCalledTimes(1)
    const saved = opts.updateSettings.mock.calls[0][1]
    const reloaded = adaptSiteToForm({ ...opts.currentSite, settings: { ...opts.currentSite.settings, ...saved } })
    for (const key of ["leads_initial_cold_outreach", "leads_follow_up"] as const) {
      expect(saved.activities[key]).toEqual(multichannel)
      expect(reloaded.activities[key]).toEqual(multichannel)
    }
  })

  it.each(dynamicChannels)("rejects disconnected %s selections even if unsaved form channels appear connected", async type => {
    const opts = options()
    opts.currentSite.settings.channels = { connections: [{ id: `${type}-id`, type, status: "disconnected", zavu_sender_id: "sender" }] }
    const data = { channels: { connections: [{ id: `${type}-id`, type, status: "connected", zavu_sender_id: "sender" }] }, activities: normalizeActivitySettings({ leads_follow_up: { ...configured, channel_accounts: { [type]: [`${type}-id`] } } }) } as SiteFormValues
    await expect(handleSaveActivities(data, opts)).rejects.toThrow("usable channel account")
    expect(opts.updateSettings).not.toHaveBeenCalled()
  })

  it("preserves disabled custom connections through form parsing, Channels save and reload", async () => {
    const opts = options()
    opts.currentSite.settings.channels = { connections: [...channels.connections, { id: "disabled-custom", type: "custom-chat_v2", name: "Disabled", status: "connected", zavu_sender_id: "sender-disabled", enabled: false }] }
    opts.currentSite.settings.activities = { leads_follow_up: configured }
    const adapted = adaptSiteToForm(opts.currentSite)
    const data = siteFormSchema.parse({ ...adapted, channels: { ...adapted.channels, email: {} } })
    await handleSaveChannels(data, opts)
    expect(opts.updateSettings).toHaveBeenCalledTimes(1)
    const saved = opts.updateSettings.mock.calls[0][1]
    expect(saved.channels.connections.find((connection: { id: string }) => connection.id === "disabled-custom").enabled).toBe(false)
    const reloaded = adaptSiteToForm({ ...opts.currentSite, settings: { ...opts.currentSite.settings, ...saved } })
    expect(reloaded.channels.connections?.find(connection => connection.id === "disabled-custom")?.enabled).toBe(false)
  })

  it("hydrates defaults and parameters on site changes without enabling legacy defaults", async () => {
    const setCurrentSite = jest.fn()
    const setSites = jest.fn()
    const site = { id: "site-b", name: "B", logo_url: "logo", description: "B", settings: { activities: { leads_follow_up: configured, leads_initial_cold_outreach: "default" } } } as any
    await applyCurrentSite({ site, currentSite: { id: "site-a" } as any, supabase: {}, setCurrentSite, setSites })
    const hydrated = setCurrentSite.mock.calls[0][0]
    expect(hydrated.settings.activities.leads_follow_up).toEqual(configured)
    expect(hydrated.settings.activities.leads_initial_cold_outreach.status).toBe("inactive")
  })
})