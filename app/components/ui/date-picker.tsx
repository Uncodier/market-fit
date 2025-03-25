"use client"

import * as React from "react"
import { CalendarIcon, ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, startOfDay, endOfDay, startOfWeek as dateStartOfWeek, endOfWeek as dateEndOfWeek, startOfMonth as dateStartOfMonth, endOfMonth as dateEndOfMonth, startOfYear, endOfYear, isSameYear } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { cn } from "@/lib/utils"

export type DateEventType = 'day' | 'week' | 'month' | 'year' | 'custom';
export type DateEventPeriod = 'past' | 'future' | 'current';
export type DatePickerMode = 'default' | 'task' | 'report' | 'calendar';

export interface DateEvent {
  label: string;
  value: Date;
  type: DateEventType;
  period: DateEventPeriod;
}

export interface DatePickerProps {
  date: Date;
  setDate: (date: Date) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showEvents?: boolean;
  events?: DateEvent[];
  customEvents?: boolean;
  position?: "top" | "bottom" | "left" | "right";
  onRangeSelect?: (start: Date, end: Date) => void;
  mode?: DatePickerMode;
}

export function DatePicker({
  date,
  setDate,
  className,
  placeholder = "Select date",
  disabled = false,
  showEvents = true,
  events,
  customEvents = false,
  position = "bottom",
  onRangeSelect,
  mode = 'default',
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [open, setOpen] = React.useState(false)
  
  // Generate mode-specific default events with shorter labels
  const getDefaultEvents = (): DateEvent[] => {
    const now = new Date();
    const today = startOfDay(now);
    
    // Common events used across multiple modes
    const commonEvents: DateEvent[] = [
      { label: "Today", value: today, type: "day", period: "current" },
    ];
    
    switch (mode) {
      case 'task':
        return [
          ...commonEvents,
          { label: "Tomorrow", value: addDays(today, 1), type: "day", period: "future" },
          { label: "Next week", value: addWeeks(today, 1), type: "week", period: "future" },
          { label: "Next month", value: addMonths(today, 1), type: "month", period: "future" },
        ];
      
      case 'report':
        return [
          ...commonEvents,
          { label: "Yesterday", value: subDays(today, 1), type: "day", period: "past" },
          { label: "Last 7 days", value: subDays(today, 7), type: "day", period: "past" },
          { label: "Last 30 days", value: subDays(today, 30), type: "day", period: "past" },
          { label: "This month", value: dateStartOfMonth(today), type: "month", period: "current" },
          { label: "Last month", value: startOfMonth(subMonths(today, 1)), type: "month", period: "past" },
          { label: "Year to date", value: startOfYear(today), type: "year", period: "current" },
        ];
      
      case 'calendar':
        return [
          ...commonEvents,
          { label: "Tomorrow", value: addDays(today, 1), type: "day", period: "future" },
          { label: "This week", value: dateStartOfWeek(today), type: "week", period: "current" },
          { label: "Next week", value: startOfWeek(addWeeks(today, 1)), type: "week", period: "future" },
          { label: "This month", value: dateStartOfMonth(today), type: "month", period: "current" },
          { label: "Next month", value: startOfMonth(addMonths(today, 1)), type: "month", period: "future" },
        ];
      
      default:
        return [
          ...commonEvents,
          { label: "Tomorrow", value: addDays(today, 1), type: "day", period: "future" },
          { label: "Yesterday", value: subDays(today, 1), type: "day", period: "past" },
          { label: "This week", value: dateStartOfWeek(today), type: "week", period: "current" },
          { label: "This month", value: dateStartOfMonth(today), type: "month", period: "current" },
        ];
    }
  };
  
  // Use provided events or mode-specific default events
  const displayEvents = events || getDefaultEvents();
  
  // Function to generate calendar days
  const generateCalendarDays = () => {
    // Get the first day of the month
    const monthStart = startOfMonth(currentMonth)
    // Get the last day of the month
    const monthEnd = endOfMonth(monthStart)
    // Get the first day of the first week
    const startDate = startOfWeek(monthStart)
    // Get the last day of the last week
    const endDate = endOfWeek(monthEnd)
    
    // Get all days in the interval
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    
    return days
  }
  
  const days = generateCalendarDays()
  
  // Function to go to the previous month
  const prevMonth = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }
  
  // Function to go to the next month
  const nextMonth = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }
  
  // Select date and close popover
  const selectDate = (selectedDate: Date, e?: React.MouseEvent, eventType?: DateEventType) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    setDate(selectedDate)
    
    // If range selection is enabled and event type is provided
    if (onRangeSelect && eventType) {
      let endDate: Date;
      const today = new Date();
      
      switch (eventType) {
        case 'day':
          endDate = endOfDay(selectedDate);
          break;
        case 'week':
          endDate = endOfDay(dateEndOfWeek(selectedDate));
          break;
        case 'month':
          endDate = endOfDay(dateEndOfMonth(selectedDate));
          break;
        case 'year':
          endDate = isSameYear(selectedDate, today) 
            ? endOfDay(today) 
            : endOfYear(selectedDate);
          break;
        default:
          endDate = selectedDate;
      }
      
      onRangeSelect(startOfDay(selectedDate), endDate);
    }
    
    setOpen(false)
  }
  
  // Get the event group title based on mode
  const getEventGroupTitle = (): string => {
    switch (mode) {
      case 'task':
        return "Schedule For";
      case 'report':
        return "Date Ranges";
      case 'calendar':
        return "Jump To";
      default:
        return "Quick Select";
    }
  };
  
  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-12 text-left font-normal w-full",
              "px-4 py-3 flex items-center justify-between",
              "rounded-md border border-input bg-background ring-offset-background",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              !date && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          >
            <div className="flex items-center flex-1 min-w-0">
              <CalendarIcon className="mr-3 h-5 w-5 flex-shrink-0" />
              <span className="truncate">{date ? format(date, "PPP") : placeholder}</span>
            </div>
            <div className="opacity-50 ml-2 flex-shrink-0">
              <ChevronLeft className="h-4 w-4 rotate-90" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <div className="flex flex-row">
            {/* Calendar */}
            <div className="p-4 min-w-[280px]">
              <div className="flex justify-between items-center mb-3">
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  onClick={prevMonth}
                  type="button"
                >
                  <span className="sr-only">Previous month</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium text-base">
                  {format(currentMonth, "MMMM yyyy")}
                </span>
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  onClick={nextMonth}
                  type="button"
                >
                  <span className="sr-only">Next month</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div key={day} className="text-center text-xs text-muted-foreground py-1">
                    {day}
                  </div>
                ))}
                {days.map((day, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    className={cn(
                      "h-8 w-8 p-0 text-sm",
                      !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-50",
                      isSameDay(day, date) && "bg-primary text-primary-foreground",
                      isSameDay(day, new Date()) && !isSameDay(day, date) && "border border-primary"
                    )}
                    onClick={(e) => selectDate(day, e, "day")}
                    type="button"
                  >
                    {format(day, "d")}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Events Sidebar */}
            {showEvents && displayEvents.length > 0 && (
              <div className="border-l p-3 w-[160px] flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                <div className="text-xs font-medium text-muted-foreground mb-1">{getEventGroupTitle()}</div>
                {displayEvents.map((event, index) => (
                  <Button 
                    key={index}
                    size="sm"
                    variant={event.period === "current" ? 
                            (isSameDay(event.value, date) ? "default" : "outline") : 
                            event.period === "past" ? "outline" : "secondary"}
                    className="w-full text-xs justify-start py-1 px-2.5 h-auto min-h-[32px] whitespace-normal text-left"
                    onClick={(e) => selectDate(event.value, e, event.type)}
                    type="button"
                  >
                    {event.label}
                  </Button>
                ))}
                
                {customEvents && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Custom Range</div>
                    {/* Aquí se puede agregar el UI para rangos personalizados */}
                  </div>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
} 