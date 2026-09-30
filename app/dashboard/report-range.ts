import { differenceInCalendarDays, endOfDay, isValid, startOfDay, subDays } from "date-fns"

export function defaultReportRange(now = new Date()) {
  return { startDate: startOfDay(subDays(now, 29)), endDate: endOfDay(now) }
}

export function reportRangeError(start: Date, end: Date, maxRangeDays?: number): string | null {
  if (!isValid(start) || !isValid(end) || start > end) return "Select a valid date range."
  const days = differenceInCalendarDays(end, start) + 1
  return maxRangeDays !== undefined && days > maxRangeDays
    ? `This section supports up to ${maxRangeDays} days at a time. Choose a shorter range.` : null
}