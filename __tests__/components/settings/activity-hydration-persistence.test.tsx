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
beforeAll(() => { Element.prototype.scrollIntoView = jest.fn() })

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

describe.each(["daily_resume_and_stand_up", "leads_follow_up"] as const)("%s time controls", key => {
  const input = () => card(key).getByLabelText(key === "leads_follow_up" ? "Follow-up start time" : "Standup start time")

  it("offers three opening/custom selectors, hiding clocks until custom is chosen", async () => {
    render(<TestForm onSave={jest.fn()} />)
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(0)
    for (const timed of ["daily_resume_and_stand_up", "leads_follow_up", "leads_initial_cold_outreach"]) {
      expect(card(timed).getByRole("combobox", { name: /execution time/ })).toHaveTextContent("Business opening time")
    }
    expect(card(key).getByText(/Schedule timezone: America\/Mexico_City/)).toBeInTheDocument()
    expect(card("icp_lead_generation").getByText(/Daily runs are distributed by site over 24 hours, independent of business hours/)).toBeInTheDocument()
    expect(card("icp_lead_generation").queryByLabelText(/start time/i)).not.toBeInTheDocument()
    expect(card("leads_initial_cold_outreach").queryByLabelText(/start time/i)).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
  })

  it("hydrates late time without discarding weekday edits and preserves local time edits on refresh", async () => {
    const view = render(<TestForm onSave={jest.fn()} />)
    fireEvent.click(card(key).getByRole("checkbox", { name: "Sunday" }))
    view.rerender(<TestForm onSave={jest.fn()} incoming={{ [key]: { start_time: "07:45", weekdays: [6] } }} />)
    expect(input()).toHaveValue("07:45")
    expect(card(key).getByRole("checkbox", { name: "Sunday" })).toBeChecked()
    fireEvent.change(input(), { target: { value: "18:30" } })
    view.rerender(<TestForm onSave={jest.fn()} incoming={{ [key]: { start_time: "10:15", weekdays: [6] } }} />)
    expect(input()).toHaveValue("18:30")
    expect(form.formState.defaultValues?.activities?.[key]?.start_time).toBe("10:15")
    await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
  })

  it("clears a hydrated time when switching to a legacy missing-time site", async () => {
    const onSave = jest.fn()
    const view = render(<TestForm onSave={onSave} incoming={{ [key]: { start_time: "12:30" } }} />)
    expect(input()).toHaveValue("12:30")
    view.rerender(<TestForm onSave={onSave} incoming={{}} id={otherSiteId} />)
    expect(card(key).queryByLabelText(/start time/)).not.toBeInTheDocument()
    expect(card(key).getByRole("combobox", { name: /execution time/ })).toHaveTextContent("Business opening time")
    expect(form.getValues(`activities.${key}.start_time`)).toBeUndefined()
    expect(form.formState.isDirty).toBe(false)
    await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
  })

  it("blocks clearing a custom time, then persists opening mode across reload", async () => {
    const initial = normalizeActivitySettings({ [key]: { start_time: "16:45", weekdays: [0, 6], extension: true } })
    const fixture = persistenceFixture(initial)
    const view = render(<TestForm onSave={fixture.onSave} incoming={initial} />)
    fireEvent.change(input(), { target: { value: "" } })
    expect(input()).toHaveAttribute("aria-invalid", "true")
    fireEvent.click(card(key).getByRole("button", { name: "Save" }))
    expect(fixture.onSave).not.toHaveBeenCalled()
    expect(fixture.writes).toEqual([])
    fireEvent.keyDown(card(key).getByRole("combobox", { name: /execution time/ }), { key: "Enter" })
    fireEvent.click(await screen.findByRole("option", { name: "Business opening time" }))
    expect(card(key).queryByLabelText(/start time/)).not.toBeInTheDocument()
    fireEvent.click(card(key).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(fixture.writes).toHaveLength(1))
    expect(fixture.options.updateSettings.mock.calls[0][1].activities).toEqual({ [key]: { start_time_mode: "business_opening", start_time: "" } })
    expect(fixture.row().activities[key]).toEqual({ ...initial[key], start_time_mode: "business_opening", start_time: "" })
    await waitFor(() => expect(form.formState.isDirty).toBe(false))
    view.unmount()
    render(<TestForm onSave={fixture.onSave} incoming={fixture.row().activities} />)
    expect(card(key).queryByLabelText(/start time/)).not.toBeInTheDocument()
    expect(card(key).getByRole("combobox", { name: /execution time/ })).toHaveTextContent("Business opening time")
    expect(form.formState.isDirty).toBe(false)
    await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
  })

  it("preserves a newer time edit when a previous save completes", async () => {
    const initial = normalizeActivitySettings({ [key]: { start_time: "16:45" } })
    const fixture = persistenceFixture(initial)
    const pending = deferred<boolean>()
    const onSave = jest.fn(async (data: SiteFormValues) => { await fixture.onSave(data); return pending.promise })
    render(<TestForm onSave={onSave} incoming={initial} />)
    fireEvent.change(input(), { target: { value: "07:15" } })
    fireEvent.click(card(key).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(fixture.writes).toHaveLength(1))
    fireEvent.change(input(), { target: { value: "08:45" } })
    await act(async () => pending.resolve(true))
    expect(input()).toHaveValue("08:45")
    expect(form.formState.isDirty).toBe(true)
    expect(form.formState.defaultValues?.activities?.[key]?.start_time).toBe("07:15")
    expect(fixture.row().activities[key].start_time).toBe("07:15")
  })

  it.each([null, "25:00"])("does not hide malformed persisted time %p behind an empty legacy default", async start_time => {
    const onSave = jest.fn()
    render(<TestForm onSave={onSave} incoming={{ [key]: { start_time } }} />)
    expect(form.getValues(`activities.${key}.start_time`)).toEqual(start_time)
    expect(input()).toHaveAttribute("aria-invalid", "true")
    expect(card(key).getByRole("alert")).toHaveTextContent("HH:mm")
    editEmail()
    fireEvent.click(saveButton())
    expect(onSave).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
  })
})

