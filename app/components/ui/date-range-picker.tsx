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
  // CRITICAL DEBUG: Log initial props
  console.log(`[DateRangePicker] CRITICAL DEBUG - Component initialized with:`);
  console.log(`[DateRangePicker] - initialStartDate: ${initialStartDate.toISOString()}`);
  console.log(`[DateRangePicker] - initialEndDate: ${initialEndDate.toISOString()}`);
  console.log(`[DateRangePicker] - initialStartDate year: ${initialStartDate.getFullYear()}`);
  console.log(`[DateRangePicker] - initialEndDate year: ${initialEndDate.getFullYear()}`);
  console.log(`[DateRangePicker] - current year: ${new Date().getFullYear()}`);
  
  // More robust date validation to ensure no future dates
  const validateDates = useCallback((startDate: Date, endDate: Date) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    
    console.log(`[DateRangePicker] CRITICAL DEBUG - validateDates input:`);
    console.log(`[DateRangePicker] - startDate: ${startDate.toISOString()}`);
    console.log(`[DateRangePicker] - endDate: ${endDate.toISOString()}`);
    console.log(`[DateRangePicker] - startDate year: ${startDate.getFullYear()}`);
    console.log(`[DateRangePicker] - endDate year: ${endDate.getFullYear()}`);
    console.log(`[DateRangePicker] - current year: ${currentYear}`);
    console.log(`[DateRangePicker] - current date: ${now.toISOString()}`);
    
    let validStartDate = new Date(startDate);
    let validEndDate = new Date(endDate);
    
    // Check if dates are actually in the future (beyond today)
    if (validStartDate > now) {
      console.warn(`[DateRangePicker] Start date is in the future: ${validStartDate.toISOString()}, using one month ago`);
      validStartDate = subMonths(now, 1);
    }
    
    if (validEndDate > now) {
      console.warn(`[DateRangePicker] End date is in the future: ${validEndDate.toISOString()}, using today`);
      validEndDate = now;
    }
    
    // Ensure start date is not after end date
    if (validStartDate > validEndDate) {
      console.warn(`[DateRangePicker] Start date is after end date, adjusting start date`);
      validStartDate = subMonths(validEndDate, 1);
    }
    
    // Final validation to ensure dates are reasonable (not more than 2 years in the past)
    const twoYearsAgo = subMonths(now, 24);
    if (validStartDate < twoYearsAgo) {
      console.warn(`[DateRangePicker] Start date is too far in the past: ${validStartDate.toISOString()}, using two years ago`);
      validStartDate = twoYearsAgo;
    }
    
    console.log(`[DateRangePicker] CRITICAL DEBUG - validateDates output:`);
    console.log(`[DateRangePicker] - validStartDate: ${validStartDate.toISOString()}`);
    console.log(`[DateRangePicker] - validEndDate: ${validEndDate.toISOString()}`);
    console.log(`[DateRangePicker] - validStartDate year: ${validStartDate.getFullYear()}`);
    console.log(`[DateRangePicker] - validEndDate year: ${validEndDate.getFullYear()}`);
    
    return { validStartDate, validEndDate };
  }, []);
  
  // Validate on initial render
  const { validStartDate, validEndDate } = validateDates(initialStartDate, initialEndDate);
  
  // CRITICAL DEBUG: Log validated initial dates
  console.log(`[DateRangePicker] CRITICAL DEBUG - After initial validation:`);
  console.log(`[DateRangePicker] - validStartDate: ${validStartDate.toISOString()}`);
  console.log(`[DateRangePicker] - validEndDate: ${validEndDate.toISOString()}`);
  
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
      setStartDate(subMonths(now, 1));
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
        
        // CRITICAL DEBUG: Log before calling parent callback
        console.log(`[DateRangePicker] CRITICAL DEBUG - About to call parent callback:`);
        console.log(`[DateRangePicker] - validStartDate: ${validStartDate.toISOString()}`);
        console.log(`[DateRangePicker] - validEndDate: ${validEndDate.toISOString()}`);
        console.log(`[DateRangePicker] - validStartDate year: ${validStartDate.getFullYear()}`);
        console.log(`[DateRangePicker] - validEndDate year: ${validEndDate.getFullYear()}`);
        
        // Check if we're about to send future dates
        const now = new Date();
        if (validStartDate > now || validEndDate > now) {
          console.error(`[DateRangePicker] CRITICAL ERROR - About to send future dates to parent!`);
          console.error(`[DateRangePicker] - validStartDate > now: ${validStartDate > now}`);
          console.error(`[DateRangePicker] - validEndDate > now: ${validEndDate > now}`);
          console.error(`[DateRangePicker] - Stack trace:`, new Error().stack);
          
          // Don't send future dates to parent
          return;
        }
        
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
      // CRITICAL DEBUG: Log incoming range selection
      console.log(`[DateRangePicker] CRITICAL DEBUG - handleRangeSelect called with:`);
      console.log(`[DateRangePicker] - start: ${start.toISOString()}`);
      console.log(`[DateRangePicker] - end: ${end.toISOString()}`);
      console.log(`[DateRangePicker] - start year: ${start.getFullYear()}`);
      console.log(`[DateRangePicker] - end year: ${end.getFullYear()}`);
      
      const { validStartDate, validEndDate } = validateDates(start, end);
      
      console.log(`[DateRangePicker] User selected range: ${format(validStartDate, 'yyyy-MM-dd')} - ${format(validEndDate, 'yyyy-MM-dd')}`);
      
      setStartDate(validStartDate);
      setEndDate(validEndDate);
      
      if (onRangeChange) {
        // CRITICAL DEBUG: Log before calling parent in handleRangeSelect
        console.log(`[DateRangePicker] CRITICAL DEBUG - handleRangeSelect about to call parent:`);
        console.log(`[DateRangePicker] - validStartDate: ${validStartDate.toISOString()}`);
        console.log(`[DateRangePicker] - validEndDate: ${validEndDate.toISOString()}`);
        
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