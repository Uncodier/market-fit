import { handleSaveActivities } from "@/app/components/settings/save-activities"
import { handleSave } from "@/app/components/settings/save-all-settings"
import { adaptSiteToForm } from "@/app/components/settings/data-adapter"
import { siteFormSchema, type SiteFormValues } from "@/app/components/settings/form-schema"
import { normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { persistSiteSettings } from "@/app/context/site-update-settings"
import { applyCurrentSite, fetchSiteSettings } from "@/app/context/site-set-current"
import { toast } from "sonner"
import { listId } from "./icp-mining-list-fixtures"

jest.mock("@/app/components/settings/outreach-segments", () => ({ fetchOutreachSegments: jest.fn().mockResolvedValue([]) }))
jest.mock("@/app/services/secure-tokens-service", () => ({ secureTokensService: { storeToken: jest.fn() } }))
jest.mock("@/app/context/copywriting-actions", () => ({ copywritingService: { syncCopywritingItems: jest.fn() } }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/agents/voice-sync", () => ({ requestVoiceAgentResync: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const siteId = "11111111-1111-4111-8111-111111111111"
const foreignSiteId = "22222222-2222-4222-8222-222222222222"
const initialActivities = normalizeActivitySettings({
  icp_lead_generation: { status: "inactive", target_leads: 150, research_enabled: false, provider_options: { retained: true } },
  local_lead_generation: { status: "inactive", radius: 10 },
  leads_follow_up: { status: "inactive", segment_ids: ["saved-segment"], policy: { retained: true } },
  future_activity: { payload: [1, 2] },
})
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

/** In-memory user-scoped client double, not a live auth/RLS integration test. */
function persistenceFixture() {
  let row: any = { id: "settings-a", site_id: siteId, activities: clone(initialActivities), channels: { connections: [] }, custom_settings: { untouched: true } }
  let authenticated = true
  let readFailure: Error | null = null
  const writes: any[] = []
  const filters: string[] = []
  const supabase = {
    from: jest.fn((table: string) => {
      expect(table).toBe("settings")
      let requestedSite: string
      const query: any = {
        select: jest.fn(() => query),
        eq: jest.fn((column: string, value: string) => { expect(column).toBe("site_id"); requestedSite = value; filters.push(value); return query }),
        single: jest.fn(async () => ({
          data: authenticated && requestedSite === siteId && !readFailure ? clone(row) : null,
          error: readFailure || (authenticated && requestedSite === siteId ? null : { code: "PGRST116" }),
        })),
        upsert: jest.fn(async (value: any, options: any) => {
          expect(options).toEqual({ onConflict: "site_id", ignoreDuplicates: false })
          if (!authenticated || value.site_id !== siteId) return { error: new Error("RLS denied settings write") }
          row = clone(value)
          writes.push(row)
          return { error: null }
        }),
      }
      return query
    }),
  }
  const currentSite: any = { id: siteId, name: "Site A", url: "https://example.com", logo_url: "logo", description: "Example", settings: clone(row) }
  const deps = {
    supabase, currentSite, setCurrentSite: jest.fn(), setSites: jest.fn(), loadSites: jest.fn(), setError: jest.fn(),
    shouldPreventRefresh: () => true, isOnProtectedPage: () => false,
  }
  const updateSettings = jest.fn(async (id: string, settings: any) => persistSiteSettings({ ...deps, siteId: id, settings }))
  const options = { currentSite, updateSettings, updateSite: jest.fn(), refreshSites: jest.fn(), setIsSaving: jest.fn() }
  return { deps, options, writes, filters, row: () => row, signOut: () => { authenticated = false }, failRead: () => { readFailure = new Error("Settings unavailable") } }
}

describe("ICP settings persistence roundtrip", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "log").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    sessionStorage.clear()
  })
  afterEach(() => jest.restoreAllMocks())

  it.each(["activity", "all", "direct"].flatMap(mode => [
    { mode, selection: { all_lists: true, list_ids: [] } },
    { mode, selection: { all_lists: false, list_ids: [listId(1).toUpperCase(), listId(2), listId(1)] } },
    { mode, selection: { all_lists: false, list_ids: [] } },
    { mode, selection: { all_lists: true, list_ids: [listId(3)] } },
  ]))("roundtrips $mode save with $selection through the session-scoped client, form schema and reload", async ({ mode, selection }) => {
    const fixture = persistenceFixture()
    const adapted = adaptSiteToForm(fixture.options.currentSite)
    const data = siteFormSchema.parse({ ...adapted, channels: { ...adapted.channels, email: {} } })
    data.activities.icp_lead_generation = { ...data.activities.icp_lead_generation, target_leads: 3000, research_enabled: true, ...selection }
    if (mode === "activity") await expect(handleSaveActivities(data, fixture.options)).resolves.toBe(true)
    else if (mode === "direct") await fixture.options.updateSettings(siteId, { activities: data.activities })
    else await handleSave({ ...data, copywriting: undefined } as unknown as SiteFormValues, fixture.options)
    expect(fixture.writes).toHaveLength(1)
    const expected = { ...initialActivities, icp_lead_generation: {
      ...initialActivities.icp_lead_generation, target_leads: 3000, research_enabled: true,
      ...selection, list_ids: [...new Set(selection.list_ids.map(id => id.toLowerCase()))],
    } }
    expect(fixture.row().activities).toEqual(expected)
    expect(fixture.row().custom_settings).toEqual({ untouched: true })
    const loaded = await fetchSiteSettings(fixture.deps.supabase, siteId)
    expect(adaptSiteToForm({ ...fixture.options.currentSite, settings: loaded }).activities).toEqual(expected)
    const selected = jest.fn()
    await applyCurrentSite({ site: { ...fixture.options.currentSite, settings: loaded }, currentSite: null, supabase: null, setCurrentSite: selected, setSites: jest.fn() })
    expect(selected.mock.calls[0][0].settings.activities).toEqual(expected)
    expect(fixture.deps.setCurrentSite.mock.calls[0][0](fixture.options.currentSite).settings.activities).toEqual(expected)
    expect(fixture.filters.every(id => id === siteId)).toBe(true)
  })

  it("merges a partial ICP update with the latest database neighbors, not stale context", async () => {
    const fixture = persistenceFixture()
    fixture.row().activities.icp_lead_generation.server_extension = { cursor_version: 2 }
    fixture.row().activities.icp_lead_generation.all_lists = false
    fixture.row().activities.icp_lead_generation.list_ids = [listId(9)]
    fixture.row().activities.future_activity = { changedOnServer: true }
    await fixture.options.updateSettings(siteId, { site_id: foreignSiteId, activities: { icp_lead_generation: { status: "inactive", target_leads: 25 } } })
    expect(fixture.row().site_id).toBe(siteId)
    expect(fixture.row().activities).toEqual({
      ...initialActivities,
      future_activity: { changedOnServer: true },
      icp_lead_generation: { ...initialActivities.icp_lead_generation, status: "active", target_leads: 25, all_lists: false, list_ids: [listId(9)], server_extension: { cursor_version: 2 } },
    })
    expect(fixture.row().channels).toEqual({ connections: [] })
  })

  it.each(["activity", "all", "direct"])("blocks malformed ICP parameters before any %s write", async mode => {
    for (const invalid of [
      { target_leads: 0 }, { target_leads: 3001 }, { target_leads: 1.5 }, { target_leads: NaN }, { research_enabled: "false" },
      { all_lists: "false" }, { all_lists: null }, { list_ids: "invalid" }, { list_ids: null }, { list_ids: ["invalid"] },
      { list_ids: Array.from({ length: 1001 }, (_, index) => listId(index)) },
    ]) {
      const fixture = persistenceFixture()
      const data = { name: "Site A", url: "https://example.com", activities: { icp_lead_generation: invalid } } as unknown as SiteFormValues
      if (mode === "activity") await expect(handleSaveActivities(data, fixture.options)).rejects.toThrow()
      else if (mode === "all") await handleSave(data, fixture.options)
      else await expect(fixture.options.updateSettings(siteId, { activities: data.activities })).rejects.toThrow()
      expect(fixture.writes).toEqual([])
      expect(fixture.options.updateSite).not.toHaveBeenCalled()
      expect(fixture.deps.setCurrentSite).not.toHaveBeenCalled()
    }
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each(["signed-out", "foreign-site"])("propagates %s RLS denial without reporting success or updating local state", async denied => {
    const fixture = persistenceFixture()
    if (denied === "signed-out") fixture.signOut()
    else fixture.options.currentSite.id = foreignSiteId
    await expect(handleSaveActivities({ activities: initialActivities } as SiteFormValues, fixture.options)).rejects.toThrow("RLS denied")
    expect(fixture.writes).toEqual([])
    expect(fixture.deps.setCurrentSite).not.toHaveBeenCalled()
    expect(fixture.options.refreshSites).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(fixture.options.setIsSaving).toHaveBeenLastCalledWith(false)
  })

  it("does not overwrite settings after a failed preservation read", async () => {
    const fixture = persistenceFixture()
    fixture.failRead()
    await expect(fixture.options.updateSettings(siteId, { activities: initialActivities })).rejects.toThrow("Settings unavailable")
    expect(fixture.writes).toEqual([])
    expect(fixture.deps.setCurrentSite).not.toHaveBeenCalled()
  })
})