it("asks for a cold-outreach custom time and saves/reloads it without modifying other activities", async () => {
  const key = "leads_initial_cold_outreach"
  const fixture = persistenceFixture()
  const view = render(<TestForm onSave={fixture.onSave} incoming={saved} />)
  fireEvent.keyDown(card(key).getByRole("combobox", { name: /execution time/ }), { key: "Enter" })
  fireEvent.click(await screen.findByRole("option", { name: "Custom time" }))
  const input = card(key).getByLabelText("Cold outreach start time")
  expect(input).toHaveValue("")
  fireEvent.click(card(key).getByRole("button", { name: "Save" }))
  expect(fixture.onSave).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: "14:35" } })
  fireEvent.click(card(key).getByRole("button", { name: "Save" }))
  await waitFor(() => expect(fixture.writes).toHaveLength(1))
  expect(fixture.options.updateSettings.mock.calls[0][1].activities).toEqual({ [key]: { start_time_mode: "custom", start_time: "14:35" } })
  expect(fixture.row().activities[key]).toMatchObject({ start_time_mode: "custom", start_time: "14:35", status: "inactive" })
  expect(fixture.row().activities.icp_lead_generation).toEqual(saved.icp_lead_generation)
  view.unmount()
  render(<TestForm onSave={fixture.onSave} incoming={fixture.row().activities} />)
  expect(card(key).getByRole("combobox", { name: /execution time/ })).toHaveTextContent("Custom time")
  expect(card(key).getByLabelText("Cold outreach start time")).toHaveValue("14:35")
  await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
})

it("saving an untouched timed card persists opening mode only for that card", async () => {
  const fixture = persistenceFixture()
  render(<TestForm onSave={fixture.onSave} incoming={saved} />)
  fireEvent.click(card("leads_initial_cold_outreach").getByRole("button", { name: "Save" }))
  await waitFor(() => expect(fixture.writes).toHaveLength(1))
  expect(fixture.options.updateSettings.mock.calls[0][1].activities).toEqual({ leads_initial_cold_outreach: { start_time_mode: "business_opening" } })
  expect(fixture.row().activities.leads_follow_up.start_time_mode).toBeUndefined()
  expect(fixture.row().activities.daily_resume_and_stand_up.start_time_mode).toBeUndefined()
})

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