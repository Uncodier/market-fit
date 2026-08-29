import { format, subMonths, isSameDay, isSameMonth, startOfMonth, endOfMonth } from "date-fns"

export function determineRangeType(startDate: Date, endDate: Date): string {
  const today = new Date()
  const monthStart = startOfMonth(today)

  if (isSameDay(startDate, today) && isSameDay(endDate, today)) {
    return "Today"
  }
  if (
    isSameDay(startDate, monthStart) &&
    isSameMonth(startDate, today) &&
    (isSameDay(endDate, today) || isSameDay(endDate, endOfMonth(today)))
  ) {
    return "This month"
  }
  return "Custom range"
}

export function validateDates(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
  const now = new Date()
  try {
    let safeStartDate = subMonths(now, 1)
    let safeEndDate = now

    if (startDate instanceof Date && !isNaN(startDate.getTime())) {
      const twoYearsAgo = subMonths(now, 24)
      if (startDate >= twoYearsAgo) {
        safeStartDate = startDate
      }
    }

    if (endDate instanceof Date && !isNaN(endDate.getTime())) {
      safeEndDate = endDate
    }

    if (safeStartDate > safeEndDate) {
      safeStartDate = subMonths(safeEndDate, 1)
    }

    return { startDate: safeStartDate, endDate: safeEndDate }
  } catch {
    return { startDate: subMonths(now, 1), endDate: now }
  }
}

export function formatRangeLabel(
  rangeType: string,
  t: (key: string) => string
): string {
  if (rangeType === "Today") return t("dashboard.range.today") || "Today"
  if (rangeType === "This month") return t("dashboard.range.thisMonth") || "This month"
  return t("dashboard.range.custom") || "Custom range"
}

export function dateRangeKey(startDate: Date, endDate: Date): string {
  return `${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}`
}
