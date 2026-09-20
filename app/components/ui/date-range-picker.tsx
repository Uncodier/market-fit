"use client"

import * as React from "react"
import { CalendarIcon } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { cn } from "@/lib/utils"
import { useState, useEffect, useCallback } from "react"
import { format, startOfMonth, startOfDay, endOfDay, isSameDay, subMonths, isValid } from "date-fns"
import { DatePicker } from "@/app/components/ui/date-picker"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getDateFnsLocale } from "@/app/lib/date-fns-locale"

export interface DateRangePickerProps {
  className?: string;
  onRangeChange?: (startDate: Date, endDate: Date) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
}

export function CalendarDateRangePicker({
  className,
  onRangeChange,
  initialStartDate,
  initialEndDate,
}: DateRangePickerProps) {
  const { t, locale } = useLocalization()
  const dateLocale = getDateFnsLocale(locale)
  
  // Validation function - moved outside of useEffect to prevent recreation
  const validateDates = useCallback((startDate: Date, endDate: Date) => {
    const now = new Date();

    let validStartDate = startOfDay(startDate);
    let validEndDate = endOfDay(endDate);

    if (validStartDate > validEndDate) {
      validStartDate = startOfDay(subMonths(validEndDate, 1));
    }

    const twoYearsAgo = startOfDay(subMonths(now, 24));
    if (validStartDate < twoYearsAgo) {
      validStartDate = twoYearsAgo;
    }

    return { validStartDate, validEndDate };
  }, []);
  
  // Initialize state - use placeholder dates if not provided (but won't trigger callback)
  const defaultStartDate = React.useMemo(() => startOfMonth(new Date()), []);
  const defaultEndDate = React.useMemo(() => endOfDay(new Date()), []);
  
  const initialValidDates = React.useMemo(() => {
    if (initialStartDate && initialEndDate) {
      return validateDates(initialStartDate, initialEndDate);
    }
    return { validStartDate: defaultStartDate, validEndDate: defaultEndDate };
  }, [initialStartDate, initialEndDate, validateDates, defaultStartDate, defaultEndDate]);
  
  const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate ? initialValidDates.validStartDate : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate ? initialValidDates.validEndDate : undefined);
  
  // Keep the picker controlled by the range owned by its parent.
  useEffect(() => {
    try {
      if (initialStartDate === undefined && initialEndDate === undefined) {
        setStartDate(undefined);
        setEndDate(undefined);
        return;
      }
      
      if (initialStartDate && initialEndDate) {
        const { validStartDate: newValidStartDate, validEndDate: newValidEndDate } = validateDates(initialStartDate, initialEndDate);
        setStartDate((current) =>
          current && isSameDay(current, newValidStartDate)
            ? current
            : newValidStartDate,
        );
        setEndDate((current) =>
          current && isSameDay(current, newValidEndDate)
            ? current
            : newValidEndDate,
        );
      }
    } catch (error) {
      console.error("[DateRangePicker] Error updating dates:", error);
    }
  }, [initialStartDate, initialEndDate, validateDates]);
  
  // Handle date range selection with strict validation
  const handleRangeSelect = useCallback((start: Date, end: Date) => {
    try {
      const { validStartDate, validEndDate } = validateDates(start, end);
      setStartDate(validStartDate);
      setEndDate(validEndDate);
      
      onRangeChange?.(validStartDate, validEndDate);
    } catch (error) {
      console.error("[DateRangePicker] Error handling range selection:", error);
    }
  }, [onRangeChange, validateDates]);

  // Format the range display - show placeholder if dates are not set
  const rangeDisplay = React.useMemo(() => {
    if (!startDate || !endDate) {
      return t("datePicker.selectDateRange")
    }
    const safeStartDate = startDate instanceof Date && isValid(startDate) ? startDate : undefined
    const safeEndDate = endDate instanceof Date && isValid(endDate) ? endDate : undefined
    if (!safeStartDate || !safeEndDate) {
      return t("datePicker.selectDateRange")
    }
    return `${format(safeStartDate, "MMM d", { locale: dateLocale })} - ${format(safeEndDate, "MMM d", { locale: dateLocale })} ${format(safeEndDate, "yyyy")}`
  }, [startDate, endDate, t, dateLocale])

  // Use placeholder dates for DatePicker when dates are undefined
  // These are only for display - callbacks only fire through handleRangeSelect (user interaction)
  const displayStartDate = startDate || defaultStartDate;
  const displayEndDate = endDate || defaultEndDate;

  return (
    <div className={cn("flex items-center", className)}>
      <DatePicker
        date={displayStartDate}
        setDate={(date) => {
          // Don't update state or call callback here - let handleRangeSelect handle it
          // This is only called for single date mode, not range mode
        }}
        endDate={displayEndDate}
        setEndDate={(date) => {
          // Don't update state or call callback here - let handleRangeSelect handle it
          // This is only called for single date mode, not range mode
        }}
        className="w-full"
        mode="range"
        onRangeSelect={handleRangeSelect}
        rangeDisplay={rangeDisplay}
      />
    </div>
  )
} 