import {
  compareReservationStartTime,
  sortReservationGroups,
  sortReservations,
} from "../../app/reservations/reservation-helpers"

describe("reservation sorting", () => {
  const earlier = { id: "a", start_time: "2026-08-01T10:00:00.000Z" }
  const later = { id: "b", start_time: "2026-08-20T10:00:00.000Z" }

  it("sorts newest first without mutating the original list", () => {
    const input = [earlier, later]
    const sorted = sortReservations(input, "newest")

    expect(sorted.map((item) => item.id)).toEqual(["b", "a"])
    expect(input.map((item) => item.id)).toEqual(["a", "b"])
  })

  it("sorts oldest first", () => {
    const sorted = sortReservations([later, earlier], "oldest")
    expect(sorted.map((item) => item.id)).toEqual(["a", "b"])
  })

  it("sorts groups and items by the selected start time", () => {
    const grouped = sortReservationGroups(
      [
        [
          "Massage",
          [
            { id: "m2", start_time: "2026-08-20T10:00:00.000Z" },
            { id: "m1", start_time: "2026-08-01T10:00:00.000Z" },
          ],
        ],
        ["Haircut", [{ id: "h1", start_time: "2026-08-10T10:00:00.000Z" }]],
      ],
      "newest"
    )

    expect(grouped.map(([name]) => name)).toEqual(["Massage", "Haircut"])
    expect(grouped[0][1].map((item) => item.id)).toEqual(["m2", "m1"])
  })

  it("compares start times for oldest first", () => {
    expect(compareReservationStartTime(earlier, later, "oldest")).toBeLessThan(0)
    expect(compareReservationStartTime(later, earlier, "newest")).toBeLessThan(0)
  })
})
