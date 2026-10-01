import { endOfDay } from "date-fns"
import { enUS, es } from "date-fns/locale"
import { DATE_RANGE_PRESETS, isDateRangePreset, resolveDateRangePreset } from "@/lib/dates/date-range-presets"
import { getDefaultDateEvents, getEventRange } from "@/app/components/ui/date-picker-presets"

describe("relative date range resolution", () => {
  it.each([
    ["today", new Date(2026, 9, 1), new Date(2026, 9, 1)],
    ["yesterday", new Date(2026, 8, 30), new Date(2026, 8, 30)],
    ["last7Days", new Date(2026, 8, 25), new Date(2026, 9, 1)],
    ["last30Days", new Date(2026, 8, 2), new Date(2026, 9, 1)],
    ["last90Days", new Date(2026, 6, 4), new Date(2026, 9, 1)],
    ["thisWeek", new Date(2026, 8, 27), new Date(2026, 9, 1)],
    ["thisMonth", new Date(2026, 9, 1), new Date(2026, 9, 1)],
    ["lastMonth", new Date(2026, 8, 1), new Date(2026, 8, 30)],
    ["thisQuarter", new Date(2026, 9, 1), new Date(2026, 9, 1)],
    ["yearToDate", new Date(2026, 0, 1), new Date(2026, 9, 1)],
    ["lastYear", new Date(2025, 0, 1), new Date(2025, 11, 31)],
  ] as const)("resolves %s across month and quarter boundaries", (preset, startDate, end) => {
    expect(resolveDateRangePreset(preset, new Date(2026, 9, 1, 12))).toEqual({ startDate, endDate: endOfDay(end) })
  })

  it("handles year boundaries and leap February", () => {
    expect(resolveDateRangePreset("lastMonth", new Date(2026, 0, 1))).toEqual({
      startDate: new Date(2025, 11, 1), endDate: endOfDay(new Date(2025, 11, 31)),
    })
    expect(resolveDateRangePreset("lastMonth", new Date(2024, 2, 1))).toEqual({
      startDate: new Date(2024, 1, 1), endDate: endOfDay(new Date(2024, 1, 29)),
    })
  })

  it.each([new Date(2026, 2, 9, 12), new Date(2026, 10, 2, 12)])("keeps local day bounds across DST (%s)", (now) => {
    const expectedStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    const range = resolveDateRangePreset("last7Days", now)
    expect(range).toEqual({ startDate: expectedStart, endDate: endOfDay(now) })
    expect(range.startDate.getHours()).toBe(0)
    expect(range.endDate.getHours()).toBe(23)
  })

  it.each([enUS, es])("shares the picker formulas for locale $code", (locale) => {
    const now = new Date(2026, 9, 1, 12)
    const events = [...getDefaultDateEvents("range", (key) => key, locale, undefined, now),
      ...getDefaultDateEvents("report", (key) => key, locale, undefined, now)]
    for (const preset of DATE_RANGE_PRESETS) {
      const event = events.find((event) => event.id === preset)!
      const { start, end } = getEventRange(event, locale, now)
      expect(resolveDateRangePreset(preset, now, locale)).toEqual({ startDate: start, endDate: end })
    }
  })

  it.each([null, undefined, {}, "custom", "allTime", "Today", "toString"])("rejects non-relative identifiers: %s", (value) => {
    expect(isDateRangePreset(value)).toBe(false)
  })
})