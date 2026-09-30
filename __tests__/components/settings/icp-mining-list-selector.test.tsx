import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { ActivitiesSection } from "@/app/components/settings/ActivitiesSection"
import { mergeActivitySettings, normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { useActivityHydration } from "@/app/components/settings/use-activity-hydration"
import { fetchIcpMiningLists, type IcpMiningList } from "@/app/components/settings/icp-mining-lists"
import type { SiteFormValues } from "@/app/components/settings/form-schema"
import { deferred, listId, miningList } from "./icp-mining-list-fixtures"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "context-site", settings: { channels: {} } } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "AI Activities" }) }))
jest.mock("@/app/components/navigation/NavigationLink", () => ({ NavigationLink: ({ children }: any) => <span>{children}</span> }))
jest.mock("@/app/components/settings/outreach-segments", () => ({ fetchOutreachSegments: jest.fn().mockResolvedValue([]) }))
jest.mock("@/app/components/settings/icp-mining-lists", () => ({
  ...jest.requireActual("@/app/components/settings/icp-mining-lists"), fetchIcpMiningLists: jest.fn(),
}))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

function TestForm({ initial, onSave = jest.fn(), siteId }: { initial?: unknown; onSave?: jest.Mock; siteId?: string }) {
  const form = useForm<SiteFormValues>({ defaultValues: { activities: normalizeActivitySettings(initial) } })
  useActivityHydration(form, initial, siteId)
  return <FormProvider {...form}><ActivitiesSection active siteId={siteId} onSave={onSave} /></FormProvider>
}

const card = () => within(document.getElementById("activity-icp_lead_generation")!)
const checkbox = (name: string) => card().getByRole("checkbox", { name })
const save = () => fireEvent.click(card().getByRole("button", { name: "Save" }))

