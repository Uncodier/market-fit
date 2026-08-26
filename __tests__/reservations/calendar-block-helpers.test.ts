import {
  calendarBlockAppliesToGroup,
  calendarBlockOverlapsMonth,
  calendarBlockScopeLabel,
  calendarBlockTitle,
  filterCalendarBlocks,
  groupBlockSpansByDate,
  groupTimelineByLocalDate,
  splitBlockByLocalDays,
} from "../../app/reservations/calendar-block-helpers"
import type { CalendarBlock, Reservation } from "../../app/types"

function at(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(year, month, day, hour, minute, 0, 0).toISOString()
}

function block(overrides: Partial<CalendarBlock> = {}): CalendarBlock {
  return {
    id: "block-1",
    site_id: "site-1",
    entity_type: "global",
    entity_id: null,
    start_time: at(2026, 7, 25, 9),
    end_time: at(2026, 7, 25, 17),
    reason: "Holiday",
    created_at: at(2026, 7, 24, 9),
    updated_at: at(2026, 7, 24, 9),
    ...overrides,
  }
}

describe("calendar block labels", () => {
  it("uses the reason when present and falls back to Blocked time", () => {
    expect(calendarBlockTitle(block())).toBe("Holiday")
    expect(calendarBlockTitle(block({ reason: "  " }))).toBe("Blocked time")
  })

  it("describes the block scope", () => {
    expect(calendarBlockScopeLabel(block())).toBe("Entire business")
    expect(calendarBlockScopeLabel(block({ entity_type: "catalog_item" }))).toBe("Specific service")
    expect(calendarBlockScopeLabel(block({ entity_type: "user" }))).toBe("Staff member")
  })
})

describe("filterCalendarBlocks", () => {
  const blocks = [
    block({ id: "global" }),
    block({ id: "user-a", entity_type: "user", entity_id: "member-a", reason: "Vacation" }),
    block({ id: "user-b", entity_type: "user", entity_id: "member-b", reason: "Training" }),
    block({ id: "service", entity_type: "catalog_item", entity_id: "svc-1" }),
  ]

  it("hides blocks when viewing cancelled reservations", () => {
    expect(filterCalendarBlocks(blocks, { statusFilter: "cancelled" })).toEqual([])
  })

  it("keeps global and service blocks when filtering by staff", () => {
    const filtered = filterCalendarBlocks(blocks, { selectedMember: "member-a" })
    expect(filtered.map((item) => item.id)).toEqual(["global", "user-a", "service"])
  })

  it("matches search against reason and scope", () => {
    const filtered = filterCalendarBlocks(blocks, { query: "vacation" })
    expect(filtered.map((item) => item.id)).toEqual(["user-a"])
  })
})

describe("splitBlockByLocalDays", () => {
  it("keeps a same-day block as one span", () => {
    const spans = splitBlockByLocalDays(block())
    expect(spans).toHaveLength(1)
    expect(spans[0].dateStr).toBe("2026-08-25")
  })

  it("splits overnight blocks across two local days", () => {
    const spans = splitBlockByLocalDays(
      block({
        start_time: at(2026, 7, 25, 22),
        end_time: at(2026, 7, 26, 2),
      })
    )
    expect(spans.map((span) => span.dateStr)).toEqual(["2026-08-25", "2026-08-26"])
  })

  it("does not include the next day when the block ends at midnight", () => {
    const spans = splitBlockByLocalDays(
      block({
        start_time: at(2026, 7, 25, 9),
        end_time: at(2026, 7, 26, 0),
      })
    )
    expect(spans.map((span) => span.dateStr)).toEqual(["2026-08-25"])
  })
})

describe("groupBlockSpansByDate", () => {
  it("places each span on its local date", () => {
    const grouped = groupBlockSpansByDate([
      block({
        id: "overnight",
        start_time: at(2026, 7, 25, 22),
        end_time: at(2026, 7, 26, 2),
      }),
    ])
    expect(Object.keys(grouped)).toEqual(["2026-08-25", "2026-08-26"])
  })
})

describe("calendarBlockAppliesToGroup", () => {
  it("shows service blocks only on the matching catalog column", () => {
    const serviceBlock = block({ entity_type: "catalog_item", entity_id: "svc-1" })
    expect(calendarBlockAppliesToGroup(serviceBlock, "catalog:svc-1")).toBe(true)
    expect(calendarBlockAppliesToGroup(serviceBlock, "catalog:svc-2")).toBe(false)
    expect(calendarBlockAppliesToGroup(block(), "catalog:svc-1")).toBe(true)
  })
})

describe("groupTimelineByLocalDate", () => {
  it("mixes reservations and blocks on the same local day", () => {
    const reservation = {
      id: "res-1",
      start_time: at(2026, 7, 25, 10),
    } as Reservation
    const grouped = groupTimelineByLocalDate([reservation], [block()], "oldest")

    expect(grouped).toHaveLength(1)
    expect(grouped[0][0]).toBe("2026-08-25")
    expect(grouped[0][1].map((entry) => entry.kind)).toEqual(["block", "reservation"])
  })
})

describe("calendarBlockOverlapsMonth", () => {
  it("includes blocks that cross the month boundary", () => {
    const spanning = block({
      start_time: at(2026, 6, 31, 22),
      end_time: at(2026, 7, 1, 2),
    })
    expect(calendarBlockOverlapsMonth(spanning, 2026, 7)).toBe(true)
    expect(calendarBlockOverlapsMonth(block(), 2026, 6)).toBe(false)
  })
})
