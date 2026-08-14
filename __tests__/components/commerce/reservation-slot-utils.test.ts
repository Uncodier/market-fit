import {
  findSlotByInstant,
  isSameSlotInstant,
  mergeCurrentReservationSlot,
  shouldShowSlotLeftover,
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
})
