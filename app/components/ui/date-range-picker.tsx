"use client"

import * as React from "react"
import { CalendarIcon } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { cn } from "@/lib/utils"
import { useState, useEffect, useCallback } from "react"
import { format, startOfMonth, isSameDay, isFuture, subMonths, isValid } from "date-fns"
import { DatePicker } from "@/app/components/ui/date-picker"

export interface DateRangePickerProps {
  className?: string;
  onRangeChange?: (startDate: Date, endDate: Date) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
}

export function CalendarDateRangePicker({
  className,
  onRangeChange,
  initialStartDate = startOfMonth(new Date()),
  initialEndDate = new Date(),
}: DateRangePickerProps) {
  // More robust date validation to ensure no future dates
  const validateDates = useCallback((startDate: Date, endDate: Date) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    try {
      // First ensure we have valid Date objects - if not, use safe defaults
      let validStartDate;
      let validEndDate;
      
      // Handle possible strings or timestamp inputs
      if (typeof startDate === 'string' || typeof startDate === 'number') {
        try {
          validStartDate = new Date(startDate);
          if (!isValid(validStartDate)) {
            console.error("[DateRangePicker] Invalid start date from string/number:", startDate);
            validStartDate = startOfMonth(now);
          }
        } catch (e) {
          console.error("[DateRangePicker] Error parsing start date:", e);
          validStartDate = startOfMonth(now);
        }
      } else {
        validStartDate = startDate instanceof Date && isValid(startDate) 
          ? new Date(startDate) // Create a new date object to avoid reference issues
          : startOfMonth(now);
      }
      
      if (typeof endDate === 'string' || typeof endDate === 'number') {
        try {
          validEndDate = new Date(endDate);
          if (!isValid(validEndDate)) {
            console.error("[DateRangePicker] Invalid end date from string/number:", endDate);
            validEndDate = now;
          }
        } catch (e) {
          console.error("[DateRangePicker] Error parsing end date:", e);
          validEndDate = now;
        }
      } else {
        validEndDate = endDate instanceof Date && isValid(endDate)
          ? new Date(endDate) // Create a new date object to avoid reference issues
          : now;
      }
      
      // Detect extreme future dates or incorrect years
      if (validStartDate.getFullYear() > currentYear) {
        console.error(`[DateRangePicker] Future year detected in start date: ${validStartDate.toISOString()} (year: ${validStartDate.getFullYear()}, current: ${currentYear})`);
        
        // Create a corrected date in the current year
        const fixedDate = new Date(validStartDate);
        fixedDate.setFullYear(currentYear);
        
        // If it's still in the future, use last year
        if (fixedDate > now) {
          fixedDate.setFullYear(currentYear - 1);
        }
        
        validStartDate = fixedDate;
        console.log(`[DateRangePicker] Corrected start date to: ${validStartDate.toISOString()}`);
      }
      
      if (validEndDate.getFullYear() > currentYear) {
        console.error(`[DateRangePicker] Future year detected in end date: ${validEndDate.toISOString()} (year: ${validEndDate.getFullYear()}, current: ${currentYear})`);
        
        // For end date, we'll just use today
        validEndDate = now;
        console.log(`[DateRangePicker] Corrected end date to today: ${validEndDate.toISOString()}`);
      }
      
      // Then validate against future dates
      if (isFuture(validStartDate)) {
        console.log(`[DateRangePicker] Start date is in the future (${format(validStartDate, 'yyyy-MM-dd')}), using current month start`);
        validStartDate = startOfMonth(now);
      }
      
      if (isFuture(validEndDate)) {
        console.log(`[DateRangePicker] End date is in the future (${format(validEndDate, 'yyyy-MM-dd')}), using today`);
        validEndDate = now;
      }
      
      // Final safety check for range validity
      if (validStartDate > validEndDate) {
        console.log(`[DateRangePicker] Invalid range (start after end), using default range`);
        validStartDate = startOfMonth(now);
        validEndDate = now;
      }
      
      return { validStartDate, validEndDate };
    } catch (error) {
      console.error("[DateRangePicker] Error in date validation:", error);
      // Return safe defaults if any error occurs
      return {
        validStartDate: startOfMonth(now),
        validEndDate: now
      };
    }
  }, []);
  
  // Validate on initial render
  const { validStartDate, validEndDate } = validateDates(initialStartDate, initialEndDate);
  const [startDate, setStartDate] = useState<Date>(validStartDate);
  const [endDate, setEndDate] = useState<Date>(validEndDate);
  
  // Sync with prop changes but validate them
  useEffect(() => {
    try {
      // Only update if values actually changed to avoid loops
      const { validStartDate: newValidStartDate, validEndDate: newValidEndDate } = validateDates(initialStartDate, initialEndDate);
      
      if (!isSameDay(newValidStartDate, startDate)) {
        console.log(`[DateRangePicker] Updating start date: ${format(newValidStartDate, 'yyyy-MM-dd')}`);
        setStartDate(newValidStartDate);
      }
      
      if (!isSameDay(newValidEndDate, endDate)) {
        console.log(`[DateRangePicker] Updating end date: ${format(newValidEndDate, 'yyyy-MM-dd')}`);
        setEndDate(newValidEndDate);
      }
    } catch (error) {
      console.error("[DateRangePicker] Error updating dates:", error);
      // Use safe fallbacks in case of error
      const now = new Date();
      setStartDate(startOfMonth(now));
      setEndDate(now);
    }
  }, [initialStartDate, initialEndDate, startDate, endDate, validateDates]);
  
  // Trigger parent callback with validated dates
  useEffect(() => {
    // Notify parent of initial values, but only if they're valid
    if (onRangeChange && startDate instanceof Date && endDate instanceof Date) {
      try {
        // Final validation before calling parent
        const { validStartDate, validEndDate } = validateDates(startDate, endDate);
        console.log(`[DateRangePicker] Notifying parent of date range: ${format(validStartDate, 'yyyy-MM-dd')} - ${format(validEndDate, 'yyyy-MM-dd')}`);
        onRangeChange(validStartDate, validEndDate);
      } catch (error) {
        console.error("[DateRangePicker] Error in date range callback:", error);
      }
    }
  }, [onRangeChange, startDate, endDate, validateDates]);
  
  // Handle date range selection with strict validation
  const handleRangeSelect = (start: Date, end: Date) => {
    try {
      const { validStartDate, validEndDate } = validateDates(start, end);
      
      console.log(`[DateRangePicker] User selected range: ${format(validStartDate, 'yyyy-MM-dd')} - ${format(validEndDate, 'yyyy-MM-dd')}`);
      
      setStartDate(validStartDate);
      setEndDate(validEndDate);
      
      if (onRangeChange) {
        onRangeChange(validStartDate, validEndDate);
      }
    } catch (error) {
      console.error("[DateRangePicker] Error handling range selection:", error);
      // Don't update state in case of errors
    }
  };

  // Format the range display - with additional validation for display
  const safeStartDate = startDate instanceof Date && isValid(startDate) ? startDate : new Date();
  const safeEndDate = endDate instanceof Date && isValid(endDate) ? endDate : new Date();
  const rangeDisplay = `${format(safeStartDate, "MMM d")} - ${format(safeEndDate, "MMM d")} ${format(safeEndDate, "yyyy")}`;

  return (
    <div className={cn("grid gap-2", className)}>
      <DatePicker
        date={startDate}
        setDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        className="w-full"
        mode="range"
        onRangeSelect={handleRangeSelect}
        rangeDisplay={rangeDisplay}
      />
    </div>
  )
} 