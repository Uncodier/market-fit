import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form"
import { ActivitiesSection } from "@/app/components/settings/ActivitiesSection"
import { normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { useActivityHydration } from "@/app/components/settings/use-activity-hydration"
import { handleSaveActivities } from "@/app/components/settings/save-activities"
import { handleSave } from "@/app/components/settings/save-all-settings"
import { persistSiteSettings } from "@/app/context/site-update-settings"
import type { SiteFormValues } from "@/app/components/settings/form-schema"
import { deferred, listId } from "./icp-mining-list-fixtures"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a", settings: { channels: {} } } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "AI Activities" }) }))
jest.mock("@/app/components/navigation/NavigationLink", () => ({ NavigationLink: ({ children }: any) => <span>{children}</span> }))
jest.mock("@/app/components/settings/outreach-segments", () => ({ fetchOutreachSegments: jest.fn().mockResolvedValue([]) }))
jest.mock("@/app/components/settings/icp-mining-lists", () => ({ fetchIcpMiningLists: jest.fn().mockResolvedValue([]) }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/agents/voice-sync", () => ({ requestVoiceAgentResync: jest.fn() }))
jest.mock("@/app/services/secure-tokens-service", () => ({ secureTokensService: { storeToken: jest.fn() } }))
jest.mock("@/app/context/copywriting-actions", () => ({ copywritingService: { syncCopywritingItems: jest.fn() } }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const siteId = "11111111-1111-4111-8111-111111111111"
const otherSiteId = "22222222-2222-4222-8222-222222222222"
const saved = normalizeActivitySettings({
  icp_lead_generation: { all_lists: false, list_ids: [listId(1)], target_leads: 900, research_enabled: true, extension: { keep: true } },
  email_sync: { status: "default", custom: 42 },
  future_activity: { enabled: true },
})
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
let form: UseFormReturn<SiteFormValues>

function TestForm({ incoming, onSave, id = siteId }: {
  incoming?: unknown; id?: string; onSave: (data: SiteFormValues) => Promise<boolean | void>
}) {
  form = useForm<SiteFormValues>({ defaultValues: { name: "Original", activities: normalizeActivitySettings(incoming) } })
  useActivityHydration(form, incoming, id)
  // Subscribe so both field and global dirtiness are asserted after async transitions.
  const { isDirty, dirtyFields } = form.formState
  return <FormProvider {...form}>
    <input aria-label="Site name" {...form.register("name")} />
    <output data-testid="dirty">{JSON.stringify({ isDirty, dirtyFields })}</output>
    <ActivitiesSection active siteId={id} onSave={onSave} />
  </FormProvider>
}

const card = (key = "icp_lead_generation") => within(document.getElementById(`activity-${key}`)!)
const allLists = () => card().getByRole("checkbox", { name: "All pending lists" })
const target = () => card().getByRole("spinbutton", { name: "Target leads per run" })
const saveButton = () => card().getByRole("button", { name: "Save" })
const editEmail = () => fireEvent.click(card("email_sync").getByRole("radio", { name: /Inactive/ }))

/** Actual writer with a site-filtered in-memory row; no live auth/RLS or network writes. */
function persistenceFixture(activities: unknown = saved, contextLoaded = true) {
  let row: any = { id: "settings-a", site_id: siteId, activities: clone(activities), custom_settings: { keep: true } }
  const writes: any[] = []
  const supabase = { from: jest.fn((table: string) => {
    expect(table).toBe("settings")
    const query: any = {
      select: () => query,
      eq: (column: string, value: string) => { expect([column, value]).toEqual(["site_id", siteId]); return query },
      single: async () => ({ data: clone(row), error: null }),
      upsert: async (value: any) => { row = clone(value); writes.push(row); return { error: null } },
    }
    return query
  }) }
  const currentSite: any = { id: siteId, name: "Site A", url: "https://example.com", settings: contextLoaded ? clone(row) : undefined }
  const deps = { supabase, currentSite, setCurrentSite: jest.fn(), setSites: jest.fn(), loadSites: jest.fn(), setError: jest.fn(), shouldPreventRefresh: () => true, isOnProtectedPage: () => true }
  const updateSettings = jest.fn(async (id: string, settings: any) => persistSiteSettings({ ...deps, siteId: id, settings }))
  const options = { currentSite, updateSettings, updateSite: jest.fn(), refreshSites: jest.fn(), setIsSaving: jest.fn() }
  const onSave = jest.fn((data: SiteFormValues) => handleSaveActivities(data, options))
  return { writes, options, deps, onSave, row: () => row }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, "log").mockImplementation(() => {})
  jest.spyOn(console, "error").mockImplementation(() => {})
  sessionStorage.clear()
})
afterEach(() => jest.restoreAllMocks())

it("hydrates manual-empty defaults, then toggles all mode dirty and persists it", async () => {
  const incoming = normalizeActivitySettings({ icp_lead_generation: { all_lists: false, list_ids: [] } })
  const fixture = persistenceFixture(incoming)
  const view = render(<TestForm onSave={fixture.onSave} />)
  view.rerender(<TestForm onSave={fixture.onSave} incoming={incoming} />)
  expect(allLists()).not.toBeChecked()
  expect(form.formState.defaultValues?.activities?.icp_lead_generation?.all_lists).toBe(false)
  expect(form.formState.isDirty).toBe(false)
  fireEvent.click(allLists())
  expect(saveButton()).toBeEnabled()
  fireEvent.click(saveButton())
  await waitFor(() => expect(fixture.writes).toHaveLength(1))
  expect(fixture.row().activities.icp_lead_generation).toMatchObject({ all_lists: true, list_ids: [] })
  await waitFor(() => expect(saveButton()).toBeDisabled())
})

it("hydrates untouched ICP fields while a neighboring email edit remains dirty, then persists both", async () => {
  const fixture = persistenceFixture()
  const view = render(<TestForm onSave={fixture.onSave} />)
  editEmail()
  view.rerender(<TestForm onSave={fixture.onSave} incoming={saved} />)
  expect(allLists()).not.toBeChecked()
  expect(target()).toHaveValue(900)
  expect(card().getByRole("checkbox", { name: "Additional deep research" })).toBeChecked()
  expect(form.getValues("activities.email_sync.status")).toBe("inactive")
  expect(form.formState.dirtyFields.activities).toEqual({ email_sync: { status: true } })
  fireEvent.click(saveButton())
  await waitFor(() => expect(fixture.writes).toHaveLength(1))
  expect(fixture.row().activities).toEqual({ ...saved, email_sync: { ...saved.email_sync, status: "inactive" } })
  expect(fixture.row().custom_settings).toEqual({ keep: true })
})

it("hydrates siblings of an edited ICP field and rebases its dirty comparison", async () => {
  const fixture = persistenceFixture()
  const view = render(<TestForm onSave={fixture.onSave} />)
  fireEvent.change(target(), { target: { value: "600" } })
  view.rerender(<TestForm onSave={fixture.onSave} incoming={saved} />)
  expect(target()).toHaveValue(600)
  expect(allLists()).not.toBeChecked()
  expect(form.getValues("activities.icp_lead_generation.list_ids")).toEqual([listId(1)])
  expect(form.formState.defaultValues?.activities?.icp_lead_generation?.target_leads).toBe(900)
  fireEvent.change(target(), { target: { value: "900" } })
  expect(form.formState.isDirty).toBe(false)
  fireEvent.change(target(), { target: { value: "600" } })
  fireEvent.click(saveButton())
  await waitFor(() => expect(fixture.writes).toHaveLength(1))
  expect(fixture.row().activities.icp_lead_generation).toEqual({ ...saved.icp_lead_generation, target_leads: 600 })
})

it("saves only dirty activity fields before either form or context hydration, never synthetic defaults", async () => {
  const fixture = persistenceFixture(saved, false)
  const view = render(<TestForm onSave={fixture.onSave} />)
  editEmail()
  fireEvent.click(saveButton())
  await waitFor(() => expect(fixture.writes).toHaveLength(1))
  expect(fixture.row().activities.icp_lead_generation).toEqual(saved.icp_lead_generation)
  expect(fixture.options.updateSettings.mock.calls[0][1].activities).toEqual({ email_sync: { status: "inactive" } })
  await waitFor(() => expect(saveButton()).toBeDisabled())
  view.rerender(<TestForm onSave={fixture.onSave} incoming={fixture.row().activities} />)
  expect(allLists()).not.toBeChecked()
  expect(target()).toHaveValue(900)
  expect(form.formState.isDirty).toBe(false)
})

it("does not reset late hydration, newer edits, or unrelated dirty fields when an activity save completes", async () => {
  const fixture = persistenceFixture(saved, false)
  const pending = deferred<boolean>()
  const onSave = jest.fn(async (data: SiteFormValues) => { await fixture.onSave(data); return pending.promise })
  const view = render(<TestForm onSave={onSave} />)
  editEmail()
  fireEvent.change(screen.getByLabelText("Site name"), { target: { value: "Unsaved name" } })
  fireEvent.click(saveButton())
  await waitFor(() => expect(fixture.writes).toHaveLength(1))
  view.rerender(<TestForm onSave={onSave} incoming={fixture.row().activities} />)
  fireEvent.change(target(), { target: { value: "750" } })
  fireEvent.click(card("email_sync").getByRole("radio", { name: /^Active/ }))
  expect(card("email_sync").getByRole("button", { name: "Save" })).toBeDisabled()
  await act(async () => pending.resolve(true))
  expect(allLists()).not.toBeChecked()
  expect(target()).toHaveValue(750)
  expect(screen.getByLabelText("Site name")).toHaveValue("Unsaved name")
  expect(form.formState.dirtyFields).toMatchObject({ name: true, activities: { email_sync: { status: true }, icp_lead_generation: { target_leads: true } } })
  expect(fixture.row().activities.icp_lead_generation).toEqual(saved.icp_lead_generation)
  fireEvent.click(saveButton())
  await waitFor(() => expect(fixture.writes).toHaveLength(2))
  expect(fixture.row().activities.icp_lead_generation.target_leads).toBe(750)
  expect(form.formState.dirtyFields.name).toBe(true)
})

it("clears activity edits on site changes and ignores completion of the previous site's save", async () => {
  const pending = deferred<boolean>()
  const onSave = jest.fn(() => pending.promise)
  const view = render(<TestForm onSave={onSave} incoming={saved} />)
  fireEvent.change(target(), { target: { value: "750" } })
  fireEvent.click(saveButton())
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  view.rerender(<TestForm id={otherSiteId} onSave={onSave} />)
  expect(target()).toHaveValue(150)
  expect(form.getValues("activities.icp_lead_generation.list_ids")).toEqual([])
  expect(form.formState.isDirty).toBe(false)
  fireEvent.change(target(), { target: { value: "300" } })
  await act(async () => pending.resolve(true))
  expect(target()).toHaveValue(300)
  expect(form.formState.isDirty).toBe(true)
  view.rerender(<TestForm id={otherSiteId} onSave={onSave} incoming={{ icp_lead_generation: { all_lists: false, list_ids: [], target_leads: 450 } }} />)
  expect(target()).toHaveValue(300)
  expect(allLists()).not.toBeChecked()
  expect(form.formState.defaultValues?.activities?.icp_lead_generation?.target_leads).toBe(450)
})

it.each(["active", "inactive", "default"])("persists legacy %s as a status patch without resetting ICP or unknown keys", async status => {
  const fixture = persistenceFixture()
  await fixture.options.updateSettings(siteId, { activities: { icp_lead_generation: status } })
  expect(fixture.row().activities).toEqual(saved)
})

it.each(["activity", "all", "activity without refresh", "all without refresh"])("does not expand a partial %s save into defaults before the latest-row merge", async mode => {
  const fixture = persistenceFixture(saved, false)
  if (mode.includes("without refresh")) sessionStorage.setItem("preventAutoRefresh", "true")
  // updateSite also persists any settings it receives; optimistic refresh avoidance
  // must not send a second default-expanded activity write.
  fixture.options.updateSite.mockImplementation(async site => {
    if (site.settings) await fixture.options.updateSettings(siteId, site.settings)
  })
  const data = { name: "Site A", url: "https://example.com", activities: { email_sync: { status: "inactive" } } } as SiteFormValues
  if (mode.startsWith("activity")) await handleSaveActivities(data, fixture.options)
  else await handleSave(data, fixture.options)
  await waitFor(() => expect(fixture.writes).toHaveLength(mode === "all without refresh" ? 2 : 1))
  expect(fixture.row().activities).toEqual({ ...saved, email_sync: { ...saved.email_sync, status: "inactive" } })
})