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
  initialStartDate,
  initialEndDate,
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
  
  // Initialize state - use placeholder dates if not provided (but won't trigger callback)
  const defaultStartDate = React.useMemo(() => startOfMonth(new Date()), []);
  const defaultEndDate = React.useMemo(() => new Date(), []);
  
  const initialValidDates = React.useMemo(() => {
    if (initialStartDate && initialEndDate) {
      return validateDates(initialStartDate, initialEndDate);
    }
    return { validStartDate: defaultStartDate, validEndDate: defaultEndDate };
  }, [initialStartDate, initialEndDate, validateDates, defaultStartDate, defaultEndDate]);
  
  const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate ? initialValidDates.validStartDate : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate ? initialValidDates.validEndDate : undefined);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Only sync with prop changes when they actually change and we're not updating
  useEffect(() => {
    if (isUpdatingRef.current) return;
    
    try {
      // Handle undefined dates - set state to undefined
      if (initialStartDate === undefined && initialEndDate === undefined) {
        if (startDate !== undefined || endDate !== undefined) {
          setStartDate(undefined);
          setEndDate(undefined);
        }
        setHasInitialized(true);
        return;
      }
      
      // Only validate and update if dates are provided
      if (initialStartDate && initialEndDate) {
        const { validStartDate: newValidStartDate, validEndDate: newValidEndDate } = validateDates(initialStartDate, initialEndDate);
        
        let needsUpdate = false;
        
        if (!startDate || !isSameDay(newValidStartDate, startDate)) {
          setStartDate(newValidStartDate);
          needsUpdate = true;
        }
        
        if (!endDate || !isSameDay(newValidEndDate, endDate)) {
          setEndDate(newValidEndDate);
          needsUpdate = true;
        }
        
        // Only call parent callback if we actually updated, there's a callback, and we've initialized
        if (needsUpdate && callbackRef.current && hasInitialized) {
          isUpdatingRef.current = true;
          callbackRef.current(newValidStartDate, newValidEndDate);
          
          // Reset the updating flag after a short delay
          setTimeout(() => {
            isUpdatingRef.current = false;
          }, 10);
        }
        
        if (!hasInitialized) {
          setHasInitialized(true);
        }
      }
    } catch (error) {
      console.error("[DateRangePicker] Error updating dates:", error);
    }
  }, [initialStartDate, initialEndDate, validateDates, startDate, endDate, hasInitialized]);
  
  // Handle date range selection with strict validation
  const handleRangeSelect = useCallback((start: Date, end: Date) => {
    if (isUpdatingRef.current) return;
    
    try {
      const { validStartDate, validEndDate } = validateDates(start, end);
      
      isUpdatingRef.current = true;
      
      setStartDate(validStartDate);
      setEndDate(validEndDate);
      setHasInitialized(true);
      
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

  // Format the range display - show placeholder if dates are not set
  const rangeDisplay = React.useMemo(() => {
    if (!startDate || !endDate) {
      return "Select date range";
    }
    const safeStartDate = startDate instanceof Date && isValid(startDate) ? startDate : undefined;
    const safeEndDate = endDate instanceof Date && isValid(endDate) ? endDate : undefined;
    if (!safeStartDate || !safeEndDate) {
      return "Select date range";
    }
    return `${format(safeStartDate, "MMM d")} - ${format(safeEndDate, "MMM d")} ${format(safeEndDate, "yyyy")}`;
  }, [startDate, endDate]);

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