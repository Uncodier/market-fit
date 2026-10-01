import { handleSaveActivities } from "@/app/components/settings/save-activities"
import { handleSave } from "@/app/components/settings/save-all-settings"
import { adaptSiteToForm } from "@/app/components/settings/data-adapter"
import { siteFormSchema, type SiteFormValues } from "@/app/components/settings/form-schema"
import { normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { persistSiteSettings } from "@/app/context/site-update-settings"
import { applyCurrentSite, fetchSiteSettings } from "@/app/context/site-set-current"
import { toast } from "sonner"

jest.mock("@/app/components/settings/outreach-segments", () => ({ fetchOutreachSegments: jest.fn().mockResolvedValue([]) }))
jest.mock("@/app/services/secure-tokens-service", () => ({ secureTokensService: { storeToken: jest.fn() } }))
jest.mock("@/app/context/copywriting-actions", () => ({ copywritingService: { syncCopywritingItems: jest.fn() } }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/agents/voice-sync", () => ({ requestVoiceAgentResync: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const siteId = "11111111-1111-4111-8111-111111111111"
const key = "daily_resume_and_stand_up"
const configured = { status: "active", weekdays: [0, 6], start_time: "08:15", report_sections: ["social", "records", "orders", "reservations", "inventory"], extension: { keep: true } }
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

/** Local client double only; this suite does not contact Supabase or verify live RLS. */
function fixture(standup: unknown = configured) {
  let row: any = {
    id: "settings-a", site_id: siteId, channels: { connections: [] }, custom_settings: { untouched: true },
    activities: normalizeActivitySettings({
      [key]: standup,
      icp_lead_generation: { target_leads: 300, research_enabled: true, extension: { retained: true } },
      leads_follow_up: { status: "inactive", start_time: "17:45", policy: { untouched: true } },
      local_lead_generation: { status: "inactive", radius: 10 }, future_activity: { payload: [1, 2] },
    }),
  }
  const writes: any[] = []
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn((column, id) => { expect(column).toBe("site_id"); expect(id).toBe(siteId); return query }),
    single: jest.fn(async () => ({ data: clone(row), error: null })),
    upsert: jest.fn(async value => { row = clone(value); writes.push(row); return { error: null } }),
  }
  const supabase = { from: jest.fn((table: string) => { expect(table).toBe("settings"); return query }) }
  const currentSite: any = { id: siteId, name: "Site A", url: "https://example.com", settings: clone(row) }
  const deps = {
    supabase, currentSite, setCurrentSite: jest.fn(), setSites: jest.fn(), loadSites: jest.fn(), setError: jest.fn(),
    shouldPreventRefresh: () => true, isOnProtectedPage: () => false,
  }
  const updateSettings = jest.fn(async (id: string, settings: any) => persistSiteSettings({ ...deps, siteId: id, settings }))
  const options = { currentSite, updateSettings, updateSite: jest.fn(), refreshSites: jest.fn(), setIsSaving: jest.fn() }
  return { deps, options, writes, row: () => row }
}

async function save(mode: string, data: SiteFormValues, state: ReturnType<typeof fixture>) {
  if (mode === "activity") return handleSaveActivities(data, state.options)
  if (mode === "all") return handleSave({ ...data, copywriting: undefined } as unknown as SiteFormValues, state.options)
  return state.options.updateSettings(siteId, { activities: data.activities })
}

describe("Daily Standup persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "log").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    sessionStorage.clear()
  })
  afterEach(() => jest.restoreAllMocks())

  it.each(["activity", "all"])("roundtrips selections through schema, %s save, reload and site context with unknown settings intact", async mode => {
    const state = fixture()
    const expected = clone(state.row().activities)
    const adapted = adaptSiteToForm(state.options.currentSite)
    const data = siteFormSchema.parse({ ...adapted, channels: { ...adapted.channels, email: {} } })
    await save(mode, data, state)
    expect(state.writes).toHaveLength(1)
    expect(state.row().activities).toEqual(expected)
    expect(state.row().custom_settings).toEqual({ untouched: true })
    // Save All also persists channel form defaults; existing connection selections remain intact.
    expect(state.row().channels).toMatchObject({ connections: [] })
    const loaded = await fetchSiteSettings(state.deps.supabase, siteId)
    expect(adaptSiteToForm({ ...state.options.currentSite, settings: loaded }).activities).toEqual(expected)
    const selected = jest.fn()
    await applyCurrentSite({ site: { ...state.options.currentSite, settings: loaded }, currentSite: null, supabase: null, setCurrentSite: selected, setSites: jest.fn() })
    expect(selected.mock.calls[0][0].settings.activities).toEqual(expected)
    expect(state.deps.setCurrentSite.mock.calls[0][0].settings.activities).toEqual(expected)
  })

  it.each(["activity", "all", "direct"])("preserves status-only legacy defaults and explicitly empty inactive selections through %s save", async mode => {
    for (const value of ["active", { status: "inactive" }, { status: "inactive", weekdays: [], report_sections: [] }]) {
      const state = fixture(value)
      const expected = clone(state.row().activities)
      const data = { name: "Site A", url: "https://example.com", activities: { [key]: value } } as unknown as SiteFormValues
      await save(mode, data, state)
      expect(state.writes).toHaveLength(1)
      expect(state.row().activities).toEqual(expected)
    }
  })

  it.each(["activity", "all", "direct"])("preserves saved selections and latest extensions for object/string status-only %s updates", async mode => {
    for (const update of ["inactive", { status: "inactive" }]) {
      const state = fixture()
      state.row().activities[key].server_extension = { revision: 2 }
      const expected = { ...clone(state.row().activities), [key]: { ...configured, status: "inactive", server_extension: { revision: 2 } } }
      await save(mode, { name: "Site A", url: "https://example.com", activities: { [key]: update } } as unknown as SiteFormValues, state)
      expect(state.writes).toHaveLength(1)
      expect(state.row().activities).toEqual(expected)
      expect(state.row().custom_settings).toEqual({ untouched: true })
    }
  })

  it.each(["activity", "all", "direct"])("rejects invalid/empty active selections before %s writes or local state updates", async mode => {
    for (const invalid of [
      { weekdays: [] }, { report_sections: [] }, { weekdays: [7] }, { weekdays: [-1] }, { weekdays: [1.5] },
      { weekdays: ["1"] }, { report_sections: ["social_media"] }, { weekdays: null }, { report_sections: null },
    ]) {
      const state = fixture()
      const data = { name: "Site A", url: "https://example.com", activities: { [key]: { status: "active", ...invalid } } } as unknown as SiteFormValues
      if (mode === "all") await save(mode, data, state)
      else await expect(save(mode, data, state)).rejects.toThrow()
      expect(state.writes).toEqual([])
      expect(state.options.updateSite).not.toHaveBeenCalled()
      expect(state.deps.setCurrentSite).not.toHaveBeenCalled()
    }
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each(["activity", "all", "direct"])("does not replace explicit empty selections with defaults on a status-only activation via %s", async mode => {
    for (const update of ["active", { status: "active" }]) {
      const state = fixture({ status: "inactive", weekdays: [], report_sections: [] })
      const data = { name: "Site A", url: "https://example.com", activities: { [key]: update } } as unknown as SiteFormValues
      if (mode === "all") await save(mode, data, state)
      else await expect(save(mode, data, state)).rejects.toThrow("Select at least one")
      expect(state.writes).toEqual([])
      expect(state.row().activities[key]).toEqual({ status: "inactive", weekdays: [], report_sections: [] })
    }
  })

  it("merges partial selections without resetting the other selection, status or extensions", async () => {
    const state = fixture()
    await state.options.updateSettings(siteId, { activities: { [key]: { weekdays: [2, 4] } } })
    expect(state.row().activities[key]).toEqual({ ...configured, weekdays: [2, 4] })
    await state.options.updateSettings(siteId, { activities: { [key]: { report_sections: ["sales", "tasks"] } } })
    expect(state.row().activities[key]).toEqual({ ...configured, weekdays: [2, 4], report_sections: ["sales", "tasks"] })
  })

  describe.each(["daily_resume_and_stand_up", "leads_follow_up"] as const)("%s start time persistence", activityKey => {
    it.each(["activity", "all", "direct"])("saves a custom time then explicit fixed reset through %s and reloads it", async mode => {
      const state = fixture()
      state.row().activities[activityKey].server_extension = { latest: true }
      const before = clone(state.row().activities)
      for (const start_time of ["00:00", "23:59", "09:00"]) {
        const data = { name: "Site A", url: "https://example.com", activities: { [activityKey]: { start_time } } } as unknown as SiteFormValues
        await save(mode, data, state)
        expect(state.row().activities).toEqual({ ...before, [activityKey]: { ...before[activityKey], start_time } })
        const loaded = await fetchSiteSettings(state.deps.supabase, siteId)
        expect(adaptSiteToForm({ ...state.options.currentSite, settings: loaded }).activities[activityKey].start_time).toBe(start_time)
        expect(state.deps.setCurrentSite.mock.lastCall?.[0].settings.activities[activityKey].start_time).toBe(start_time)
      }
      expect(state.writes).toHaveLength(3)
      expect(state.row().custom_settings).toEqual({ untouched: true })
    })

    it.each(["activity", "all", "direct"])("does not invent a fixed time when saving legacy missing settings via %s", async mode => {
      const state = fixture({ status: "inactive" })
      delete state.row().activities[activityKey].start_time
      delete state.options.currentSite.settings.activities[activityKey].start_time
      const data = { name: "Site A", url: "https://example.com", activities: { [activityKey]: { weekdays: [1, 5] } } } as unknown as SiteFormValues
      await save(mode, data, state)
      expect(state.writes).toHaveLength(1)
      expect(state.row().activities[activityKey]).not.toHaveProperty("start_time")
    })

    it.each(["activity", "all", "direct"])("rejects nonmissing invalid times before %s writes", async mode => {
      for (const start_time of ["", null, "9:00", "24:00", "10:60", "09:00:00", "09:00\n", 900]) {
        const state = fixture()
        const data = { name: "Site A", url: "https://example.com", activities: { [activityKey]: { status: "inactive", start_time } } } as unknown as SiteFormValues
        if (mode === "all") await save(mode, data, state)
        else await expect(save(mode, data, state)).rejects.toThrow()
        expect(state.writes).toEqual([])
        expect(state.options.updateSite).not.toHaveBeenCalled()
        expect(state.deps.setCurrentSite).not.toHaveBeenCalled()
      }
    })

    it.each(["activity", "all", "direct"])("keeps the latest time when a pre-hydration form sends undefined via %s", async mode => {
      const state = fixture()
      const expected = state.row().activities[activityKey].start_time
      delete state.options.currentSite.settings.activities[activityKey].start_time
      const data = { name: "Site A", url: "https://example.com", activities: { [activityKey]: { start_time: undefined, weekdays: [1, 5] } } } as unknown as SiteFormValues
      await save(mode, data, state)
      expect(state.writes).toHaveLength(1)
      expect(state.row().activities[activityKey].start_time).toBe(expected)
    })

    it("rejects a malformed latest-row time during an unrelated partial activity write", async () => {
      const state = fixture()
      state.row().activities[activityKey].start_time = null
      await expect(state.options.updateSettings(siteId, { activities: { email_sync: { status: "inactive" } } })).rejects.toThrow()
      expect(state.writes).toEqual([])
    })
  })

  it("does not introduce validation of unrelated inactive outreach caps during direct settings writes", async () => {
    const state = fixture()
    state.row().activities.leads_follow_up.daily_message_limit = -1
    state.row().activities.leads_follow_up.max_unanswered_messages = null
    await state.options.updateSettings(siteId, { activities: { email_sync: { status: "inactive" } } })
    expect(state.writes).toHaveLength(1)
    expect(state.row().activities.leads_follow_up).toMatchObject({ daily_message_limit: -1, max_unanswered_messages: null, start_time: "17:45" })
  })
})