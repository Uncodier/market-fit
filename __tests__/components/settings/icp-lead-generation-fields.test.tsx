import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { ActivitiesSection } from "@/app/components/settings/ActivitiesSection"
import { mergeActivitySettings, normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { useActivityHydration } from "@/app/components/settings/use-activity-hydration"
import type { SiteFormValues } from "@/app/components/settings/form-schema"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a", settings: { channels: { connections: [] } } } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "AI Activities" }) }))
jest.mock("@/app/components/navigation/NavigationLink", () => ({ NavigationLink: ({ children }: any) => <span>{children}</span> }))
jest.mock("@/app/components/settings/outreach-segments", () => ({ fetchOutreachSegments: jest.fn().mockResolvedValue([]) }))
jest.mock("@/app/components/settings/icp-mining-lists", () => ({ fetchIcpMiningLists: jest.fn().mockResolvedValue([]) }))

function TestForm({ onSave, initial, siteId = "site-a" }: { onSave: jest.Mock; initial?: unknown; siteId?: string }) {
  const form = useForm<SiteFormValues>({ defaultValues: { activities: normalizeActivitySettings(initial) } })
  useActivityHydration(form, initial, siteId)
  return <FormProvider {...form}><ActivitiesSection active siteId={siteId} onSave={onSave} /></FormProvider>
}

const card = () => within(document.getElementById("activity-icp_lead_generation")!)

describe("ICP mining controls", () => {
  it("is always active without any status toggle, sending account or follow-up dependency", async () => {
    render(<TestForm onSave={jest.fn()} initial={{ icp_lead_generation: { status: "inactive" } }} />)
    await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
    expect(card().getByText("Always active")).toBeInTheDocument()
    expect(card().queryByRole("radio")).not.toBeInTheDocument()
    expect(card().queryByRole("switch")).not.toBeInTheDocument()
    expect(card().getByText(/independently of Leads Follow Up and channel health/)).toBeInTheDocument()
    expect(card().getByText(/not candidates scanned or a guaranteed number of new leads/)).toBeInTheDocument()
    expect(card().getByRole("spinbutton", { name: "Target leads per run" })).toHaveValue(150)
    expect(card().getByRole("spinbutton")).toBeEnabled()
    expect(card().getByRole("checkbox", { name: "Additional deep research" })).not.toBeChecked()
    expect(within(document.getElementById("activity-leads_follow_up")!).getByRole("radio", { name: /Inactive/ })).toBeChecked()
  })

  it("edits, saves and reloads found-lead targets and research while preserving neighbors", async () => {
    const onSave = jest.fn().mockResolvedValue(true)
    const initial = normalizeActivitySettings({
      icp_lead_generation: { status: "inactive", provider_options: { version: 2 } },
      local_lead_generation: { status: "inactive", custom: "keep" },
      leads_follow_up: { status: "inactive", segment_ids: ["saved-segment"], policy: "keep" },
      future_activity: { value: true },
    })
    const { unmount } = render(<TestForm onSave={onSave} initial={initial} />)
    fireEvent.change(card().getByRole("spinbutton"), { target: { value: "3000" } })
    fireEvent.click(card().getByRole("checkbox", { name: "Additional deep research" }))
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].activities).toEqual({ icp_lead_generation: { target_leads: 3000, research_enabled: true } })
    const saved = mergeActivitySettings(initial, onSave.mock.calls[0][0].activities)
    expect(saved).toEqual({ ...initial, icp_lead_generation: { ...initial.icp_lead_generation, target_leads: 3000, research_enabled: true } })
    await waitFor(() => expect(card().getByRole("button", { name: "Save" })).toBeDisabled())
    unmount()
    render(<TestForm onSave={onSave} initial={saved} />)
    expect(card().getByRole("spinbutton")).toHaveValue(3000)
    expect(card().getByRole("checkbox", { name: "Additional deep research" })).toBeChecked()
    fireEvent.click(card().getByRole("checkbox", { name: "Additional deep research" }))
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(mergeActivitySettings(saved, onSave.mock.calls[1][0].activities).icp_lead_generation).toMatchObject({ status: "active", research_enabled: false })
  })

  it.each(["", "0", "-1", "3001", "12.5"])("keeps invalid target %p dirty and blocks saving", async value => {
    const onSave = jest.fn()
    render(<TestForm onSave={onSave} />)
    fireEvent.change(card().getByRole("spinbutton"), { target: { value } })
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    expect(card().getByRole("alert")).toHaveTextContent("Enter a whole number from 1 to 3,000 found leads per run.")
    expect(onSave).not.toHaveBeenCalled()
    expect(card().getByRole("button", { name: "Save" })).toBeEnabled()
    fireEvent.change(card().getByRole("spinbutton"), { target: { value: "1" } })
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(card().queryByRole("alert")).not.toBeInTheDocument()
  })

  it("keeps failed saves dirty", async () => {
    const onSave = jest.fn().mockResolvedValue(false)
    render(<TestForm onSave={onSave} />)
    fireEvent.change(card().getByRole("spinbutton"), { target: { value: "200" } })
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(card().getByRole("button", { name: "Save" })).toBeEnabled()
  })

  it("hydrates delayed settings without overwriting unsaved edits", async () => {
    const onSave = jest.fn()
    const { rerender } = render(<TestForm onSave={onSave} />)
    rerender(<TestForm onSave={onSave} initial={{ icp_lead_generation: { target_leads: 250, research_enabled: true } }} />)
    expect(card().getByRole("spinbutton")).toHaveValue(250)
    expect(card().getByRole("checkbox", { name: "Additional deep research" })).toBeChecked()
    fireEvent.change(card().getByRole("spinbutton"), { target: { value: "500" } })
    rerender(<TestForm onSave={onSave} initial={{ icp_lead_generation: { target_leads: 750, research_enabled: false } }} />)
    expect(card().getByRole("spinbutton")).toHaveValue(500)
    expect(card().getByRole("checkbox", { name: "Additional deep research" })).not.toBeChecked()
    await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
  })
})