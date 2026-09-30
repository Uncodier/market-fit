import {
  addDays, addMonths, addWeeks, endOfDay, endOfMonth, endOfWeek, endOfYear,
  isSameYear, startOfDay, startOfMonth, startOfQuarter, startOfWeek,
  startOfYear, subDays, subMonths, subYears,
} from "date-fns"
import type { Locale } from "date-fns"
import type { DateEvent, DatePickerMode } from "./date-picker-types"
import { getDateRangeError } from "./date-picker-range"

type Translate = (key: string) => string

export function getEventRange(event: DateEvent, locale: Locale, now = new Date()) {
  const start = startOfDay(event.value)
  let end = event.endDate
  if (!end) {
    switch (event.type) {
      case "day": end = endOfDay(start); break
      case "week": end = endOfWeek(start, { locale }); break
      case "month": end = endOfMonth(start); break
      case "year": end = isSameYear(start, now) ? now : endOfYear(start); break
      default: end = now
    }
  }
  return { start, end: endOfDay(end) }
}

export function boundDateEvents(events: DateEvent[], locale: Locale, maxRangeDays?: number): DateEvent[] {
  return events.map((event) => {
    if (event.disabled) return event
    const { start, end } = getEventRange(event, locale)
    const error = getDateRangeError(start, end, maxRangeDays)
    return error ? { ...event, disabled: true, disabledReason: error } : event
  })
}

export function getDefaultDateEvents(
  mode: DatePickerMode, t: Translate, locale: Locale, maxRangeDays?: number, now = new Date(),
): DateEvent[] {
  const today = startOfDay(now)
  const endToday = endOfDay(today)
  const weekOpts = { locale }
  const event = (
    id: string, value: Date, type: DateEvent['type'], period: DateEvent['period'], endDate?: Date,
  ): DateEvent => ({ id, label: t(`datePicker.${id}`), value, type, period, endDate })
  const common = [event("today", today, "day", "current", endToday)]
  const thisWeek = event("thisWeek", startOfWeek(today, weekOpts), "week", "current")
  const thisMonth = event("thisMonth", startOfMonth(today), "month", "current")
  const tomorrow = event("tomorrow", addDays(today, 1), "day", "future")

  if (mode === 'range' || mode === 'report') {
    const presets = [
      ...common,
      ...(mode === 'report' ? [event("yesterday", subDays(today, 1), "day", "past")] : []),
      event("last7Days", subDays(today, 6), "custom", "past", endToday),
      event("last30Days", subDays(today, 29), "custom", "past", endToday),
      { ...event("last90Days", subDays(today, 89), "custom", "past", endToday), label: "Last 90 days" },
      ...(mode === 'range' ? [{ ...thisWeek, endDate: endToday }] : []),
      { ...thisMonth, endDate: endToday },
      event("lastMonth", startOfMonth(subMonths(today, 1)), "month", "past"),
      event("thisQuarter", startOfQuarter(today), "custom", "current", endToday),
      event("yearToDate", startOfYear(today), "year", "current", endToday),
      ...(mode === 'range' ? [
        event("lastYear", startOfYear(subYears(today, 1)), "year", "past"),
        {
          ...event("allTime", today, "custom", "past", endToday),
          disabled: true,
          disabledReason: maxRangeDays !== undefined
            ? `All time is not available for this report. Select up to ${maxRangeDays} days.`
            : "All time is unavailable because the earliest available date is unknown. Select a custom range.",
        },
      ] : []),
    ]
    return boundDateEvents(presets, locale, maxRangeDays)
  }

  switch (mode) {
    case 'task': return [
      ...common, tomorrow,
      event("nextWeek", addWeeks(today, 1), "week", "future"),
      event("nextMonth", addMonths(today, 1), "month", "future"),
    ]
    case 'calendar': return [
      ...common, tomorrow, thisWeek,
      event("nextWeek", startOfWeek(addWeeks(today, 1), weekOpts), "week", "future"),
      thisMonth, event("nextMonth", startOfMonth(addMonths(today, 1)), "month", "future"),
    ]
    default: return [
      ...common, tomorrow, event("yesterday", subDays(today, 1), "day", "past"), thisWeek, thisMonth,
    ]
  }
}