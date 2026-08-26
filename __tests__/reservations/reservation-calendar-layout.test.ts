import {
  CALENDAR_HOUR_HEIGHT,
  groupReservationsByService,
  layoutReservationLanes,
} from "../../app/reservations/components/reservation-calendar-layout"
import type { Reservation } from "../../app/types"

function at(hour: number, minute = 0) {
  return new Date(2026, 7, 25, hour, minute, 0, 0).toISOString()
}

function timed(id: string, startHour: number, startMinute: number, endHour: number, endMinute: number) {
  return {
    id,
    start_time: at(startHour, startMinute),
    end_time: at(endHour, endMinute),
  }
}

function reservation(
  id: string,
  extras: Partial<Reservation> = {}
): Reservation {
  return {
    id,
    site_id: "site-1",
    lead_id: "lead-1",
    status: "confirmed",
    start_time: at(10),
    end_time: at(11),
    created_at: at(9),
    updated_at: at(9),
    ...extras,
  }
}

describe("layoutReservationLanes", () => {
  it("gives sequential non-overlapping events full width", () => {
    const laidOut = layoutReservationLanes([
      timed("a", 10, 0, 11, 0),
      timed("b", 11, 0, 12, 0),
    ])

    expect(laidOut).toHaveLength(2)
    expect(laidOut.every((item) => item.leftPct === 0 && item.widthPct === 100)).toBe(true)
  })

  it("splits two concurrent events 50/50 without overlapping", () => {
    const laidOut = layoutReservationLanes([
      timed("a", 10, 0, 11, 0),
      timed("b", 10, 0, 11, 0),
    ])
    const byId = Object.fromEntries(laidOut.map((item) => [item.reservation.id, item]))

    expect(byId.a.leftPct).toBe(0)
    expect(byId.a.widthPct).toBe(50)
    expect(byId.b.leftPct).toBe(50)
    expect(byId.b.widthPct).toBe(50)
    expect(byId.a.leftPct + byId.a.widthPct).toBeLessThanOrEqual(byId.b.leftPct + 0.0001)
  })

  it("places C under A when C only overlaps B", () => {
    const laidOut = layoutReservationLanes([
      timed("a", 10, 0, 11, 0),
      timed("b", 10, 30, 11, 30),
      timed("c", 11, 0, 12, 0),
    ])
    const byId = Object.fromEntries(laidOut.map((item) => [item.reservation.id, item]))

    expect(byId.a.lane).toBe(0)
    expect(byId.b.lane).toBe(1)
    expect(byId.c.lane).toBe(0)
    expect(byId.a.laneCount).toBe(2)
    expect(byId.c.leftPct).toBe(0)
    expect(byId.b.leftPct).toBe(50)
  })

  it("positions an 11:30 start at half of the 11:00 hour", () => {
    const [item] = layoutReservationLanes([timed("a", 11, 30, 12, 30)])

    expect(item.top).toBe(11 * CALENDAR_HOUR_HEIGHT + CALENDAR_HOUR_HEIGHT / 2)
    expect(item.height).toBe(CALENDAR_HOUR_HEIGHT)
  })
})

describe("groupReservationsByService", () => {
  it("groups by catalog item id even when names match", () => {
    const groups = groupReservationsByService([
      reservation("a", { catalog_item_id: "cris", catalog_item: { name: "CRIS" } }),
      reservation("b", { catalog_item_id: "alberto", catalog_item: { name: "ALBERTO" } }),
      reservation("c", { catalog_item_id: "cris", catalog_item: { name: "CRIS" } }),
    ])

    expect(groups.map((group) => group.key)).toEqual(["catalog:cris", "catalog:alberto"])
    expect(groups[0].reservations.map((item) => item.id)).toEqual(["a", "c"])
    expect(groups[0].label).toBe("CRIS")
  })

  it("rolls variant reservations up to the parent column", () => {
    const groups = groupReservationsByService([
      reservation("parent", {
        catalog_item_id: "emmanuel",
        catalog_item: { name: "EMMANUEL" },
      }),
      reservation("variant", {
        catalog_item_id: "corte",
        catalog_item: {
          name: "Corte",
          parent_id: "emmanuel",
          parent: { name: "EMMANUEL" },
        },
      }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe("catalog:emmanuel")
    expect(groups[0].label).toBe("EMMANUEL")
    expect(groups[0].reservations.map((item) => item.id)).toEqual(["parent", "variant"])
    expect(groups[0].catalogIds).toEqual(["emmanuel", "corte"])
    expect(groups[0].reservations[1].catalog_item?.name).toBe("Corte")
  })

  it("keeps independent variants on their own column", () => {
    const groups = groupReservationsByService([
      reservation("parent", {
        catalog_item_id: "emmanuel",
        catalog_item: { name: "EMMANUEL" },
      }),
      reservation("variant", {
        catalog_item_id: "corte",
        catalog_item: {
          name: "Corte",
          parent_id: "emmanuel",
          parent: { name: "EMMANUEL" },
          metadata: { reservation_mode: "independent" },
        },
      }),
    ])

    expect(groups.map((group) => group.key)).toEqual(["catalog:emmanuel", "catalog:corte"])
    expect(groups[1].label).toBe("Corte")
  })

  it("rolls override variants up to the parent column", () => {
    const groups = groupReservationsByService([
      reservation("variant", {
        catalog_item_id: "corte",
        catalog_item: {
          name: "Corte",
          parent_id: "emmanuel",
          parent: { name: "EMMANUEL" },
          metadata: { reservation_mode: "override" },
        },
      }),
    ])

    expect(groups.map((group) => ({ key: group.key, label: group.label }))).toEqual([
      { key: "catalog:emmanuel", label: "EMMANUEL" },
    ])
  })
})
