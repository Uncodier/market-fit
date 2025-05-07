"use client"

import * as React from "react"
import { CalendarIcon, ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, startOfDay, endOfDay, startOfWeek as dateStartOfWeek, endOfWeek as dateEndOfWeek, startOfMonth as dateStartOfMonth, endOfMonth as dateEndOfMonth, startOfYear, endOfYear, isSameYear, subYears } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { cn } from "@/lib/utils"
import { Badge } from "@/app/components/ui/badge"

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
  rangeDisplay
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date(date))
  const [open, setOpen] = React.useState(false)
  const [isSelectingEndDate, setIsSelectingEndDate] = React.useState(false)
  const [selectedPresetLabel, setSelectedPresetLabel] = React.useState<string | null>(null)
  
  // Update currentMonth when date changes - solo si cambia significativamente
  React.useEffect(() => {
    if (!isSameMonth(currentMonth, date)) {
      setCurrentMonth(new Date(date));
    }
  }, [date, currentMonth]);
  
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

      case 'range':
        return [
          { label: "Today", value: today, type: "day", period: "current" },
          { label: "This week", value: dateStartOfWeek(today), type: "week", period: "current" },
          { label: "This month", value: dateStartOfMonth(today), type: "month", period: "current" },
          { label: "Last month", value: startOfMonth(subMonths(today, 1)), type: "month", period: "past" },
          { label: "This quarter", value: dateStartOfMonth(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)), type: "month", period: "current" },
          { label: "Year to date", value: startOfYear(today), type: "year", period: "current" },
          { label: "Last year", value: startOfYear(subYears(today, 1)), type: "year", period: "past" },
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
  const displayText = React.useMemo(() => {
    if (mode === 'range' && endDate && rangeDisplay) {
      return rangeDisplay;
    } else if (date) {
      return format(date, "PPP");
    }
    return placeholder;
  }, [date, endDate, mode, placeholder, rangeDisplay]);
  
  // Function to handle preset selection
  const handlePresetSelection = (event: DateEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const today = new Date();
    let end: Date;
    
    switch (event.type) {
      case 'day':
        end = endOfDay(event.value);
        break;
      case 'week':
        end = endOfDay(dateEndOfWeek(event.value));
        break;
      case 'month':
        end = endOfDay(dateEndOfMonth(event.value));
        break;
      case 'year':
        end = isSameYear(event.value, today) 
          ? endOfDay(today) 
          : endOfDay(endOfYear(event.value));
        break;
      default:
        end = today;
    }
    
    // Set the start date
    setDate(event.value);
    
    // Save which preset was selected
    setSelectedPresetLabel(event.label);
    
    // If range mode, set the end date
    if (mode === 'range' && setEndDate) {
      setEndDate(end);
      
      // Trigger range selection callback immediately
      if (onRangeSelect) {
        // Notificar solo si hay cambios reales
        if (!isSameDay(event.value, date) || !endDate || !isSameDay(end, endDate)) {
          onRangeSelect(event.value, end);
        }
      }
      
      // Close the popover immediately for range presets
      setOpen(false);
    } else {
      // Normal date selection
      selectDate(event.value, e, event.type);
    }
  };
  
  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 text-left font-normal w-full",
              "px-3 py-1 flex items-center justify-between",
              "rounded-md border border-input bg-background",
              "focus:outline-none focus-visible:outline-none focus-visible:ring-0",
              "hover:bg-muted hover:border-input hover:no-underline transition-colors duration-200",
              !date && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          >
            <div className="flex items-center flex-1 min-w-0 max-w-full overflow-hidden">
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
        <PopoverContent className="p-0 w-auto" side={position}>
          <div className="flex flex-row">
            {/* Calendar */}
            <div className="p-4 min-w-[280px]">
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
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0 hover:bg-muted transition-colors duration-150" 
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
                  className="h-8 w-8 p-0 hover:bg-muted transition-colors duration-150" 
                  onClick={nextMonth}
                  type="button"
                >
                  <span className="sr-only">Next month</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
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
                        "hover:bg-muted transition-colors duration-150"
                      )}
                      onClick={(e) => selectDate(day, e, "day")}
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
                "border-l p-3 w-[160px] flex flex-col gap-2 overflow-hidden",
                mode !== 'range' && "max-h-[300px] overflow-y-auto"
              )}>
                <div className="text-xs font-medium text-muted-foreground mb-1">{getEventGroupTitle()}</div>
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
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
} 