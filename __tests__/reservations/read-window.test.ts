import { calendarReadWindow, calendarSelectedDate, listReadWindow, overlapsReadWindow, validateReadWindow, type ReservationReadWindow } from "@/app/reservations/read-window"
import { readAllPages, READ_PAGE_SIZE, READ_MAX_PAGES } from "@/app/reservations/read-pages"
import { createNewDatePreservingDay } from "@/app/reservations/components/reservation-calendar-utils"
import { groupReservationSpans } from "@/app/reservations/components/reservation-calendar-range-data"
import type { Reservation } from "@/app/types"
import type { CalendarBlock } from "@/app/types"
import { groupBlockSpansByDate } from "@/app/reservations/calendar-block-helpers"

const window = { start: "2026-03-01T00:00:00Z", end: "2026-04-01T00:00:00Z" }

describe("reservation read windows", () => {
  it.each([
    null, {}, { start: "2026-01-01", end: window.end },
    { start: "2026-02-30T00:00:00Z", end: window.end },
    { start: "2026-03-01T24:00:00Z", end: window.end },
    { start: window.end, end: window.start }, { start: window.start, end: window.start },
    { start: "2025-01-01T00:00:00Z", end: "2027-01-01T00:00:00Z" },
  ])("rejects invalid windows %j", value => expect(() => validateReadWindow(value as ReservationReadWindow)).toThrow())
  it("normalizes timezone ISO input and permits a leap year", () => {
    expect(validateReadWindow({ start: "2026-03-01T00:00:00-08:00", end: window.end }).start).toBe("2026-03-01T08:00:00.000Z")
    expect(() => validateReadWindow({ start: "2024-01-01T00:00:00Z", end: "2025-01-01T00:00:00Z" })).not.toThrow()
  })
  it("uses half-open overlap, retains spanning/open-ended reservations", () => {
    expect(overlapsReadWindow("2020-01-01T00:00:00Z", "2027-01-01T00:00:00Z", window)).toBe(true)
    expect(overlapsReadWindow("2020-01-01T00:00:00Z", null, window)).toBe(true)
    expect(overlapsReadWindow(window.end, null, window)).toBe(false)
    expect(overlapsReadWindow("2020-01-01T00:00:00Z", window.start, window)).toBe(false)
  })
  it("matches local month grid spillover, week, day, year, and list months", () => {
    const date = new Date(2026, 9, 14)
    expect(calendarReadWindow(date, "month")).toEqual({ start: new Date(2026, 8, 27).toISOString(), end: new Date(2026, 10, 1).toISOString() })
    expect(calendarReadWindow(date, "week")).toEqual({ start: new Date(2026, 9, 11).toISOString(), end: new Date(2026, 9, 18).toISOString() })
    expect(calendarReadWindow(date, "day")).toEqual({ start: date.toISOString(), end: new Date(2026, 9, 15).toISOString() })
    expect(listReadWindow(date)).toEqual({ start: new Date(2026, 9, 1).toISOString(), end: new Date(2026, 10, 1).toISOString() })
    expect(() => validateReadWindow(calendarReadWindow(new Date(2024, 5, 1), "year"))).not.toThrow()
  })
  it("uses local midnight across DST rather than fixed 24-hour arithmetic", () => {
    const range = calendarReadWindow(new Date(2026, 2, 8), "day")
    expect(range.end).toBe(new Date(2026, 2, 9).toISOString())
    expect(range.start).toBe(new Date(2026, 2, 8).toISOString())
  })
  it("rejects impossible URL dates and navigates month/year boundaries without overflow", () => {
    const now = new Date(2026, 0, 1)
    expect(calendarSelectedDate("2026-02-30", now)).toBe(now)
    expect(calendarSelectedDate("2026-10-14").getDate()).toBe(14)
    expect(createNewDatePreservingDay(new Date(2026, 0, 31), 2026, 1)).toEqual(new Date(2026, 1, 28))
    expect(createNewDatePreservingDay(new Date(2026, 11, 31), 2026, 12)).toEqual(new Date(2027, 0, 31))
  })
  it("displays old overlapping events every visible day without changing edit records", () => {
    const row = { id: "old", start_time: "2020-01-01T00:00:00Z", end_time: "2030-01-01T00:00:00Z" } as Reservation
    const range = calendarReadWindow(new Date(2026, 9, 14), "week")
    const grouped = groupReservationSpans([row], range)
    expect(Object.keys(grouped)).toHaveLength(7)
    expect(grouped["2026-10-11"][0].id).toBe("old")
    expect(row.start_time).toBe("2020-01-01T00:00:00Z")
  })
  it("clips years-long and open-ended blocks to visible days while retaining canonical editing records", () => {
    const row = { id: "old", start_time: "2020-01-01T00:00:00Z", end_time: null } as unknown as CalendarBlock
    const range = calendarReadWindow(new Date(2026, 9, 14), "week")
    const grouped = groupBlockSpansByDate([row], range)
    expect(Object.keys(grouped)).toHaveLength(7)
    expect(grouped["2026-10-11"][0].block).toBe(row)
  })
})

describe("complete paged reads", () => {
  it("reads beyond 500 and requests an empty final page for exact multiples", async () => {
    const query = jest.fn((offset: number) => Promise.resolve({ data: offset < 1000 ? Array.from({ length: READ_PAGE_SIZE }, (_, i) => offset + i) : [], error: null }))
    const rows = await readAllPages(query)
    expect(rows).toHaveLength(1000)
    expect(query.mock.calls.map(call => call[0])).toEqual([0, 500, 1000])
  })
  it("throws rather than returning partial data when a later page fails", async () => {
    await expect(readAllPages(offset => Promise.resolve({ data: offset ? null : Array(500).fill(1), error: offset ? { message: "offline" } : null }))).rejects.toThrow("could not be loaded")
  })
  it("fails the page budget and timeout explicitly", async () => {
    await expect(readAllPages(() => Promise.resolve({ data: [], error: null }), { deadline: Date.now() + 1000, pages: READ_MAX_PAGES })).rejects.toThrow("smaller period")
    await expect(readAllPages((_, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))), { deadline: Date.now() + 10, pages: 0 })).rejects.toThrow("timed out")
  })
  it("does not release a timed-out read until ignored-abort transport actually settles", async () => {
    let settle!: (value: { data: number[]; error: null }) => void
    let finished = false
    const pending = readAllPages<number>(() => new Promise(resolve => { settle = resolve }), { deadline: Date.now() + 5, pages: 0 })
    const result = pending.catch(error => { finished = true; return error as Error })
    await new Promise(resolve => setTimeout(resolve, 15))
    expect(finished).toBe(false)
    settle({ data: [], error: null })
    expect(await result).toMatchObject({ message: expect.stringContaining("timed out") })
  })
})