import { differenceInCalendarDays, format, isSameYear, isValid } from "date-fns"
import type { Locale } from "date-fns"

export function getDateRangeError(start?: Date, end?: Date, maxRangeDays?: number): string | null {
  if (!start || !end) return "Select both a start and end date."
  if (!isValid(start) || !isValid(end)) return "Select valid start and end dates."
  const days = differenceInCalendarDays(end, start) + 1
  if (days < 1) return "End date must be on or after start date."
  if (maxRangeDays !== undefined) {
    if (!Number.isInteger(maxRangeDays) || maxRangeDays < 1) {
      return "Date range limits are unavailable. Try again when the report is ready."
    }
    if (days > maxRangeDays) return `Select up to ${maxRangeDays} days.`
  }
  return null
}

export function formatDateRange(start: Date, end: Date, locale: Locale): string {
  const startFormat = isSameYear(start, end) ? "MMM d" : "MMM d, yyyy"
  return `${format(start, startFormat, { locale })} - ${format(end, "MMM d, yyyy", { locale })}`
}