import { fireEvent, render, screen, within } from "@testing-library/react"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import { CalendarPreferences } from "@/app/profile/components/CalendarPreferences"
import type { CalendarSettings } from "@/app/services/profile.service"

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ sites: [] }),
}))

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

beforeAll(() => { HTMLElement.prototype.scrollIntoView = jest.fn() })
afterAll(() => { HTMLElement.prototype.scrollIntoView = originalScrollIntoView })

function renderCalendar(settings?: CalendarSettings) {
  const onSave = jest.fn<Promise<void>, [CalendarSettings]>().mockResolvedValue(undefined)
  render(
    <LocalizationProvider preferredLocale="en">
      <CalendarPreferences settings={settings} onSave={onSave} isUpdating={false} />
    </LocalizationProvider>,
  )
  return onSave
}

function expandSchedule() {
  const header = screen.getByLabelText("Schedule Name").parentElement!.parentElement!
  fireEvent.click(header)
}

function daySwitch(day: string) {
  return screen.getByRole("switch", { name: `Availability on ${day}` })
}

it.each([undefined, null])("edits and saves a schedule with %s availability", (availability) => {
  const onSave = renderCalendar({ enabled: true, availability })
  expandSchedule()

  expect(daySwitch("Monday")).toBeChecked()
  expect(daySwitch("Saturday")).not.toBeChecked()
  expect(onSave).not.toHaveBeenCalled()

  fireEvent.click(daySwitch("Monday"))
  fireEvent.click(screen.getByRole("button", { name: "Save Schedule" }))

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    enabled: true,
    availability: expect.objectContaining({
      monday: { enabled: false, start: "09:00", end: "17:00" },
      tuesday: { enabled: true, start: "09:00", end: "17:00" },
    }),
  }))
})

it("lets the user enable an omitted day without changing other saved hours", () => {
  const monday = { enabled: true, start: "10:30", end: "16:00" }
  const friday = { enabled: false, start: "10:00", end: "12:00" }
  const onSave = renderCalendar({
    enabled: true,
    timezone: "Europe/Madrid",
    availability: { monday, friday },
  })
  expandSchedule()

  expect(daySwitch("Tuesday")).not.toBeChecked()
  fireEvent.click(daySwitch("Tuesday"))
  const start = within(daySwitch("Tuesday").parentElement!.parentElement!).getByPlaceholderText("Start time")
  expect(start).toHaveValue("09:00")
  fireEvent.change(start, { target: { value: "11:30" } })
  fireEvent.keyDown(start, { key: "Enter" })
  fireEvent.click(screen.getByRole("button", { name: "Save Schedule" }))

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    timezone: "Europe/Madrid",
    availability: { monday, friday, tuesday: { enabled: true, start: "11:30", end: "17:00" } },
  }))
})

it("only writes default availability when the user saves the schedule", () => {
  const onSave = renderCalendar({ enabled: false })
  expandSchedule()

  fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }))
  expect(onSave.mock.calls[0][0].availability).toBeUndefined()

  fireEvent.click(screen.getByRole("button", { name: "Save Schedule" }))
  expect(onSave.mock.calls[1][0].availability).toMatchObject({
    monday: { enabled: true, start: "09:00", end: "17:00" },
    sunday: { enabled: false, start: "09:00", end: "17:00" },
  })
})