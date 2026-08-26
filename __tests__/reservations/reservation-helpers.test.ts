import {
  compareReservationStartTime,
  reservationCanCancel,
  reservationCanRestore,
  reservationServiceColor,
  reservationServiceColorForKey,
  reservationServiceColorKey,
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

describe("reservation service colors", () => {
  it("keeps the same color for the same catalog item", () => {
    const first = reservationServiceColor({ catalog_item_id: "service-massage" })
    const second = reservationServiceColor({ catalog_item_id: "service-massage" })

    expect(first).toEqual(second)
  })

  it("prefers catalog item id over the service name", () => {
    expect(
      reservationServiceColorKey({
        catalog_item_id: "service-1",
        catalog_item: { name: "Massage" },
      })
    ).toBe("catalog:service-1")
  })

  it("falls back to location, employee, then name", () => {
    expect(reservationServiceColorKey({ location_id: "room-1" })).toBe("location:room-1")
    expect(reservationServiceColorKey({ assignee_user_id: "member-1" })).toBe("employee:member-1")
    expect(reservationServiceColorKey({ catalog_item: { name: "Haircut" } })).toBe("name:Haircut")
  })

  it("rolls variant colors up to the parent catalog item", () => {
    expect(
      reservationServiceColorKey({
        catalog_item_id: "corte",
        catalog_item: {
          name: "Corte",
          parent_id: "emmanuel",
          parent: { name: "EMMANUEL" },
        },
      })
    ).toBe("catalog:emmanuel")
    expect(reservationServiceColorForKey("catalog:emmanuel")).toEqual(
      reservationServiceColor({
        catalog_item_id: "corte",
        catalog_item: { name: "Corte", parent_id: "emmanuel" },
      })
    )
  })

  it("keeps independent variant colors on the leaf catalog item", () => {
    expect(
      reservationServiceColorKey({
        catalog_item_id: "corte",
        catalog_item: {
          name: "Corte",
          parent_id: "emmanuel",
          metadata: { reservation_mode: "independent" },
        },
      })
    ).toBe("catalog:corte")
  })

  it("spreads different catalog items across the palette", () => {
    const swatches = new Set(
      ["massage", "haircut", "facial", "manicure", "training", "consult"].map(
        (id) => reservationServiceColor({ catalog_item_id: id }).swatch
      )
    )

    expect(swatches.size).toBeGreaterThan(1)
  })
})

describe("reservationCanCancel", () => {
  it("allows cancelling pending and confirmed reservations", () => {
    expect(reservationCanCancel({ status: "pending" })).toBe(true)
    expect(reservationCanCancel({ status: "confirmed" })).toBe(true)
  })

  it("does not allow cancelling completed, cancelled, or task reservations", () => {
    expect(reservationCanCancel({ status: "completed" })).toBe(false)
    expect(reservationCanCancel({ status: "cancelled" })).toBe(false)
    expect(reservationCanCancel({ status: "confirmed", is_task: true })).toBe(false)
  })
})

describe("reservationCanRestore", () => {
  it("allows restoring cancelled reservations", () => {
    expect(reservationCanRestore({ status: "cancelled" })).toBe(true)
  })

  it("does not allow restoring active, completed, or task reservations", () => {
    expect(reservationCanRestore({ status: "pending" })).toBe(false)
    expect(reservationCanRestore({ status: "confirmed" })).toBe(false)
    expect(reservationCanRestore({ status: "completed" })).toBe(false)
    expect(reservationCanRestore({ status: "cancelled", is_task: true })).toBe(false)
  })
})
