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

function TestForm({ onSave, initial }: { onSave: jest.Mock; initial?: unknown }) {
  const form = useForm<SiteFormValues>({ defaultValues: { activities: normalizeActivitySettings(initial) } })
  useActivityHydration(form, initial, "site-a")
  return <FormProvider {...form}><ActivitiesSection active siteId="site-a" onSave={onSave} /></FormProvider>
}

const key = "daily_resume_and_stand_up"
const card = () => within(document.getElementById(`activity-${key}`)!)
const checkbox = (name: string) => card().getByRole("checkbox", { name })
const sections = ["Sales", "Tasks", "Requirements", "Social media", "Channels", "Records", "Orders", "Reservations", "Inventory"]

describe("Daily Standup controls", () => {
  it("starts inactive with Monday/Friday and all nine English section labels selected", async () => {
    render(<TestForm onSave={jest.fn()} />)
    expect(card().getByRole("radio", { name: /Inactive/ })).toBeChecked()
    for (const day of ["Monday", "Friday"]) expect(checkbox(day)).toBeChecked()
    for (const day of ["Sunday", "Tuesday", "Wednesday", "Thursday", "Saturday"]) expect(checkbox(day)).not.toBeChecked()
    for (const section of sections) expect(checkbox(section)).toBeChecked()
    expect(card().queryByText(/Monday through Friday/)).not.toBeInTheDocument()
    expect(card().getByText(/site's timezone at the configured opening time, or 09:00/)).toBeInTheDocument()
    expect(card().getByRole("group", { name: "Standup weekdays" })).toBeInTheDocument()
    expect(card().getByRole("group", { name: "Report sections" })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
  })

  it("selects multiple days/sections, enables, saves and reloads without losing unknown fields or neighbors", async () => {
    const onSave = jest.fn().mockResolvedValue(true)
    const initial = normalizeActivitySettings({
      [key]: { status: "inactive", weekdays: [], report_sections: [], extension: { version: 2 } },
      local_lead_generation: { status: "inactive", radius: 10 }, future_activity: { untouched: true },
    })
    const { unmount } = render(<TestForm onSave={onSave} initial={initial} />)
    for (const day of ["Sunday", "Saturday"]) fireEvent.click(checkbox(day))
    for (const section of ["Social media", "Records", "Orders", "Reservations", "Inventory"]) fireEvent.click(checkbox(section))
    fireEvent.click(card().getByRole("radio", { name: /^Active/ }))
    expect(card().getByRole("radio", { name: /^Active/ })).toBeChecked()
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const saved = mergeActivitySettings(initial, onSave.mock.calls[0][0].activities)
    expect(saved).toEqual({ ...initial, [key]: { status: "active", weekdays: [0, 6], report_sections: ["social", "records", "orders", "reservations", "inventory"], extension: { version: 2 } } })
    await waitFor(() => expect(card().getByRole("button", { name: "Save" })).toBeDisabled())
    unmount()
    render(<TestForm onSave={onSave} initial={saved} />)
    expect(card().getByRole("radio", { name: /^Active/ })).toBeChecked()
    for (const day of ["Sunday", "Saturday"]) expect(checkbox(day)).toBeChecked()
    for (const day of ["Monday", "Friday"]) expect(checkbox(day)).not.toBeChecked()
    for (const section of ["Social media", "Records", "Orders", "Reservations", "Inventory"]) expect(checkbox(section)).toBeChecked()
    for (const section of ["Sales", "Tasks", "Requirements", "Channels"]) expect(checkbox(section)).not.toBeChecked()
    fireEvent.click(card().getByRole("radio", { name: /Inactive/ }))
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1][0].activities[key]).toEqual({ status: "inactive" })
    expect(mergeActivitySettings(saved, onSave.mock.calls[1][0].activities)[key]).toEqual({ ...saved[key], status: "inactive" })
  })

  it("retains explicitly empty selections, blocks enabling, and allows saving them while inactive", async () => {
    const onSave = jest.fn().mockResolvedValue(true)
    render(<TestForm onSave={onSave} />)
    for (const name of ["Monday", "Friday", ...sections]) fireEvent.click(checkbox(name))
    fireEvent.click(card().getByRole("radio", { name: /^Active/ }))
    expect(card().getByRole("radio", { name: /Inactive/ })).toBeChecked()
    expect(card().getByRole("alert")).toHaveTextContent("Select at least one weekday")
    expect(card().getByRole("alert")).toHaveTextContent("Select at least one report section")
    expect(card().getAllByRole("checkbox").every(element => element.getAttribute("data-state") === "unchecked")).toBe(true)
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].activities[key]).toEqual({ weekdays: [], report_sections: [] })
    expect(mergeActivitySettings(undefined, onSave.mock.calls[0][0].activities)[key]).toEqual({ status: "inactive", weekdays: [], report_sections: [] })
  })

  it.each(["weekdays", "report_sections"])("blocks saving active standup with empty %s from any activity card", async field => {
    const onSave = jest.fn()
    render(<TestForm onSave={onSave} initial={{ [key]: { status: "active", weekdays: [0], report_sections: ["records"] } }} />)
    fireEvent.click(checkbox(field === "weekdays" ? "Sunday" : "Records"))
    fireEvent.click(within(document.getElementById("activity-email_sync")!).getByRole("button", { name: "Save" }))
    expect(card().getByRole("alert")).toHaveTextContent("Select at least one")
    expect(onSave).not.toHaveBeenCalled()
    expect(card().getByRole("button", { name: "Save" })).toBeEnabled()
    await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
  })

  it("hydrates delayed custom and empty selections without overwriting local edits", async () => {
    const onSave = jest.fn()
    const { rerender } = render(<TestForm onSave={onSave} />)
    rerender(<TestForm onSave={onSave} initial={{ [key]: { status: "inactive", weekdays: [], report_sections: [] } }} />)
    expect(checkbox("Monday")).not.toBeChecked()
    expect(checkbox("Records")).not.toBeChecked()
    rerender(<TestForm onSave={onSave} initial={{ [key]: { status: "active", weekdays: [0, 6], report_sections: ["records"] } }} />)
    expect(checkbox("Sunday")).toBeChecked()
    expect(checkbox("Saturday")).toBeChecked()
    expect(checkbox("Records")).toBeChecked()
    fireEvent.click(checkbox("Orders"))
    rerender(<TestForm onSave={onSave} initial={{ [key]: { status: "active", weekdays: [1], report_sections: ["sales"] } }} />)
    expect(checkbox("Sunday")).not.toBeChecked()
    expect(checkbox("Monday")).toBeChecked()
    expect(checkbox("Records")).toBeChecked()
    expect(checkbox("Orders")).toBeChecked()
    expect(checkbox("Sales")).not.toBeChecked()
    await waitFor(() => expect(screen.queryByText("Loading segments...")).not.toBeInTheDocument())
  })

  it("does not clear dirty state after a failed save", async () => {
    const onSave = jest.fn().mockResolvedValue(false)
    render(<TestForm onSave={onSave} />)
    fireEvent.click(checkbox("Sunday"))
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(card().getByRole("button", { name: "Save" })).toBeEnabled()
  })
})