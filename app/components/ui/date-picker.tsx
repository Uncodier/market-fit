"use client"

import * as React from "react"
import { CalendarIcon, ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { format, addDays, subDays, addWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, startOfDay, endOfDay, startOfWeek as dateStartOfWeek, endOfWeek as dateEndOfWeek, startOfMonth as dateStartOfMonth, endOfMonth as dateEndOfMonth, startOfYear, endOfYear, isSameYear } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/app/components/ui/dialog"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { TimeSelect } from "@/app/components/ui/time-select"
import { cn } from "@/lib/utils"
import { Badge } from "@/app/components/ui/badge"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getDateFnsLocale } from "@/app/lib/date-fns-locale"

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
  date?: Date;
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
  trigger?: React.ReactNode;
}

export function DatePicker({
  date,
  setDate,
  className,
  placeholder,
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
  timeFormat = '24h',
  trigger
}: DatePickerProps) {
  const { t, locale } = useLocalization()
  const dateLocale = getDateFnsLocale(locale)
  const resolvedPlaceholder = placeholder || t("datePicker.selectDate")
  const defaultDate = date || new Date()
  const [currentMonth, setCurrentMonth] = React.useState(new Date(defaultDate))
  const [open, setOpen] = React.useState(false)
  const [isSelectingEndDate, setIsSelectingEndDate] = React.useState(false)
  const [tempStartDate, setTempStartDate] = React.useState<Date | null>(null)
  const [selectedPresetLabel, setSelectedPresetLabel] = React.useState<string | null>(null)
  const [isNavigating, setIsNavigating] = React.useState(false)
  const [forceUpdate, setForceUpdate] = React.useState(0)
  const [selectedTime, setSelectedTime] = React.useState({
    hours: date?.getHours() ?? defaultDate.getHours(),
    minutes: date?.getMinutes() ?? defaultDate.getMinutes()
  })
  
  // Reset temporary state when popover closes
  React.useEffect(() => {
    if (!open) {
      setIsSelectingEndDate(false);
      setTempStartDate(null);
    }
  }, [open]);
  
  // Update currentMonth when date changes - prevent loops with useRef
  const lastProcessedDateRef = React.useRef<Date | null>(null);
  
  React.useEffect(() => {
    // Only update if date actually changed and is different from last processed
    if (date && (!lastProcessedDateRef.current || !isSameDay(lastProcessedDateRef.current, date))) {
      if (!isSameMonth(currentMonth, date)) {
        setCurrentMonth(new Date(date));
      }
      lastProcessedDateRef.current = new Date(date);
    }
  }, [date, currentMonth]);

  // Update selected time when date changes from outside
  React.useEffect(() => {
    if (date) {
      setSelectedTime({
        hours: date.getHours(),
        minutes: date.getMinutes()
      });
    }
  }, [date]);
  
  // Simplified force update without logging
  React.useEffect(() => {
    setForceUpdate(prev => prev + 1)
  }, [currentMonth])
  
  // Generate mode-specific default events with shorter labels
  const getDefaultEvents = (): DateEvent[] => {
    const now = new Date();
    const today = startOfDay(now);
    const weekOpts = { locale: dateLocale };
    
    const commonEvents: DateEvent[] = [
      { label: t("datePicker.today"), value: today, type: "day", period: "current" },
    ];
    
    switch (mode) {
      case 'task':
        return [
          ...commonEvents,
          { label: t("datePicker.tomorrow"), value: addDays(today, 1), type: "day", period: "future" },
          { label: t("datePicker.nextWeek"), value: addWeeks(today, 1), type: "week", period: "future" },
          { label: t("datePicker.nextMonth"), value: addMonths(today, 1), type: "month", period: "future" },
        ];
      
      case 'report':
        return [
          ...commonEvents,
          { label: t("datePicker.yesterday"), value: subDays(today, 1), type: "day", period: "past" },
          { label: t("datePicker.last7Days"), value: subDays(today, 7), type: "day", period: "past" },
          { label: t("datePicker.last30Days"), value: subDays(today, 30), type: "day", period: "past" },
          { label: t("datePicker.thisMonth"), value: dateStartOfMonth(today), type: "month", period: "current" },
          { label: t("datePicker.lastMonth"), value: startOfMonth(subMonths(today, 1)), type: "month", period: "past" },
          { label: t("datePicker.yearToDate"), value: new Date(today.getFullYear(), 0, 1), type: "year", period: "current" },
        ];
      
      case 'calendar':
        return [
          ...commonEvents,
          { label: t("datePicker.tomorrow"), value: addDays(today, 1), type: "day", period: "future" },
          { label: t("datePicker.thisWeek"), value: dateStartOfWeek(today, weekOpts), type: "week", period: "current" },
          { label: t("datePicker.nextWeek"), value: startOfWeek(addWeeks(today, 1), weekOpts), type: "week", period: "future" },
          { label: t("datePicker.thisMonth"), value: dateStartOfMonth(today), type: "month", period: "current" },
          { label: t("datePicker.nextMonth"), value: startOfMonth(addMonths(today, 1)), type: "month", period: "future" },
        ];

      case 'range':
        return [
          { label: t("datePicker.today"), value: today, type: "day", period: "current" },
          { label: t("datePicker.thisWeek"), value: dateStartOfWeek(today, weekOpts), type: "week", period: "current" },
          { label: t("datePicker.thisMonth"), value: dateStartOfMonth(today), type: "month", period: "current" },
          { label: t("datePicker.lastMonth"), value: startOfMonth(subMonths(today, 1)), type: "month", period: "past" },
          { label: t("datePicker.last30Days"), value: subDays(today, 30), type: "custom", period: "past" },
          { label: t("datePicker.thisQuarter"), value: (() => {
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            const currentQuarter = Math.floor(currentMonth / 3);
            const quarterStartMonth = currentQuarter * 3;
            return new Date(currentYear, quarterStartMonth, 1);
          })(), type: "month", period: "current" },
          { label: t("datePicker.yearToDate"), value: new Date(today.getFullYear(), 0, 1), type: "year", period: "current" },
          { label: t("datePicker.lastYear"), value: new Date(today.getFullYear() - 1, 0, 1), type: "year", period: "past" },
          { label: t("datePicker.allTime"), value: new Date(2000, 0, 1), type: "custom", period: "past" },
        ];
      
      default:
        return [
          ...commonEvents,
          { label: t("datePicker.tomorrow"), value: addDays(today, 1), type: "day", period: "future" },
          { label: t("datePicker.yesterday"), value: subDays(today, 1), type: "day", period: "past" },
          { label: t("datePicker.thisWeek"), value: dateStartOfWeek(today, weekOpts), type: "week", period: "current" },
          { label: t("datePicker.thisMonth"), value: dateStartOfMonth(today), type: "month", period: "current" },
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
    const startDate = startOfWeek(monthStart, { locale: dateLocale })
    const calendarEnd = endOfWeek(monthEnd, { locale: dateLocale })
    
    const calculatedDays = eachDayOfInterval({ start: startDate, end: calendarEnd })
    
    return calculatedDays
  }, [currentMonth, forceUpdate, dateLocale])
  
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
      const period = hours >= 12 ? t("datePicker.pm") : t("datePicker.am");
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } else {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  };

  const handleTimeChange = (hours: number, minutes: number) => {
    setSelectedTime({ hours, minutes });
    
    // Create new date with updated time
    const newDate = new Date(date || new Date());
    newDate.setHours(hours, minutes, 0, 0);
    setDate(newDate);
  };

  // Update display text to include time if time picker is enabled
  const getDisplayText = (): string => {
    if (mode === 'range' && endDate && rangeDisplay) {
      return rangeDisplay;
    } else if (date) {
      const dateStr = format(date, "PPP", { locale: dateLocale });
      if (showTimePicker) {
        const timeStr = formatDisplayTime(selectedTime.hours, selectedTime.minutes);
        return t("datePicker.dateAtTime", { date: dateStr, time: timeStr });
      }
      return dateStr;
    }
    return resolvedPlaceholder;
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
        setTempStartDate(selectedDate);
        setDate(selectedDate);
        if (endDate && selectedDate > endDate) {
          setEndDate(selectedDate);
        }
        setIsSelectingEndDate(true);
        return;
      } else {
        // Selecting end date
        let start = tempStartDate || date || selectedDate;
        let end = selectedDate;
        
        if (start && selectedDate < start) {
          // If selected end date is before start date, swap them
          end = start;
          start = selectedDate;
          setDate(start);
          setEndDate(end);
        } else {
          setEndDate(end);
        }
        
        setIsSelectingEndDate(false);
        setTempStartDate(null);
        
        if (onRangeSelect) {
          // Notificar solo si hay cambios reales
          if (!endDate || !isSameDay(end, endDate) || !date || !isSameDay(start, date)) {
            onRangeSelect(start, end);
          }
        }
        
        setOpen(false);
        return;
      }
    }
    
    // Si no es modo rango, simplemente actualizar la fecha
    if (!date || !isSameDay(date, selectedDate)) {
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
          end = endOfDay(dateEndOfWeek(selectedDate, { locale: dateLocale }));
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
      if (!endDate || !isSameDay(end, endDate) || !date || !isSameDay(selectedDate, date)) {
        onRangeSelect(startOfDay(selectedDate), end);
      }
    }
    
    setOpen(false)
  }
  
  // Get the event group title based on mode
  const getEventGroupTitle = (): string => {
    switch (mode) {
      case 'task':
        return t("datePicker.scheduleFor");
      case 'report':
        return t("datePicker.dateRanges");
      case 'calendar':
        return t("datePicker.jumpTo");
      case 'range':
        return t("datePicker.presetRanges");
      default:
        return t("datePicker.quickSelect");
    }
  };

  // Check if a day is within the selected range
  const isDayInRange = (day: Date): boolean => {
    if (mode !== 'range' || isSelectingEndDate) return false;
    const start = tempStartDate || date;
    if (!endDate || !start) return false;
    return day >= start && day <= endDate;
  };
  
  // Format the range display
  const displayText = getDisplayText();
  
  // Function to handle preset selection
  const handlePresetSelection = (event: DateEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const start = new Date(event.value);
    
    let end: Date;
    
    switch (event.type) {
      case 'day':
        end = endOfDay(start);
        break;
      case 'week':
        end = endOfDay(dateEndOfWeek(start, { locale: dateLocale }));
        break;
      case 'month':
        end = endOfDay(dateEndOfMonth(start));
        break;
      case 'year':
        end = isSameYear(start, today)
          ? endOfDay(today)
          : endOfDay(endOfYear(start));
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
        if (!date || !isSameDay(start, date) || !endDate || !isSameDay(end, endDate)) {
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
  
  const shouldDisableDate = (_date: Date) => false;
  
  const isMobile = useIsMobile();

  const triggerButton = (
    <Button
      variant={mode === 'range' ? "secondary" : "outline"}
      className={cn(
        mode === 'range' ? "h-9" : "h-10",
        "text-left font-normal",
        mode === 'range' ? "w-auto gap-2" : "w-full",
        mode === 'range' ? "px-3" : "px-3 py-1 flex items-center justify-between",
        mode !== 'range' && "rounded-md border border-input bg-background",
        "focus:outline-none focus-visible:outline-none focus-visible:ring-0",
        mode !== 'range' && "hover:bg-muted hover:border-input hover:no-underline transition-colors duration-200",
        !date && "text-muted-foreground",
        className
      )}
      disabled={disabled}
    >
      <div className="flex items-center flex-1 min-w-0 max-w-full overflow-hidden">
        <CalendarIcon className={cn("h-4 w-4 flex-shrink-0", mode === 'range' ? "mr-2" : "mr-2")} />
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
  );

  const pickerContent = (
    <div className="flex flex-col sm:flex-row max-h-[80vh] sm:max-h-none overflow-y-auto sm:overflow-visible">
      {/* Calendar */}
      <div className="p-4 w-full sm:w-[280px] sm:min-w-[280px] flex-shrink-0" onKeyDown={handleKeyDown} tabIndex={-1}>
        {mode === 'range' && (
                <div className="mb-3 text-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between w-full">
                    <Badge variant="outline" className="text-xs py-1 flex-1 justify-center overflow-hidden">
                      <span className="truncate">{(tempStartDate || date) ? format((tempStartDate || date)!, "PP", { locale: dateLocale }) : t("datePicker.selectDate")}</span>
                    </Badge>
                    <span className="px-2 text-muted-foreground flex-shrink-0">{t("datePicker.to")}</span>
                    <Badge variant="outline" className="text-xs py-1 flex-1 justify-center overflow-hidden">
                      <span className="truncate">{!isSelectingEndDate && endDate ? format(endDate, "PP", { locale: dateLocale }) : t("datePicker.selectDate")}</span>
                    </Badge>
                  </div>
                  {isSelectingEndDate && (
                    <p className="text-xs text-muted-foreground mt-1">{t("datePicker.selectEndDate")}</p>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center mb-3">
                <button 
                  className="h-8 w-8 p-0 hover:bg-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary rounded-md flex items-center justify-center border-0 bg-transparent cursor-pointer" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    prevMonth(e);
                  }}
                  type="button"
                  style={{ zIndex: 1000001 }}
                >
                  <span className="sr-only">{t("datePicker.previousMonth")}</span>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="font-medium text-base focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary rounded px-2 py-1"
                  onClick={() => {
                    // Optional: could add month/year picker functionality here
                  }}
                >
                  {format(currentMonth, "MMMM yyyy", { locale: dateLocale })}
                </button>
                <button 
                  className="h-8 w-8 p-0 hover:bg-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary rounded-md flex items-center justify-center border-0 bg-transparent cursor-pointer" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    nextMonth(e);
                  }}
                  type="button"
                  style={{ zIndex: 1000001 }}
                >
                  <span className="sr-only">{t("datePicker.nextMonth")}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {eachDayOfInterval({
                  start: startOfWeek(currentMonth, { locale: dateLocale }),
                  end: addDays(startOfWeek(currentMonth, { locale: dateLocale }), 6),
                }).map((weekday) => (
                  <div 
                    key={weekday.toISOString()} 
                    className="text-center text-xs text-muted-foreground py-1"
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {format(weekday, "EEEEEE", { locale: dateLocale })}
                  </div>
                ))}
                {days.map((day, i) => {
                  const isInRange = isDayInRange(day);
                  const effectiveDate = tempStartDate || date;
                  const isRangeStart = mode === 'range' && effectiveDate && isSameDay(day, effectiveDate);
                  const isRangeEnd = mode === 'range' && !isSelectingEndDate && endDate && isSameDay(day, endDate);
                  const isFutureDate = shouldDisableDate(day);
                  
                  return (
                    <Button
                      key={i}
                      variant="ghost"
                      className={cn(
                        "h-8 w-full sm:w-8 p-0 text-sm relative",
                        !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-50",
                        (mode === 'range' ? (isRangeStart || isRangeEnd) : (date && isSameDay(day, date))) && "bg-primary text-primary-foreground",
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
                "border-t sm:border-t-0 sm:border-l p-4 w-full sm:w-[168px] flex flex-col gap-2 overflow-hidden flex-shrink-0",
                mode !== 'range' && "max-h-[300px] overflow-y-auto"
              )}>
                {mode !== 'range' && (
                  <div className="text-xs font-medium text-muted-foreground mb-3">{getEventGroupTitle()}</div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
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
                </div>
                
                {customEvents && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground mb-1">{t("datePicker.customRange")}</div>
                    {/* Aquí se puede agregar el UI para rangos personalizados */}
                  </div>
                )}
              </div>
            )}
            
            {/* Time Picker - Rightmost Column */}
            {showTimePicker && (
              <div className="border-t sm:border-t-0 sm:border-l p-4 w-full sm:w-[230px] flex flex-col flex-shrink-0">
                <div className="text-xs font-medium text-muted-foreground mb-3">{t("datePicker.selectTime")}</div>
                <TimeSelect
                  value={`${selectedTime.hours.toString().padStart(2, "0")}:${selectedTime.minutes.toString().padStart(2, "0")}`}
                  onValueChange={(next) => {
                    const [hours, minutes] = next.split(":").map(Number)
                    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
                      handleTimeChange(hours, minutes)
                    }
                  }}
                  step={15}
                  triggerClassName="h-10"
                />
                {timeFormat === "12h" && (
                  <div className="pt-3 mt-3 border-t dark:border-white/5 border-black/5">
                    <div className="text-xs text-muted-foreground mb-2">{t("datePicker.selectedTime")}</div>
                    <div className="text-center px-3 py-2 bg-muted/30 rounded-md">
                      <div className="text-sm font-medium">
                        {formatDisplayTime(selectedTime.hours, selectedTime.minutes)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
  );

  const resolvedTrigger = trigger || triggerButton

  if (isMobile) {
    return (
      <div className={trigger ? "inline-flex w-auto h-auto shrink-0" : "w-full"}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            {resolvedTrigger}
          </DialogTrigger>
          <DialogContent 
            className="p-0 w-[95vw] max-w-[400px] gap-0 border-border bg-popover !fixed !inset-auto !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !rounded-xl" 
            showClose={true}
          >
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <DialogTitle className="text-base font-semibold">{t("datePicker.selectDate")}</DialogTitle>
            </div>
            {pickerContent}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={trigger ? "inline-flex w-auto h-auto shrink-0" : "w-full"}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {resolvedTrigger}
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-auto max-w-[calc(100vw-2rem)] sm:max-w-none z-[1000050]"
          side={position}
          align="center"
          onInteractOutside={(event) => {
            const target = event.target as Element | null
            if (target?.closest && target.closest("[data-time-select]")) event.preventDefault()
          }}
        >
          {pickerContent}
        </PopoverContent>
      </Popover>
    </div>
  );
} 