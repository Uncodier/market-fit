"use client"

import * as React from "react"
import { CalendarIcon, ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, startOfDay, endOfDay, startOfWeek as dateStartOfWeek, endOfWeek as dateEndOfWeek, startOfMonth as dateStartOfMonth, endOfMonth as dateEndOfMonth, startOfYear, endOfYear, isSameYear, subYears } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { cn } from "@/lib/utils"
import { Badge } from "@/app/components/ui/badge"
import { Calendar } from "@/app/components/ui/calendar"
import { useMemo } from "react"

export type DateEventType = 'day' | 'week' | 'month' | 'year' | 'custom';
export type DateEventPeriod = 'past' | 'future' | 'current';
export type DatePickerMode = 'default' | 'task' | 'report' | 'calendar' | 'range';

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
  endDate?: Date;
  setEndDate?: (date: Date) => void;
  rangeDisplay?: string;
  showTimePicker?: boolean;
  timeFormat?: '12h' | '24h';
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
  endDate,
  setEndDate,
  rangeDisplay,
  showTimePicker = false,
  timeFormat = '24h'
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date(date))
  const [open, setOpen] = React.useState(false)
  const [isSelectingEndDate, setIsSelectingEndDate] = React.useState(false)
  const [selectedPresetLabel, setSelectedPresetLabel] = React.useState<string | null>(null)
  const [isNavigating, setIsNavigating] = React.useState(false)
  const [forceUpdate, setForceUpdate] = React.useState(0)
  const [selectedTime, setSelectedTime] = React.useState({
    hours: date.getHours(),
    minutes: date.getMinutes()
  })
  
  // Update currentMonth when date changes - prevent loops with useRef
  const lastProcessedDateRef = React.useRef<Date | null>(null);
  
  React.useEffect(() => {
    // Only update if date actually changed and is different from last processed
    if (!lastProcessedDateRef.current || !isSameDay(lastProcessedDateRef.current, date)) {
      if (!isSameMonth(currentMonth, date)) {
        setCurrentMonth(new Date(date));
      }
      lastProcessedDateRef.current = new Date(date);
    }
  }, [date, currentMonth]);

  // Update selected time when date changes from outside
  React.useEffect(() => {
    setSelectedTime({
      hours: date.getHours(),
      minutes: date.getMinutes()
    });
  }, [date]);
  
  // Simplified force update without logging
  React.useEffect(() => {
    setForceUpdate(prev => prev + 1)
  }, [currentMonth])
  
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
          { label: "Year to date", value: (() => {
            // Use startOfYear but explicitly with the current year to avoid any issues
            const currentYear = today.getFullYear();
            return new Date(currentYear, 0, 1); // January 1st of current year
          })(), type: "year", period: "current" },
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

      case 'range':
        return [
          { label: "Today", value: today, type: "day", period: "current" },
          { label: "This week", value: dateStartOfWeek(today), type: "week", period: "current" },
          { label: "This month", value: dateStartOfMonth(today), type: "month", period: "current" },
          { label: "Last month", value: startOfMonth(subMonths(today, 1)), type: "month", period: "past" },
          { label: "This quarter", value: (() => {
            // Calculate current quarter's start date safely
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            const currentQuarter = Math.floor(currentMonth / 3);
            // First month of the current quarter (0, 3, 6, or 9)
            const quarterStartMonth = currentQuarter * 3;
            // Return first day of the quarter
            return new Date(currentYear, quarterStartMonth, 1);
          })(), type: "month", period: "current" },
          { label: "Year to date", value: (() => {
            // Use startOfYear but explicitly with the current year to avoid any issues
            const currentYear = today.getFullYear();
            return new Date(currentYear, 0, 1); // January 1st of current year
          })(), type: "year", period: "current" },
          { label: "Last year", value: (() => {
            // Use startOfYear but explicitly with last year to avoid any issues
            const lastYear = today.getFullYear() - 1;
            return new Date(lastYear, 0, 1); // January 1st of last year
          })(), type: "year", period: "past" },
          { label: "All time", value: new Date(2000, 0, 1), type: "custom", period: "past" },
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
  
  // Use useMemo to force re-calculation when currentMonth changes
  const days = React.useMemo(() => {
    // Get the first day of the month
    const monthStart = startOfMonth(currentMonth)
    // Get the last day of the month
    const monthEnd = endOfMonth(monthStart)
    // Get the first day of the first week
    const startDate = startOfWeek(monthStart)
    // Get the last day of the last week
    const endDate = endOfWeek(monthEnd)
    
    // Get all days in the interval
    const calculatedDays = eachDayOfInterval({ start: startDate, end: endDate })
    
    return calculatedDays
  }, [currentMonth, forceUpdate])
  
  // Function to go to the previous month
  const prevMonth = React.useCallback((e: React.MouseEvent) => {
    if (isNavigating) return
    
    e.preventDefault()
    e.stopPropagation()
    
    setIsNavigating(true)
    
    // Create a new date for previous month
    const currentYear = currentMonth.getFullYear()
    const currentMonthNumber = currentMonth.getMonth()
    
    let newYear = currentYear
    let newMonth = currentMonthNumber - 1
    
    if (newMonth < 0) {
      newMonth = 11
      newYear = currentYear - 1
    }
    
    const newDate = new Date(newYear, newMonth, 1)
    
    // Force update the state
    setCurrentMonth(newDate)
    setForceUpdate(prev => prev + 1)
    
    // Reset navigation state after a short delay
    setTimeout(() => setIsNavigating(false), 100)
  }, [currentMonth, isNavigating])
  
  // Function to go to the next month
  const nextMonth = React.useCallback((e: React.MouseEvent) => {
    if (isNavigating) return
    
    e.preventDefault()
    e.stopPropagation()
    
    setIsNavigating(true)
    
    // Create a new date for next month
    const currentYear = currentMonth.getFullYear()
    const currentMonthNumber = currentMonth.getMonth()
    
    let newYear = currentYear
    let newMonth = currentMonthNumber + 1
    
    if (newMonth > 11) {
      newMonth = 0
      newYear = currentYear + 1
    }
    
    const newDate = new Date(newYear, newMonth, 1)
    
    // Force update the state
    setCurrentMonth(newDate)
    setForceUpdate(prev => prev + 1)
    
    // Reset navigation state after a short delay
    setTimeout(() => setIsNavigating(false), 100)
  }, [currentMonth, isNavigating])
  
  // Add keyboard navigation support
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prevMonth(e as any)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextMonth(e as any)
    }
  }, [prevMonth, nextMonth])
  
  // Time picker helper functions
  const formatDisplayTime = (hours: number, minutes: number): string => {
    if (timeFormat === '12h') {
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } else {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  };

  const handleTimeChange = (hours: number, minutes: number) => {
    setSelectedTime({ hours, minutes });
    
    // Create new date with updated time
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    setDate(newDate);
  };

  const handleHourChange = (value: string) => {
    const hours = parseInt(value);
    if (!isNaN(hours)) {
      handleTimeChange(hours, selectedTime.minutes);
    }
  };

  const handleMinuteChange = (value: string) => {
    const minutes = parseInt(value);
    if (!isNaN(minutes)) {
      handleTimeChange(selectedTime.hours, minutes);
    }
  };

  const handleAMPMToggle = () => {
    const newHours = selectedTime.hours >= 12 ? selectedTime.hours - 12 : selectedTime.hours + 12;
    handleTimeChange(newHours, selectedTime.minutes);
  };

  // Update display text to include time if time picker is enabled
  const getDisplayText = (): string => {
    if (mode === 'range' && endDate && rangeDisplay) {
      return rangeDisplay;
    } else if (date) {
      const dateStr = format(date, "PPP");
      if (showTimePicker) {
        const timeStr = formatDisplayTime(selectedTime.hours, selectedTime.minutes);
        return `${dateStr} at ${timeStr}`;
      }
      return dateStr;
    }
    return placeholder;
  };
  
  // Select date and close popover
  const selectDate = (selectedDate: Date, e?: React.MouseEvent, eventType?: DateEventType) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (mode === 'range' && setEndDate) {
      if (!isSelectingEndDate) {
        // Selecting start date
        setDate(selectedDate);
        if (endDate && selectedDate > endDate) {
          setEndDate(selectedDate);
        }
        setIsSelectingEndDate(true);
        return;
      } else {
        // Selecting end date
        let start = date;
        let end = selectedDate;
        
        if (selectedDate < date) {
          // If selected end date is before start date, swap them
          start = selectedDate;
          end = date;
          setDate(start);
          setEndDate(end);
        } else {
          setEndDate(end);
        }
        
        setIsSelectingEndDate(false);
        
        if (onRangeSelect) {
          // Notificar solo si hay cambios reales
          if (!endDate || !isSameDay(end, endDate) || !isSameDay(start, date)) {
            onRangeSelect(start, end);
          }
        }
        
        setOpen(false);
        return;
      }
    }
    
    // Si no es modo rango, simplemente actualizar la fecha
    if (!isSameDay(date, selectedDate)) {
      setDate(selectedDate);
    }
    
    // Si hay callback de selección de rango y se especificó tipo de evento
    if (onRangeSelect && eventType) {
      let end: Date;
      const today = new Date();
      
      switch (eventType) {
        case 'day':
          end = endOfDay(selectedDate);
          break;
        case 'week':
          end = endOfDay(dateEndOfWeek(selectedDate));
          break;
        case 'month':
          end = endOfDay(dateEndOfMonth(selectedDate));
          break;
        case 'year':
          end = isSameYear(selectedDate, today) 
            ? endOfDay(today) 
            : endOfYear(selectedDate);
          break;
        default:
          end = selectedDate;
      }
      
      if (setEndDate) {
        setEndDate(end);
      }
      
      // Notificar solo si hay cambios reales
      if (!endDate || !isSameDay(end, endDate) || !isSameDay(selectedDate, date)) {
        onRangeSelect(startOfDay(selectedDate), end);
      }
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
      case 'range':
        return "Preset Ranges";
      default:
        return "Quick Select";
    }
  };

  // Check if a day is within the selected range
  const isDayInRange = (day: Date): boolean => {
    if (mode !== 'range' || !endDate) return false;
    return day >= date && day <= endDate;
  };
  
  // Format the range display
  const displayText = getDisplayText();
  
  // Function to handle preset selection
  const handlePresetSelection = (event: DateEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    // Ensure the start date is not in the future
    let start = new Date(event.value);
    if (start > today) {
      console.warn(`[DatePicker] Preset start date ${format(start, 'yyyy-MM-dd')} is in the future, using safe fallback`);
      
      // Different fallbacks based on event type
      switch (event.type) {
        case 'day':
          start = startOfDay(today);
          break;
        case 'week':
          start = startOfWeek(today);
          break;
        case 'month':
          start = startOfMonth(today);
          break;
        case 'year':
          start = startOfYear(today);
          break;
        default:
          start = startOfDay(today);
      }
    }
    
    // Extra safety check for "This quarter" preset, which has caused issues
    if (event.label === "This quarter" && start > today) {
      console.warn(`[DatePicker] Quarter start date still in future after initial check: ${format(start, 'yyyy-MM-dd')}`);
      
      // Calculate current quarter as fallback
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const currentQuarter = Math.floor(currentMonth / 3);
      const quarterStartMonth = currentQuarter * 3;
      
      // Use first day of current quarter
      start = new Date(currentYear, quarterStartMonth, 1);
      console.log(`[DatePicker] Using current quarter start: ${format(start, 'yyyy-MM-dd')}`);
    }
    
    let end: Date;
    
    switch (event.type) {
      case 'day':
        end = endOfDay(start);
        break;
      case 'week':
        end = endOfDay(dateEndOfWeek(start));
        // Cap end date at today if it's in the future
        if (end > today) {
          end = today;
        }
        break;
      case 'month':
        end = endOfDay(dateEndOfMonth(start));
        // Cap end date at today if it's in the future
        if (end > today) {
          end = today;
        }
        break;
      case 'year':
        end = isSameYear(start, today) 
          ? endOfDay(today) 
          : endOfDay(endOfYear(start));
        // Cap end date at today if it's in the future
        if (end > today) {
          end = today;
        }
        break;
      default:
        end = today;
    }
    
    // Set the start date
    setDate(start);
    
    // Save which preset was selected
    setSelectedPresetLabel(event.label);
    
    // If range mode, set the end date
    if (mode === 'range' && setEndDate) {
      setEndDate(end);
      
      // Trigger range selection callback immediately
      if (onRangeSelect) {
        // Notificar solo si hay cambios reales
        if (!isSameDay(start, date) || !endDate || !isSameDay(end, endDate)) {
          onRangeSelect(start, end);
        }
      }
      
      // Close the popover immediately for range presets
      setOpen(false);
    } else {
      // Normal date selection
      selectDate(start, e, event.type);
    }
  };
  
  // Add a function to disable future dates based on mode
  const shouldDisableDate = (date: Date) => {
    // Only disable future dates for report mode and similar analytical modes
    if (mode === 'report' || mode === 'range') {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      return date > today;
    }
    
    // For task mode and others, allow future dates
    return false;
  };

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 text-left font-normal w-full",
              "px-3 py-1 flex items-start justify-between",
              "rounded-md border border-input bg-background",
              "focus:outline-none focus-visible:outline-none focus-visible:ring-0",
              "hover:bg-muted hover:border-input hover:no-underline transition-colors duration-200",
              !date && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          >
            <div className="flex items-start flex-1 min-w-0 max-w-full overflow-hidden">
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate text-sm max-w-full overflow-hidden text-ellipsis">
                {displayText}
              </span>
            </div>
            {mode !== 'range' && (
              <div className="opacity-50 ml-1 flex-shrink-0">
                <ChevronLeft className="h-3 w-3 rotate-90" />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-auto z-[999999]" side={position}>
          <div className="flex flex-row">
            {/* Calendar */}
            <div className="p-4 min-w-[280px]" onKeyDown={handleKeyDown} tabIndex={-1}>
              {mode === 'range' && (
                <div className="mb-3 text-sm flex flex-col gap-1">
                  <div className="text-xs font-medium text-muted-foreground">Selected Range</div>
                  <div className="flex items-center justify-between w-full">
                    <Badge variant="outline" className="text-xs py-1 flex-1 justify-center overflow-hidden">
                      <span className="truncate">{format(date, "MMM d, yyyy")}</span>
                    </Badge>
                    <span className="px-2 text-muted-foreground flex-shrink-0">to</span>
                    <Badge variant="outline" className="text-xs py-1 flex-1 justify-center overflow-hidden">
                      <span className="truncate">{endDate ? format(endDate, "MMM d, yyyy") : format(date, "MMM d, yyyy")}</span>
                    </Badge>
                  </div>
                  {isSelectingEndDate && (
                    <p className="text-xs text-muted-foreground mt-1">Select end date</p>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center mb-3">
                <button 
                  className="h-8 w-8 p-0 hover:bg-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-md flex items-center justify-center border-0 bg-transparent cursor-pointer" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    prevMonth(e);
                  }}
                  type="button"
                  style={{ zIndex: 1000001 }}
                >
                  <span className="sr-only">Previous month</span>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="font-medium text-base focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded px-2 py-1"
                  onClick={() => {
                    // Optional: could add month/year picker functionality here
                  }}
                >
                  {format(currentMonth, "MMMM yyyy")}
                </button>
                <button 
                  className="h-8 w-8 p-0 hover:bg-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-md flex items-center justify-center border-0 bg-transparent cursor-pointer" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    nextMonth(e);
                  }}
                  type="button"
                  style={{ zIndex: 1000001 }}
                >
                  <span className="sr-only">Next month</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div 
                    key={day} 
                    className="text-center text-xs text-muted-foreground py-1"
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {day}
                  </div>
                ))}
                {days.map((day, i) => {
                  const isInRange = isDayInRange(day);
                  const isRangeStart = mode === 'range' && isSameDay(day, date);
                  const isRangeEnd = mode === 'range' && endDate && isSameDay(day, endDate);
                  const isFutureDate = shouldDisableDate(day);
                  
                  return (
                    <Button
                      key={i}
                      variant="ghost"
                      className={cn(
                        "h-8 w-8 p-0 text-sm relative",
                        !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-50",
                        (mode === 'range' ? (isRangeStart || isRangeEnd) : isSameDay(day, date)) && "bg-primary text-primary-foreground",
                        isSameDay(day, new Date()) && !(isRangeStart || isRangeEnd) && "border border-primary",
                        isInRange && !isRangeStart && !isRangeEnd && "bg-primary/20",
                        isFutureDate && "text-muted-foreground opacity-50 cursor-not-allowed",
                        "hover:bg-muted transition-colors duration-150"
                      )}
                      onClick={(e) => !isFutureDate && selectDate(day, e, "day")}
                      disabled={isFutureDate}
                      type="button"
                    >
                      {format(day, "d")}
                    </Button>
                  );
                })}
              </div>

            </div>
            
            {/* Events Sidebar */}
            {showEvents && displayEvents.length > 0 && (
              <div className={cn(
                "border-l p-4 w-[168px] flex flex-col gap-2 overflow-hidden",
                mode !== 'range' && "max-h-[300px] overflow-y-auto"
              )}>
                <div className="text-xs font-medium text-muted-foreground mb-3">{getEventGroupTitle()}</div>
                {displayEvents.map((event, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "text-xs py-1.5 px-2.5 rounded-md cursor-pointer transition-colors duration-200",
                      "hover:bg-muted w-full text-left",
                      selectedPresetLabel === event.label ? "bg-primary/15 font-medium text-primary" : "text-foreground"
                    )}
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    onClick={(e) => handlePresetSelection(event, e)}
                  >
                    {event.label}
                  </div>
                ))}
                
                {customEvents && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Custom Range</div>
                    {/* Aquí se puede agregar el UI para rangos personalizados */}
                  </div>
                )}
              </div>
            )}
            
            {/* Time Picker - Rightmost Column */}
            {showTimePicker && (
              <div className="border-l p-4 w-[230px] flex flex-col">
                <div className="text-xs font-medium text-muted-foreground mb-3">Select Time</div>
                
                {/* Time Controls - Horizontal Layout */}
                <div className="flex items-end gap-2 mb-4">
                  {/* Hours */}
                  <div className="flex flex-col flex-1">
                    <label className="text-xs text-muted-foreground mb-1">Hours</label>
                    <select
                      value={timeFormat === '12h' ? (selectedTime.hours === 0 ? 12 : selectedTime.hours > 12 ? selectedTime.hours - 12 : selectedTime.hours) : selectedTime.hours}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (timeFormat === '12h') {
                          const isPM = selectedTime.hours >= 12;
                          const newHours = value === 12 ? (isPM ? 12 : 0) : (isPM ? value + 12 : value);
                          handleHourChange(newHours.toString());
                        } else {
                          handleHourChange(e.target.value);
                        }
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent max-h-[200px] overflow-y-auto"
                      style={{ maxHeight: '200px' }}
                    >
                      {Array.from({ length: timeFormat === '12h' ? 12 : 24 }, (_, i) => {
                        const value = timeFormat === '12h' ? i + 1 : i;
                        return (
                          <option key={value} value={value}>
                            {value.toString().padStart(2, '0')}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="text-muted-foreground text-lg pb-1.5">:</div>

                  {/* Minutes */}
                  <div className="flex flex-col flex-1">
                    <label className="text-xs text-muted-foreground mb-1">Minutes</label>
                    <select
                      value={selectedTime.minutes}
                      onChange={(e) => handleMinuteChange(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent max-h-[200px] overflow-y-auto"
                      style={{ maxHeight: '200px' }}
                    >
                      {Array.from({ length: 60 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* AM/PM Toggle for 12h format */}
                  {timeFormat === '12h' && (
                    <div className="flex flex-col">
                      <label className="text-xs text-muted-foreground mb-1">Period</label>
                      <button
                        onClick={handleAMPMToggle}
                        className="px-2 py-1.5 text-sm border border-input rounded-md bg-background hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors min-w-[50px]"
                      >
                        {selectedTime.hours >= 12 ? 'PM' : 'AM'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Current time display */}
                <div className="pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-2">Selected Time</div>
                  <div className="text-center px-3 py-2 bg-muted/30 rounded-md">
                    <div className="text-sm font-medium">
                      {formatDisplayTime(selectedTime.hours, selectedTime.minutes)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
} 