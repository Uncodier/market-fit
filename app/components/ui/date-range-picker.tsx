"use client"

import * as React from "react"
import { CalendarIcon } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { cn } from "@/lib/utils"
import { useState, useEffect, useCallback, useRef } from "react"
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
  // Use refs to track if we're in the middle of an update to prevent loops
  const isUpdatingRef = useRef(false);
  const callbackRef = useRef(onRangeChange);
  
  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = onRangeChange;
  }, [onRangeChange]);
  
  // Validation function - moved outside of useEffect to prevent recreation
  const validateDates = useCallback((startDate: Date, endDate: Date) => {
    const now = new Date();
    
    let validStartDate = new Date(startDate);
    let validEndDate = new Date(endDate);
    
    // Check if dates are actually in the future (beyond today)
    if (validStartDate > now) {
      validStartDate = subMonths(now, 1);
    }
    
    if (validEndDate > now) {
      validEndDate = now;
    }
    
    // Ensure start date is not after end date
    if (validStartDate > validEndDate) {
      validStartDate = subMonths(validEndDate, 1);
    }
    
    // Final validation to ensure dates are reasonable (not more than 2 years in the past)
    const twoYearsAgo = subMonths(now, 24);
    if (validStartDate < twoYearsAgo) {
      validStartDate = twoYearsAgo;
    }
    
    return { validStartDate, validEndDate };
  }, []);
  
  // Validate initial dates once
  const { validStartDate: initialValidStartDate, validEndDate: initialValidEndDate } = React.useMemo(() => 
    validateDates(initialStartDate, initialEndDate), 
    [initialStartDate, initialEndDate, validateDates]
  );
  
  const [startDate, setStartDate] = useState<Date>(initialValidStartDate);
  const [endDate, setEndDate] = useState<Date>(initialValidEndDate);
  
  // Only sync with prop changes when they actually change and we're not updating
  useEffect(() => {
    if (isUpdatingRef.current) return;
    
    try {
      const { validStartDate: newValidStartDate, validEndDate: newValidEndDate } = validateDates(initialStartDate, initialEndDate);
      
      let needsUpdate = false;
      
      if (!isSameDay(newValidStartDate, startDate)) {
        setStartDate(newValidStartDate);
        needsUpdate = true;
      }
      
      if (!isSameDay(newValidEndDate, endDate)) {
        setEndDate(newValidEndDate);
        needsUpdate = true;
      }
      
      // Only call parent callback if we actually updated and there's a callback
      if (needsUpdate && callbackRef.current) {
        isUpdatingRef.current = true;
        callbackRef.current(newValidStartDate, newValidEndDate);
        
        // Reset the updating flag after a short delay
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 10);
      }
    } catch (error) {
      console.error("[DateRangePicker] Error updating dates:", error);
    }
  }, [initialStartDate, initialEndDate, validateDates]); // Remove startDate and endDate from dependencies
  
  // Handle date range selection with strict validation
  const handleRangeSelect = useCallback((start: Date, end: Date) => {
    if (isUpdatingRef.current) return;
    
    try {
      const { validStartDate, validEndDate } = validateDates(start, end);
      
      isUpdatingRef.current = true;
      
      setStartDate(validStartDate);
      setEndDate(validEndDate);
      
      if (callbackRef.current) {
        callbackRef.current(validStartDate, validEndDate);
      }
      
      // Reset the updating flag after a short delay
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 10);
    } catch (error) {
      console.error("[DateRangePicker] Error handling range selection:", error);
    }
  }, [validateDates]);

  // Format the range display - with additional validation for display
  const safeStartDate = startDate instanceof Date && isValid(startDate) ? startDate : new Date();
  const safeEndDate = endDate instanceof Date && isValid(endDate) ? endDate : new Date();
  const rangeDisplay = `${format(safeStartDate, "MMM d")} - ${format(safeEndDate, "MMM d")} ${format(safeEndDate, "yyyy")}`;

  return (
    <div className={cn("flex items-center", className)}>
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