import { fireEvent, render, screen } from "@testing-library/react"
import { endOfDay, format, startOfDay } from "date-fns"
import { enUS } from "date-fns/locale"
import { DatePicker } from "@/app/components/ui/date-picker"
import { getDateRangeError } from "@/app/components/ui/date-picker-range"
import { getDefaultDateEvents } from "@/app/components/ui/date-picker-presets"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    locale: "en",
    t: (key: string, values?: { date: string; time: string }) => {
      if (values) return `${values.date} at ${values.time}`
      const translations: Record<string, string> = {
        "datePicker.today": "Today", "datePicker.tomorrow": "Tomorrow",
        "datePicker.nextWeek": "Next week", "datePicker.thisMonth": "This month",
        "datePicker.nextMonth": "Next month", "datePicker.previousMonth": "Previous month",
        "datePicker.selectDateRange": "Select date range", "datePicker.selectDate": "Select date",
        "datePicker.last30Days": "Last 30 days",
      }
      return translations[key] || key
    },
  }),
}))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))

describe("DatePicker shared behavior", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => jest.useRealTimers())

  it("keeps single-date and task future presets working with native preset buttons", () => {
    const setDate = jest.fn()
    render(<DatePicker mode="task" setDate={setDate} />)
    fireEvent.click(screen.getByRole("button", { name: "Select date" }))
    const tomorrow = screen.getByRole("button", { name: "Tomorrow" })
    expect(tomorrow.tagName).toBe("BUTTON")
    expect(tomorrow).toHaveAttribute("type", "button")
    fireEvent.click(tomorrow)
    expect(setDate).toHaveBeenCalledTimes(1)
    expect(setDate).toHaveBeenCalledWith(new Date(2026, 8, 30))
  })

  it("retains time when selecting a calendar day in time-picker mode", () => {
    const setDate = jest.fn()
    render(<DatePicker date={new Date(2026, 8, 10, 10, 45)} setDate={setDate} showTimePicker showEvents={false} />)
    fireEvent.click(screen.getByRole("button", { name: /September 10th, 2026 at 10:45/ }))
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 8, 11), "PPPP") }))
    expect(setDate).toHaveBeenCalledWith(new Date(2026, 8, 11, 10, 45))
  })

  it("keeps calendar-mode future month navigation available", () => {
    const setDate = jest.fn()
    render(<DatePicker mode="calendar" setDate={setDate} />)
    fireEvent.click(screen.getByRole("button", { name: "Select date" }))
    const nextMonthPreset = screen.getAllByRole("button", { name: "Next month" }).find((button) => button.hasAttribute("aria-pressed"))!
    fireEvent.click(nextMonthPreset)
    expect(setDate).toHaveBeenCalledWith(new Date(2026, 9, 1))
    expect(setDate).toHaveBeenCalledTimes(1)
  })

  it("honors explicit custom event bounds without a default maximum or fabricated end", () => {
    const setDate = jest.fn(), setEndDate = jest.fn(), onRangeSelect = jest.fn()
    const start = new Date(1980, 0, 1), end = new Date(2010, 11, 31)
    render(<DatePicker mode="range" setDate={setDate} setEndDate={setEndDate} onRangeSelect={onRangeSelect}
      events={[{ id: "archive", label: "Archive", value: start, endDate: end, type: "custom", period: "past" }]} />)
    fireEvent.click(screen.getByRole("button", { name: "Select date range" }))
    fireEvent.click(screen.getByRole("button", { name: "Archive" }))
    expect(setDate).toHaveBeenCalledWith(startOfDay(start))
    expect(setEndDate).toHaveBeenCalledWith(endOfDay(end))
    expect(onRangeSelect).toHaveBeenCalledWith(startOfDay(start), endOfDay(end))
  })

  it("validates explicit event endDate and respects disabled custom events", () => {
    const setDate = jest.fn(), onRangeSelect = jest.fn()
    render(<DatePicker mode="range" setDate={setDate} onRangeSelect={onRangeSelect} maxRangeDays={7}
      events={[
        { label: "Too long", value: new Date(2026, 0, 1), endDate: new Date(2026, 0, 8), type: "day", period: "past" },
        { id: "disabled", label: "Unavailable", value: new Date(), type: "day", period: "current", disabled: true, disabledReason: "Unavailable source" },
      ]} />)
    fireEvent.click(screen.getByRole("button", { name: "Select date range" }))
    expect(screen.getByRole("button", { name: "Too long" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Too long" })).toHaveAccessibleDescription("Select up to 7 days.")
    const unavailable = screen.getByRole("button", { name: "Unavailable" })
    expect(unavailable).toBeDisabled()
    fireEvent.click(unavailable)
    expect(setDate).not.toHaveBeenCalled()
    expect(onRangeSelect).not.toHaveBeenCalled()
  })

  it("does not invoke any setters during an incomplete or rejected custom range", () => {
    const setDate = jest.fn(), setEndDate = jest.fn(), onRangeSelect = jest.fn()
    render(<DatePicker mode="range" date={new Date(2026, 8, 10)} endDate={new Date(2026, 8, 12)}
      setDate={setDate} setEndDate={setEndDate} onRangeSelect={onRangeSelect} maxRangeDays={7} />)
    const trigger = screen.getByRole("button", { name: "Sep 10 - Sep 12, 2026" })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 8, 1), "PPPP") }))
    expect(setDate).not.toHaveBeenCalled()
    expect(setEndDate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 8, 8), "PPPP") }))
    expect(screen.getByRole("alert")).toHaveTextContent("Select up to 7 days.")
    expect(setDate).not.toHaveBeenCalled()
    expect(setEndDate).not.toHaveBeenCalled()
    expect(onRangeSelect).not.toHaveBeenCalled()
    expect(trigger).toHaveTextContent("Sep 10 - Sep 12, 2026")
  })

  it("shows invalid incoming dates explicitly without a render crash", () => {
    render(<DatePicker date={new Date(NaN)} setDate={jest.fn()} />)
    expect(screen.getByRole("button", { name: "Select date" })).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent("Select valid start and end dates.")
  })

  it("does not open a disabled custom trigger", () => {
    render(<DatePicker setDate={jest.fn()} disabled trigger={<button>Custom trigger</button>} />)
    fireEvent.click(screen.getByRole("button", { name: "Custom trigger" }))
    expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument()
  })

  it("closes an open picker when disabled during a policy reload", () => {
    const setDate = jest.fn()
    const { rerender } = render(<DatePicker setDate={setDate} />)
    fireEvent.click(screen.getByRole("button", { name: "Select date" }))
    expect(screen.getByRole("button", { name: "Today" })).toBeVisible()
    rerender(<DatePicker setDate={setDate} disabled />)
    expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Select date" })).toBeDisabled()
    expect(setDate).not.toHaveBeenCalled()
  })

  it("preserves report-mode callback semantics with corrected inclusive ranges", () => {
    const setDate = jest.fn(), onRangeSelect = jest.fn()
    render(<DatePicker mode="report" setDate={setDate} onRangeSelect={onRangeSelect} />)
    fireEvent.click(screen.getByRole("button", { name: "Select date" }))
    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }))
    expect(onRangeSelect).toHaveBeenCalledWith(new Date(2026, 7, 31), endOfDay(new Date(2026, 8, 29)))
    expect(setDate).toHaveBeenCalledTimes(1)
  })

  it("uses inclusive calendar days for leap years and DST transitions", () => {
    expect(getDateRangeError(new Date(2024, 0, 1), new Date(2024, 11, 31), 366)).toBeNull()
    expect(getDateRangeError(new Date(2024, 0, 1), new Date(2024, 11, 31), 365)).toBe("Select up to 365 days.")
    expect(getDateRangeError(new Date(2026, 2, 7), new Date(2026, 2, 9), 3)).toBeNull()
    expect(getDateRangeError(new Date(2026, 9, 31), new Date(2026, 10, 2), 3)).toBeNull()
    const lastYear = getDefaultDateEvents('range', (key) => key, enUS, 366, new Date(2025, 1, 1)).find((event) => event.id === 'lastYear')
    expect(lastYear?.disabled).not.toBe(true)
  })
})