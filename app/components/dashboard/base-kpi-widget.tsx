"use client";

import { ReactNode, useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { HelpCircle, CalendarIcon } from "@/app/components/ui/icons";
import { Skeleton } from "@/app/components/ui/skeleton";
import { DatePicker } from "@/app/components/ui/date-picker";
import { format } from "date-fns";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Badge } from "@/app/components/ui/badge";

export interface BaseKpiWidgetProps {
  title: string;
  tooltipText: string;
  value: string | number | null;
  changeText: string;
  isPositiveChange?: boolean;
  isLoading: boolean;
  showDatePicker?: boolean;
  startDate?: Date;
  endDate?: Date;
  onDateChange?: (start: Date, end: Date) => void;
  segmentBadge?: boolean;
  customStatus?: ReactNode;
  className?: string;
}

export function BaseKpiWidget({
  title,
  tooltipText,
  value,
  changeText,
  isPositiveChange,
  isLoading,
  showDatePicker = false,
  startDate,
  endDate,
  onDateChange,
  segmentBadge = false,
  customStatus,
  className
}: BaseKpiWidgetProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Handle date range selection
  const handleRangeSelect = (start: Date, end: Date) => {
    if (onDateChange) {
      onDateChange(start, end);
    }
    setIsDatePickerOpen(false);
  };

  return (
    <Card className={`${className} h-[116.5px]`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-3 pb-0">
        <CardTitle className="text-sm font-medium">
          {title}
          {segmentBadge && (
            <span className="ml-1 text-xs text-muted-foreground">(Segment)</span>
          )}
        </CardTitle>
        <div className="flex items-center space-x-2">
          {showDatePicker && startDate && endDate && (
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  <span>
                    {format(startDate, "MMM d")} - {format(endDate, "MMM d")} {format(endDate, "yyyy")}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-auto" align="center">
                <div className="flex flex-col p-2">
                  <div className="flex gap-2 items-center pb-2">
                    <Badge variant="outline" className="text-xs py-1">
                      {format(startDate, "MMM d")} {format(startDate, "yyyy")}
                    </Badge>
                    <span>to</span>
                    <Badge variant="outline" className="text-xs py-1">
                      {format(endDate, "MMM d")} {format(endDate, "yyyy")}
                    </Badge>
                  </div>
                  <DatePicker 
                    date={startDate}
                    setDate={() => {}}
                    className="w-full"
                    mode="report"
                    onRangeSelect={handleRangeSelect}
                    placeholder="Select date range"
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-3">
        {isLoading ? (
          <div className="flex flex-col">
            <div className="h-8 flex items-center pt-1">
              <Skeleton className="h-7 w-[120px]" />
            </div>
            <div className="h-[18px] flex items-center mt-1">
              <Skeleton className="h-4 w-[100px]" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="text-2xl font-bold pt-1 h-8 flex items-center">{value}</div>
            {customStatus || (
              <p className="text-xs text-muted-foreground mt-1 h-[18px] flex items-center">
                {isPositiveChange !== undefined && (
                  <span className={isPositiveChange ? "text-green-500" : "text-red-500"}>
                    {isPositiveChange ? '+' : ''}{changeText.split(' ')[0]}
                  </span>
                )}
                {" "}{changeText.split(' ').slice(1).join(' ')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 