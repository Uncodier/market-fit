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
const configured = { status: "active", weekdays: [0, 6], report_sections: ["social", "records", "orders", "reservations", "inventory"], extension: { keep: true } }
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

/** Local client double only; this suite does not contact Supabase or verify live RLS. */
function fixture(standup: unknown = configured) {
  let row: any = {
    id: "settings-a", site_id: siteId, channels: { connections: [] }, custom_settings: { untouched: true },
    activities: normalizeActivitySettings({
      [key]: standup,
      icp_lead_generation: { target_leads: 300, research_enabled: true, extension: { retained: true } },
      leads_follow_up: { status: "inactive", policy: { untouched: true } },
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
})