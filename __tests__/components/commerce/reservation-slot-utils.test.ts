import { format } from "date-fns"
import {
  findSlotByInstant,
  formatSlotTime,
  isSameSlotInstant,
  mergeCurrentReservationSlot,
  shouldShowSlotLeftover,
  slotCalendarDate,
} from "@/app/components/commerce/reservation-slot-utils"

describe("reservation slot utils", () => {
  it("treats the same instant as equal even when ISO strings differ", () => {
    expect(isSameSlotInstant("2026-08-14T17:00:00.000Z", "2026-08-14T17:00:00Z")).toBe(true)
    expect(isSameSlotInstant("2026-08-14T17:00:00.000Z", "2026-08-14T18:00:00.000Z")).toBe(false)
  })

  it("does not inject a second slot when the current booking matches by timestamp", () => {
    const generated = [
      { start: "2026-08-14T17:00:00.000Z", end: "2026-08-14T18:00:00.000Z", available: 1 },
      { start: "2026-08-14T18:00:00.000Z", end: "2026-08-14T19:00:00.000Z", available: 1 },
    ]

    const merged = mergeCurrentReservationSlot(
      generated,
      "2026-08-14T17:00:00Z",
      "2026-08-14T18:00:00Z"
    )

    expect(merged).toHaveLength(2)
    expect(findSlotByInstant(merged, "2026-08-14T17:00:00Z")?.start).toBe(
      "2026-08-14T17:00:00.000Z"
    )
  })

  it("injects the current booking without inventing leftover when it is missing", () => {
    const generated = [
      { start: "2026-08-14T18:00:00.000Z", end: "2026-08-14T19:00:00.000Z", available: 1 },
    ]

    const merged = mergeCurrentReservationSlot(
      generated,
      "2026-08-14T17:00:00.000Z",
      "2026-08-14T18:00:00.000Z"
    )

    expect(merged).toHaveLength(2)
    expect(merged[0]).toEqual({
      start: "2026-08-14T17:00:00.000Z",
      end: "2026-08-14T18:00:00.000Z",
      available: 0,
    })
  })

  it("hides leftover only on the current booking slot", () => {
    const current = {
      start: "2026-08-14T17:00:00.000Z",
      end: "2026-08-14T18:00:00.000Z",
      available: 1,
    }
    const other = {
      start: "2026-08-14T18:00:00.000Z",
      end: "2026-08-14T19:00:00.000Z",
      available: 1,
    }

    expect(shouldShowSlotLeftover(current, "2026-08-14T17:00:00Z")).toBe(false)
    expect(shouldShowSlotLeftover(other, "2026-08-14T17:00:00Z")).toBe(true)
  })

  it("formats 11am and 8pm Mexico from UTC instants, keeping both on the same calendar day", () => {
    const timeZone = "America/Mexico_City"
    expect(formatSlotTime("2026-08-26T17:00:00.000Z", timeZone)).toBe("11:00 AM")
    expect(formatSlotTime("2026-08-27T02:00:00.000Z", timeZone)).toBe("8:00 PM")
    expect(slotCalendarDate("2026-08-26T17:00:00.000Z", timeZone)).toBe("2026-08-26")
    expect(slotCalendarDate("2026-08-27T02:00:00.000Z", timeZone)).toBe("2026-08-26")
  })

  it("does not remap to the schedule timezone in system/browser display", () => {
    const iso = "2026-08-26T17:00:00.000Z"
    expect(formatSlotTime(iso, "America/Mexico_City", "system")).toBe(format(new Date(iso), "h:mm a"))
    expect(slotCalendarDate(iso, "America/Mexico_City", "system")).toBe(format(new Date(iso), "yyyy-MM-dd"))
  })

  it("copies timezone onto an injected current booking", () => {
    const merged = mergeCurrentReservationSlot(
      [
        {
          start: "2026-08-14T18:00:00.000Z",
          end: "2026-08-14T19:00:00.000Z",
          available: 1,
          timezone: "America/Mexico_City",
        },
      ],
      "2026-08-14T17:00:00.000Z",
      "2026-08-14T18:00:00.000Z"
    )

    expect(merged[0].timezone).toBe("America/Mexico_City")
  })
})
