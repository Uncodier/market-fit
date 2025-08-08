"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, isSameDay, startOfMonth, subMonths, isSameMonth } from "date-fns"

interface UseDashboardDateRangeOptions {
  cancelAllRequests: () => void
}

export function useDashboardDateRange({ cancelAllRequests }: UseDashboardDateRangeOptions) {
  const today = useMemo(() => new Date(), [])
  const [selectedRangeType, setSelectedRangeType] = useState<string>("This month")
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>(() => ({
    startDate: subMonths(new Date(), 1),
    endDate: new Date(),
  }))
  const [isInitialized, setIsInitialized] = useState(false)

  const determineRangeType = useCallback((startDate: Date, endDate: Date) => {
    const monthStart = startOfMonth(new Date())
    if (isSameDay(startDate, today) && isSameDay(endDate, today)) {
      setSelectedRangeType("Today")
    } else if (
      isSameDay(startDate, monthStart) &&
      isSameMonth(startDate, today) &&
      isSameDay(endDate, today)
    ) {
      setSelectedRangeType("This month")
    } else {
      setSelectedRangeType("Custom range")
    }
  }, [today])

  const validateDates = useCallback((startDate: Date, endDate: Date) => {
    const now = new Date()
    try {
      let safeStartDate = subMonths(now, 1)
      let safeEndDate = now

      if (startDate instanceof Date && !isNaN(startDate.getTime())) {
        const twoYearsAgo = subMonths(now, 24)
        if (startDate <= now && startDate >= twoYearsAgo) {
          safeStartDate = startDate
        }
      }

      if (endDate instanceof Date && !isNaN(endDate.getTime())) {
        if (endDate <= now) {
          safeEndDate = endDate
        }
      }

      if (safeStartDate > safeEndDate) {
        safeStartDate = subMonths(safeEndDate, 1)
      }
      return { startDate: safeStartDate, endDate: safeEndDate }
    } catch (error) {
      const safeDefaults = { startDate: subMonths(now, 1), endDate: now }
      return safeDefaults
    }
  }, [])

  const handleDateRangeChange = useCallback((startDate: Date, endDate: Date) => {
    try {
      const validated = validateDates(startDate, endDate)
      if (
        isSameDay(validated.startDate, dateRange.startDate) &&
        isSameDay(validated.endDate, dateRange.endDate)
      ) {
        return
      }
      cancelAllRequests()
      setDateRange(validated)
      determineRangeType(validated.startDate, validated.endDate)
    } catch (error) {
      const now = new Date()
      setDateRange({ startDate: subMonths(now, 1), endDate: now })
    }
  }, [cancelAllRequests, dateRange, determineRangeType, validateDates])

  useEffect(() => {
    if (!isInitialized) {
      const now = new Date()
      const initial = validateDates(subMonths(now, 1), now)
      setDateRange(initial)
      determineRangeType(initial.startDate, initial.endDate)
      setIsInitialized(true)
    }
  }, [isInitialized, determineRangeType, validateDates])

  return { dateRange, selectedRangeType, handleDateRangeChange }
}

export default useDashboardDateRange


