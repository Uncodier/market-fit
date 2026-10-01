import {
  endOfDay, endOfMonth, endOfYear, startOfDay, startOfMonth,
  startOfQuarter, startOfWeek, startOfYear, subDays, subMonths, subYears,
  type Locale,
} from "date-fns"
import { enUS } from "date-fns/locale"

export const DATE_RANGE_PRESETS = [
  "today", "yesterday", "last7Days", "last30Days", "last90Days", "thisWeek",
  "thisMonth", "lastMonth", "thisQuarter", "yearToDate", "lastYear",
] as const

export type DateRangePreset = typeof DATE_RANGE_PRESETS[number]
export type DateRangeSelection = DateRangePreset | "custom"

export function isDateRangePreset(value: unknown): value is DateRangePreset {
  return typeof value === "string" && DATE_RANGE_PRESETS.some((preset) => preset === value)
}

/** Resolve relative selections using local calendar days, including DST boundaries. */
export function resolveDateRangePreset(
  preset: DateRangePreset, now = new Date(), locale: Locale = enUS,
): { startDate: Date; endDate: Date } {
  const today = startOfDay(now)
  let startDate = today
  let endDate = endOfDay(today)

  switch (preset) {
    case "today": break
    case "yesterday":
      startDate = subDays(today, 1)
      endDate = endOfDay(startDate)
      break
    case "last7Days": startDate = subDays(today, 6); break
    case "last30Days": startDate = subDays(today, 29); break
    case "last90Days": startDate = subDays(today, 89); break
    case "thisWeek": startDate = startOfWeek(today, { locale }); break
    case "thisMonth": startDate = startOfMonth(today); break
    case "lastMonth":
      startDate = startOfMonth(subMonths(today, 1))
      endDate = endOfMonth(startDate)
      break
    case "thisQuarter": startDate = startOfQuarter(today); break
    case "yearToDate": startDate = startOfYear(today); break
    case "lastYear":
      startDate = startOfYear(subYears(today, 1))
      endDate = endOfYear(startDate)
      break
  }

  return { startDate, endDate }
}