describe("ICP pending mining list selector", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(fetchIcpMiningLists).mockResolvedValue([miningList(1), miningList(2, { status: "running" })])
  })

  it("defaults to dynamic all, includes future lists, displays progress and running resume without storing a snapshot", async () => {
    const onSave = jest.fn().mockResolvedValue(true)
    render(<TestForm onSave={onSave} />)
    await card().findByRole("checkbox", { name: "Mining list 1" })
    expect(fetchIcpMiningLists).toHaveBeenCalledWith("context-site", expect.any(AbortSignal))
    expect(checkbox("All pending lists")).toBeChecked()
    expect(checkbox("Mining list 1")).toBeChecked()
    expect(checkbox("Mining list 1")).toBeDisabled()
    expect(card().getByText(/including future lists/)).toBeInTheDocument()
    expect(card().getByText(/Running — resumable/)).toHaveTextContent("25 / 100 targets processed · 25%")
    expect(card().getByRole("progressbar", { name: "Mining list 2 progress" })).toHaveAttribute("aria-valuenow", "25")
    jest.mocked(fetchIcpMiningLists).mockResolvedValue([miningList(3)])
    fireEvent.click(card().getByRole("button", { name: "Refresh lists" }))
    await card().findByRole("checkbox", { name: "Mining list 3" })
    fireEvent.change(card().getByRole("spinbutton"), { target: { value: "200" } })
    save()
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].activities).toEqual({ icp_lead_generation: { target_leads: 200 } })
    expect(mergeActivitySettings(undefined, onSave.mock.calls[0][0].activities).icp_lead_generation).toMatchObject({ all_lists: true, list_ids: [] })
  })

  it("selects a subset, preserves it across all-mode toggles, saves and reloads, then explicitly empties it", async () => {
    const onSave = jest.fn().mockResolvedValue(true)
    const initial = { icp_lead_generation: { extension: { keep: true } }, future_activity: { keep: true } }
    const view = render(<TestForm onSave={onSave} initial={initial} siteId="site-a" />)
    await card().findByRole("checkbox", { name: "Mining list 1" })
    expect(fetchIcpMiningLists).toHaveBeenCalledWith("site-a", expect.any(AbortSignal))
    fireEvent.click(checkbox("All pending lists"))
    expect(card().getByText(/No lists selected — no mining work/)).toBeInTheDocument()
    fireEvent.click(checkbox("Mining list 2"))
    fireEvent.click(checkbox("All pending lists"))
    fireEvent.click(checkbox("All pending lists"))
    expect(checkbox("Mining list 1")).not.toBeChecked()
    expect(checkbox("Mining list 2")).toBeChecked()
    save()
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const saved = mergeActivitySettings(initial, onSave.mock.calls[0][0].activities)
    expect(saved).toMatchObject({ ...initial, icp_lead_generation: { ...initial.icp_lead_generation, all_lists: false, list_ids: [listId(2)] } })
    await waitFor(() => expect(card().getByRole("button", { name: "Save" })).toBeDisabled())
    view.unmount()
    render(<TestForm onSave={onSave} initial={saved} siteId="site-a" />)
    await card().findByRole("checkbox", { name: "Mining list 2" })
    expect(checkbox("Mining list 2")).toBeChecked()
    fireEvent.click(checkbox("Mining list 2"))
    save()
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1][0].activities).toEqual({ icp_lead_generation: { list_ids: [] } })
    expect(mergeActivitySettings(saved, onSave.mock.calls[1][0].activities).icp_lead_generation).toMatchObject({ all_lists: false, list_ids: [] })
    expect(card().getByText(/No lists selected — no mining work/)).toBeInTheDocument()
  })

  it("keeps completed/deleted selections removable and savable without widening to another available list", async () => {
    const onSave = jest.fn().mockResolvedValue(true)
    render(<TestForm onSave={onSave} initial={{ icp_lead_generation: { all_lists: false, list_ids: [listId(2)] } }} />)
    await card().findByRole("checkbox", { name: "Mining list 2" })
    jest.mocked(fetchIcpMiningLists).mockResolvedValue([miningList(1)])
    fireEvent.click(card().getByRole("button", { name: "Refresh lists" }))
    await card().findByText(/Unavailable list/)
    expect(card().getByText(/completed, deleted, or no longer available/)).toBeInTheDocument()
    expect(card().getByText(/None of the selected lists are currently available/)).toBeInTheDocument()
    expect(checkbox("Mining list 1")).not.toBeChecked()
    fireEvent.change(card().getByRole("spinbutton"), { target: { value: "151" } })
    save()
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].activities).toEqual({ icp_lead_generation: { target_leads: 151 } })
    expect(mergeActivitySettings({ icp_lead_generation: { all_lists: false, list_ids: [listId(2)] } }, onSave.mock.calls[0][0].activities).icp_lead_generation).toMatchObject({ all_lists: false, list_ids: [listId(2)] })
    fireEvent.click(card().getByRole("button", { name: `Remove list ${listId(2)}` }))
    expect(card().getByText(/No lists selected — no mining work/)).toBeInTheDocument()
    expect(checkbox("All pending lists")).not.toBeChecked()
  })

  it("shows loading/error/retry without claiming saved IDs are completed, allows saves and removal, then shows empty", async () => {
    const load = deferred<IcpMiningList[]>()
    jest.mocked(fetchIcpMiningLists).mockReturnValueOnce(load.promise)
    const onSave = jest.fn().mockResolvedValue(true)
    render(<TestForm onSave={onSave} initial={{ icp_lead_generation: { all_lists: false, list_ids: [listId(9)] } }} />)
    expect(card().getByText("Loading pending mining lists...")).toBeInTheDocument()
    expect(card().getByText(/availability not verified/)).toBeInTheDocument()
    await act(async () => load.reject(new Error("private details")))
    expect(card().getByRole("alert")).toHaveTextContent("Unable to load")
    expect(card().queryByText(/Unavailable list/)).not.toBeInTheDocument()
    expect(card().queryByText(/private details/)).not.toBeInTheDocument()
    fireEvent.change(card().getByRole("spinbutton"), { target: { value: "200" } })
    save()
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].activities).toEqual({ icp_lead_generation: { target_leads: 200 } })
    expect(mergeActivitySettings({ icp_lead_generation: { all_lists: false, list_ids: [listId(9)] } }, onSave.mock.calls[0][0].activities).icp_lead_generation).toMatchObject({ all_lists: false, list_ids: [listId(9)] })
    fireEvent.click(card().getByRole("button", { name: `Remove list ${listId(9)}` }))
    jest.mocked(fetchIcpMiningLists).mockResolvedValueOnce([])
    fireEvent.click(card().getByRole("button", { name: "Retry lists" }))
    await card().findByText("This site has no pending or running mining lists.")
    expect(card().queryByRole("alert")).not.toBeInTheDocument()
    expect(card().getByText(/No lists selected — no mining work/)).toBeInTheDocument()
    expect(checkbox("All pending lists")).not.toBeChecked()
  })

  it("hydrates delayed selections but does not overwrite unsaved list edits", async () => {
    const onSave = jest.fn()
    const view = render(<TestForm onSave={onSave} siteId="site-a" />)
    await card().findByRole("checkbox", { name: "Mining list 1" })
    view.rerender(<TestForm onSave={onSave} siteId="site-a" initial={{ icp_lead_generation: { all_lists: false, list_ids: [listId(1)] } }} />)
    await waitFor(() => expect(checkbox("All pending lists")).not.toBeChecked())
    expect(checkbox("Mining list 1")).toBeChecked()
    fireEvent.click(checkbox("Mining list 2"))
    view.rerender(<TestForm onSave={onSave} siteId="site-a" initial={{ icp_lead_generation: { all_lists: true, list_ids: [] } }} />)
    expect(checkbox("All pending lists")).toBeChecked()
    // The untouched mode hydrates, but the edited selection remains when returning to manual mode.
    fireEvent.click(checkbox("All pending lists"))
    expect(checkbox("All pending lists")).not.toBeChecked()
    expect(checkbox("Mining list 1")).toBeChecked()
    expect(checkbox("Mining list 2")).toBeChecked()
  })

  it("aborts old site loads and never renders late options or errors from another site", async () => {
    const old = deferred<IcpMiningList[]>()
    const current = deferred<IcpMiningList[]>()
    jest.mocked(fetchIcpMiningLists).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const view = render(<TestForm siteId="site-a" />)
    const signal = jest.mocked(fetchIcpMiningLists).mock.calls[0][1]!
    view.rerender(<TestForm siteId="site-b" />)
    expect(signal.aborted).toBe(true)
    await act(async () => current.resolve([miningList(20, { name: "Site B list" })]))
    await act(async () => old.resolve([miningList(10, { name: "Site A list" })]))
    expect(checkbox("Site B list")).toBeInTheDocument()
    expect(screen.queryByText("Site A list")).not.toBeInTheDocument()
    const back = deferred<IcpMiningList[]>()
    jest.mocked(fetchIcpMiningLists).mockReturnValueOnce(back.promise).mockResolvedValueOnce([miningList(30)])
    view.rerender(<TestForm siteId="site-a" />)
    expect(screen.queryByText("Site B list")).not.toBeInTheDocument()
    view.rerender(<TestForm siteId="site-b" />)
    await act(async () => back.reject(new Error("Old site failed")))
    await card().findByRole("checkbox", { name: "Mining list 30" })
    expect(card().queryByRole("alert")).not.toBeInTheDocument()
  })
})