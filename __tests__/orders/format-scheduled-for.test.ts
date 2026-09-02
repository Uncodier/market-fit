import {
  formatScheduledFor,
  isScheduledUpcoming,
} from "@/app/orders/format-scheduled-for"

describe("formatScheduledFor", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 8, 2, 11, 0, 0))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("returns null for null or undefined", () => {
    expect(formatScheduledFor(null)).toBeNull()
    expect(formatScheduledFor(undefined)).toBeNull()
  })

  it("returns null for invalid dates", () => {
    expect(formatScheduledFor("not-a-date")).toBeNull()
  })

  it("always includes the date and time", () => {
    const today = new Date(2026, 8, 2, 12, 0, 0)
    expect(formatScheduledFor(today.toISOString())).toBe("Sep 2 · 12:00 PM")

    const otherDay = new Date(2026, 8, 4, 12, 0, 0)
    expect(formatScheduledFor(otherDay.toISOString())).toBe("Sep 4 · 12:00 PM")
  })
})

describe("isScheduledUpcoming", () => {
  const now = new Date(2026, 8, 2, 11, 12, 0)

  it("returns false for null or invalid values", () => {
    expect(isScheduledUpcoming(null, now)).toBe(false)
    expect(isScheduledUpcoming("not-a-date", now)).toBe(false)
  })

  it("returns true for a future slot", () => {
    const future = new Date(2026, 8, 2, 12, 0, 0)
    expect(isScheduledUpcoming(future.toISOString(), now)).toBe(true)
  })

  it("returns false for a past slot", () => {
    const past = new Date(2026, 8, 2, 10, 0, 0)
    expect(isScheduledUpcoming(past.toISOString(), now)).toBe(false)
  })
})
