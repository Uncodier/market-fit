import {
  isHourInSelection,
  isKeyInRange,
  resolveCalendarPointerCommit,
} from "../../app/reservations/components/reservation-calendar-select"

describe("resolveCalendarPointerCommit", () => {
  it("selects on the first tap", () => {
    expect(
      resolveCalendarPointerCommit({
        pointerType: "touch",
        moved: false,
        wasAlreadySelected: false,
        dragArmed: false,
      })
    ).toBe("select")
  })

  it("opens create on a second tap of the same slot", () => {
    expect(
      resolveCalendarPointerCommit({
        pointerType: "touch",
        moved: false,
        wasAlreadySelected: true,
        dragArmed: false,
      })
    ).toBe("create")
  })

  it("ignores a touch swipe so the calendar can scroll", () => {
    expect(
      resolveCalendarPointerCommit({
        pointerType: "touch",
        moved: true,
        wasAlreadySelected: false,
        dragArmed: false,
      })
    ).toBe("ignore")
  })

  it("keeps a hold-and-drag range on touch", () => {
    expect(
      resolveCalendarPointerCommit({
        pointerType: "touch",
        moved: true,
        wasAlreadySelected: false,
        dragArmed: true,
      })
    ).toBe("select")
  })

  it("ignores a touch swipe from a selected slot so the calendar can scroll", () => {
    expect(
      resolveCalendarPointerCommit({
        pointerType: "touch",
        moved: true,
        wasAlreadySelected: true,
        dragArmed: false,
      })
    ).toBe("ignore")
  })

  it("keeps a mouse drag as a selection", () => {
    expect(
      resolveCalendarPointerCommit({
        pointerType: "mouse",
        moved: true,
        wasAlreadySelected: false,
        dragArmed: true,
      })
    ).toBe("select")
  })
})

describe("calendar selection ranges", () => {
  it("detects hours inside the selected range", () => {
    const date = new Date(2026, 7, 25)
    const selection = { dateKey: "2026-08-25", startHour: 9, endHour: 11 }

    expect(isHourInSelection(selection, date, 10)).toBe(true)
    expect(isHourInSelection(selection, date, 14)).toBe(false)
    expect(isHourInSelection(null, date, 10)).toBe(false)
  })

  it("detects keys inside a day or month range", () => {
    expect(isKeyInRange("2026-08-20", "2026-08-22", "2026-08-21")).toBe(true)
    expect(isKeyInRange("2026-08-22", "2026-08-20", "2026-08-21")).toBe(true)
    expect(isKeyInRange("2026-08-20", "2026-08-22", "2026-08-23")).toBe(false)
  })
})
