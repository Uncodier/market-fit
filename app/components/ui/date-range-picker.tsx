"use client"

import * as React from "react"
import { Button } from "@/app/components/ui/button"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { format, subDays } from "date-fns"
import { DatePicker } from "@/app/components/ui/date-picker"

export interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  onRangeChange?: (startDate: Date, endDate: Date) => void;
}

export function CalendarDateRangePicker({
  className,
  onRangeChange,
}: DateRangePickerProps) {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());

  // Handle date range selection
  const handleRangeSelect = (start: Date, end: Date) => {
    if (onRangeChange) {
      onRangeChange(start, end);
    }
  };

  // Format the range display
  const rangeDisplay = `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;

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