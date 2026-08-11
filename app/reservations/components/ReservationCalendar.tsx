"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useCurrentTime } from "@/app/hooks/useCurrentTime"
import { CurrentTimeIndicator } from "@/app/control-center/components/CurrentTimeIndicator"
import { Reservation } from "@/app/types"

import { useLocalization } from "@/app/context/LocalizationContext"

type CalendarViewMode = 'year' | 'month' | 'week' | 'day'

// Componente para el estado de la reserva
function ReservationStatusDot({ status }: { status: Reservation['status'] }) {
  return (
    <div className={cn(
      "w-2 h-2 rounded-full",
      status === 'completed' && "bg-green-500",
      status === 'confirmed' && "bg-blue-500",
      status === 'pending' && "bg-yellow-500",
      status === 'cancelled' && "bg-red-500"
    )} />
  )
}

// Función para obtener las iniciales
function getLeadInitials(name: string | undefined | null) {
  if (!name) return "L"
  return name.split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

// Componente para la reserva
function ReservationItem({ reservation, onClick, showDay, showTime }: { 
  reservation: Reservation
  onClick: (res: Reservation) => void 
  showDay?: boolean
  showTime?: boolean
}) {
  const resDate = new Date(reservation.start_time)
  const timeStr = resDate.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
  const dayStr = resDate.getDate().toString()

  return (
    <div
      onClick={() => onClick(reservation)}
      className="cursor-pointer group"
    >
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-2 text-xs w-full pr-2 pl-1",
          reservation.status === 'completed' && "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
          reservation.status === 'confirmed' && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
          reservation.status === 'pending' && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
          reservation.status === 'cancelled' && "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
        )}
      >
        <Avatar className="h-5 w-5 mr-1.5">
          {reservation.buyer_profile?.avatar_url ? (
            <AvatarImage
              src={reservation.buyer_profile.avatar_url}
              alt={reservation.lead?.name || ""}
              className="object-cover"
            />
          ) : null}
          <AvatarFallback className="text-[10px] bg-primary/10">
            {getLeadInitials(reservation.lead?.name || reservation.buyer_profile?.name)}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate">
          {reservation.catalog_item?.name ||
            reservation.location?.name ||
            (reservation.resource_type === "employee" ? "Employee" : "Unknown Service")}
        </span>
        {(showDay || showTime) && (
          <span className="text-muted-foreground mr-2">
            {showDay && dayStr}
            {showTime && timeStr}
          </span>
        )}
        <ReservationStatusDot status={reservation.status} />
      </Badge>
    </div>
  )
}

interface ReservationCalendarProps {
  reservations: Reservation[]
  viewMode: 'service' | 'calendar'
}

export function ReservationCalendar({ reservations, viewMode: listGroupMode }: ReservationCalendarProps) {
  const { t } = useLocalization()
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const dayViewRef = useRef<HTMLDivElement>(null)
  
  const { 
    currentTime, 
    isToday,
    isSameDay,
    getCurrentTimePosition 
  } = useCurrentTime()

  // Effect to scroll to current time in day view
  useEffect(() => {
    if (viewMode === 'day' && dayViewRef.current) {
      const currentHour = currentTime.getHours()
      const scrollPosition = (currentHour * 80) - (dayViewRef.current.clientHeight / 2) + 40
      dayViewRef.current.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth'
      })
    }
  }, [viewMode, currentTime])

  // Helper function to create a new date while preserving the day
  const createNewDatePreservingDay = (
    originalDate: Date,
    newYear: number,
    newMonth: number
  ) => {
    const targetDay = originalDate.getDate()
    const lastDayOfNewMonth = new Date(newYear, newMonth + 1, 0).getDate()
    const day = Math.min(targetDay, lastDayOfNewMonth)
    
    const newDate = new Date(originalDate)
    newDate.setFullYear(newYear)
    newDate.setMonth(newMonth)
    newDate.setDate(day)
    return newDate
  }

  // Calendar navigation
  const nextPeriod = () => {
    setSelectedDate(prevDate => {
      const newDate = new Date(prevDate)
      const currentDay = newDate.getDate()
      const currentMonth = newDate.getMonth()
      const currentYear = newDate.getFullYear()

      switch (viewMode) {
        case 'year':
          return createNewDatePreservingDay(
            newDate,
            currentYear + 1,
            currentMonth
          )
        case 'month':
          return createNewDatePreservingDay(
            newDate,
            currentMonth === 11 ? currentYear + 1 : currentYear,
            currentMonth === 11 ? 0 : currentMonth + 1
          )
        case 'week':
          newDate.setDate(currentDay + 7)
          return newDate
        case 'day':
          newDate.setDate(currentDay + 1)
          return newDate
        default:
          return newDate
      }
    })
  }

  const prevPeriod = () => {
    setSelectedDate(prevDate => {
      const newDate = new Date(prevDate)
      const currentDay = newDate.getDate()
      const currentMonth = newDate.getMonth()
      const currentYear = newDate.getFullYear()

      switch (viewMode) {
        case 'year':
          return createNewDatePreservingDay(
            newDate,
            currentYear - 1,
            currentMonth
          )
        case 'month':
          return createNewDatePreservingDay(
            newDate,
            currentMonth === 0 ? currentYear - 1 : currentYear,
            currentMonth === 0 ? 11 : currentMonth - 1
          )
        case 'week':
          newDate.setDate(currentDay - 7)
          return newDate
        case 'day':
          newDate.setDate(currentDay - 1)
          return newDate
        default:
          return newDate
      }
    })
  }

  // Group tasks by date
  const reservationsByDate = reservations.reduce((acc, reservation) => {
    const dateStr = reservation.start_time.split('T')[0]
    if (!acc[dateStr]) {
      acc[dateStr] = []
    }
    acc[dateStr].push(reservation)
    return acc
  }, {} as Record<string, Reservation[]>)

  // Get days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  // Get days in previous month
  const getDaysInPreviousMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate()
  }

  // Format date as YYYY-MM-DD
  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Get month name
  const getMonthName = (month: number) => {
    return new Date(0, month).toLocaleString('default', { month: 'long' })
  }

  // Get week dates starting from the current date's week
  const getWeekDates = (date: Date) => {
    const result = []
    const firstDayOfWeek = new Date(date)
    // Adjust to start of week (Sunday)
    firstDayOfWeek.setDate(date.getDate() - date.getDay())
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(firstDayOfWeek)
      day.setDate(firstDayOfWeek.getDate() + i)
      result.push(day)
    }
    return result
  }

  // Get period label with correct date formatting
  const getPeriodLabel = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }

    switch (viewMode) {
      case 'year':
        return selectedDate.getFullYear().toString()
      case 'month':
        return new Date(selectedDate).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        })
      case 'week': {
        const weekDates = getWeekDates(selectedDate)
        const start = weekDates[0].toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
        const end = weekDates[6].toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
        return `${start} - ${end}`
      }
      case 'day':
        return selectedDate.toLocaleDateString('en-US', options)
      default:
        return ''
    }
  }

  // Check if a month is the current month
  const isCurrentMonth = (month: number) => {
    const today = new Date()
    return month === today.getMonth() && selectedDate.getFullYear() === today.getFullYear()
  }

  // Check if a month is the selected month
  const isSelectedMonth = (month: number) => {
    return month === selectedDate.getMonth()
  }

  // Handle date selection
  const handleDateSelection = (dateStr: string) => {
    const newDate = new Date(dateStr)
    // Preserve the current time
    newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), selectedDate.getSeconds(), selectedDate.getMilliseconds())
    setSelectedDate(newDate)
  }

  // Handle month selection
  const handleMonthSelection = (month: number) => {
    const newDate = createNewDatePreservingDay(
      selectedDate,
      selectedDate.getFullYear(),
      month
    )
    setSelectedDate(newDate)
  }

  // Render calendar content based on view mode
  const renderCalendarContent = () => {
    switch (viewMode) {
      case 'month':
        return renderMonthView()
      case 'week':
        return renderWeekView()
      case 'day':
        return renderDayView()
      case 'year':
        return renderYearView()
      default:
        return null
    }
  }

  // Render month view
  const renderMonthView = () => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDayOfMonth = getFirstDayOfMonth(year, month)
    const calendarDays = []

    // Add days from previous month
    const daysInPreviousMonth = getDaysInPreviousMonth(year, month)
    for (let i = 0; i < firstDayOfMonth; i++) {
      const day = daysInPreviousMonth - firstDayOfMonth + i + 1
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      const dateStr = formatDate(prevYear, prevMonth, day)
      calendarDays.push({ day, dateStr, isCurrentMonth: false })
    }

    // Add days from current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(year, month, day)
      calendarDays.push({ day, dateStr, isCurrentMonth: true })
    }

    // Add days from next month
    const totalDaysShown = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7
    const daysFromNextMonth = totalDaysShown - (firstDayOfMonth + daysInMonth)
    for (let day = 1; day <= daysFromNextMonth; day++) {
      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year
      const dateStr = formatDate(nextYear, nextMonth, day)
      calendarDays.push({ day, dateStr, isCurrentMonth: false })
    }

    return (
      <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden h-[calc(100vh-280px)]">
        {/* Week day headers */}
        {[
          t('common.days.short.sun') || 'Sun', 
          t('common.days.short.mon') || 'Mon', 
          t('common.days.short.tue') || 'Tue', 
          t('common.days.short.wed') || 'Wed', 
          t('common.days.short.thu') || 'Thu', 
          t('common.days.short.fri') || 'Fri', 
          t('common.days.short.sat') || 'Sat'
        ].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium bg-background sticky top-0 z-10">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map(({ day, dateStr, isCurrentMonth: isCurrentMonthDay }, index) => {
          const dayReservations = reservationsByDate[dateStr] || []
          const isCurrentDay = isToday(dateStr)

          return (
            <div
              key={`${dateStr}-${index}`}
              className={cn(
                "bg-background p-2 relative",
                !isCurrentMonthDay && "text-muted-foreground/50",
                isCurrentDay && "bg-accent/5"
              )}
            >
              <div className={cn(
                "text-sm font-medium mb-2 text-center rounded-full w-7 h-7 mx-auto flex items-center justify-center",
                !isCurrentMonthDay && "text-muted-foreground/50",
                isCurrentDay && "bg-accent/10 text-accent-foreground"
              )}>
                {day}
              </div>
              <div className="space-y-1">
                {dayReservations.map((reservation) => (
                  <ReservationItem 
                    key={reservation.id} 
                    reservation={reservation} 
                    onClick={() => {}}
                    showTime={true}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Render week view
  const renderWeekView = () => {
    const weekDates = getWeekDates(selectedDate)
    const timePosition = getCurrentTimePosition()

    return (
      <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden h-[calc(100vh-280px)]">
        {/* Week day headers */}
        {weekDates.map((date) => {
          const dateStr = date.toISOString().split('T')[0]
          const isCurrentDay = isToday(date)

          return (
            <div key={date.toISOString()} className={cn(
              "bg-background sticky top-0 z-10",
              isCurrentDay && "bg-accent/5"
            )}>
              <div className="flex flex-col items-center p-2">
                <div className="text-sm font-medium">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}
                </div>
                <div className={cn(
                  "text-xs mt-1 rounded-full w-6 h-6 flex items-center justify-center",
                  isCurrentDay && "bg-accent/10 text-accent-foreground"
                )}>
                  {date.getDate()}
                </div>
              </div>
            </div>
          )
        })}

        {/* Week days content */}
        {weekDates.map((date) => {
          const dateStr = date.toISOString().split('T')[0]
          const dayReservations = reservationsByDate[dateStr] || []
          const isCurrentDay = isToday(date)

          return (
            <div
              key={dateStr}
              className={cn(
                "bg-background relative",
                isCurrentDay && "bg-accent/5"
              )}
            >
              <div className="p-2 space-y-2 h-[600px] overflow-y-auto">
                {dayReservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                    }}
                  >
                    <ReservationItem 
                      key={reservation.id} 
                      reservation={reservation} 
                      onClick={() => {}}
                      showTime={true}
                    />
                  </div>
                ))}
              </div>
              
              {isCurrentDay && (
                <CurrentTimeIndicator
                  timePosition={timePosition}
                  currentTime={currentTime}
                  showLabel={false}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

    // Render day view
  const renderDayView = () => {
    const dateStr = selectedDate.toISOString().split('T')[0]
    const dayReservations = reservationsByDate[dateStr] || []
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const isCurrentDay = isToday(selectedDate)
    const timePosition = getCurrentTimePosition()

    // Function to check if an hour has passed
    const isHourPassed = (hour: number) => {
      if (!isCurrentDay) return false
      return hour < currentTime.getHours() || 
        (hour === currentTime.getHours() && currentTime.getMinutes() > 0)
    }

    // Function to check if we're in the current hour
    const isCurrentHourBlock = (hour: number) => {
      return isCurrentDay && hour === currentTime.getHours()
    }

    if (listGroupMode === 'service') {
      // Group by Service for the Day view
      const services = Array.from(new Set(dayReservations.map(r => r.catalog_item?.name || 'Unknown Service')))
      
      if (services.length === 0) {
        return (
          <div className="flex-1 flex items-center justify-center h-[calc(100vh-280px)]">
            <div className="text-muted-foreground">No reservations for this date.</div>
          </div>
        )
      }

      return (
        <div 
          ref={dayViewRef}
          className="bg-background rounded-lg overflow-auto h-[calc(100vh-280px)] scroll-smooth"
        >
          <div 
            className="grid divide-x divide-border" 
            style={{ gridTemplateColumns: `100px repeat(${services.length}, minmax(200px, 1fr))` }}
          >
            {/* Header row for services */}
            <div className="bg-muted/50 sticky top-0 left-0 z-10 border-b border-border h-10" />
            {services.map(serviceName => (
              <div key={serviceName} className="bg-muted/50 sticky top-0 z-10 border-b border-border h-10 flex items-center justify-center font-medium text-sm truncate px-2">
                {serviceName}
              </div>
            ))}

            {/* Time column */}
            <div className="bg-muted/50 sticky left-0 z-[2] mt-10" style={{ gridRow: '2 / span 24', gridColumn: '1' }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={cn(
                    "h-20 border-b border-border p-2 text-sm text-right pr-4",
                    isHourPassed(hour) && "text-muted-foreground",
                    isCurrentHourBlock(hour) && "text-accent-foreground font-medium"
                  )}
                >
                  {`${hour.toString().padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            {/* Service columns */}
            {services.map((serviceName, colIndex) => (
              <div key={serviceName} className="relative" style={{ gridRow: '2 / span 24', gridColumn: colIndex + 2 }}>
                {isCurrentDay && (
                  <div 
                    className="absolute left-0 right-0 top-0 bg-muted/30 dark:bg-muted/50 pointer-events-none z-0"
                    style={{ height: `${timePosition}px` }}
                  />
                )}
                
                {hours.map((hour) => {
                  const hourReservations = dayReservations.filter(r => {
                    const resDate = new Date(r.start_time)
                    return resDate.getHours() === hour && (r.catalog_item?.name || 'Unknown Service') === serviceName
                  })

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "h-20 border-b border-border p-2 relative group transition-colors",
                        !isHourPassed(hour) && "hover:bg-accent/5",
                        isCurrentHourBlock(hour) && "bg-accent/20 dark:bg-accent/30"
                      )}
                    >
                      {hourReservations.map((reservation) => (
                        <ReservationItem 
                          key={reservation.id} 
                          reservation={reservation} 
                          onClick={() => {}}
                          showTime={true}
                        />
                      ))}
                    </div>
                  )
                })}

                {isCurrentDay && (
                  <CurrentTimeIndicator
                    timePosition={timePosition}
                    currentTime={currentTime}
                    showLabel={false}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Default 'calendar' (By Date) mode - single column for all reservations
    const reservationsByHour = hours.reduce((acc, hour) => {
      acc[hour] = dayReservations.filter(reservation => {
        const resDate = new Date(reservation.start_time)
        return resDate.getHours() === hour
      })
      return acc
    }, {} as Record<number, Reservation[]>)

    return (
      <div 
        ref={dayViewRef}
        className="bg-background rounded-lg overflow-auto h-[calc(100vh-280px)] scroll-smooth"
      >
        <div className="grid grid-cols-[100px_1fr] divide-x divide-border">
          {/* Time column */}
          <div className="bg-muted/50 sticky left-0 z-[2]">
            {hours.map((hour) => (
              <div
                key={hour}
                className={cn(
                  "h-20 border-b border-border p-2 text-sm text-right pr-4",
                  isHourPassed(hour) && "text-muted-foreground",
                  isCurrentHourBlock(hour) && "text-accent-foreground font-medium"
                )}
              >
                {`${hour.toString().padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Tasks column */}
          <div className="relative min-w-[200px]">
            {/* Past time overlay */}
            {isCurrentDay && (
              <div 
                className="absolute left-0 right-0 top-0 bg-muted/30 dark:bg-muted/50 pointer-events-none z-0"
                style={{ 
                  height: `${timePosition}px`
                }}
              />
            )}
            
            {hours.map((hour) => (
              <div
                key={hour}
                className={cn(
                  "h-20 border-b border-border p-2 relative group transition-colors",
                  !isHourPassed(hour) && "hover:bg-accent/5",
                  isCurrentHourBlock(hour) && "bg-accent/20 dark:bg-accent/30"
                )}
              >
                {reservationsByHour[hour]?.map((reservation) => (
                  <ReservationItem 
                    key={reservation.id} 
                    reservation={reservation} 
                    onClick={() => {}}
                    showTime={true}
                  />
                ))}
              </div>
            ))}

            {/* Current time indicator */}
            {isCurrentDay && (
              <CurrentTimeIndicator
                timePosition={timePosition}
                currentTime={currentTime}
                showLabel={false}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render year view
  const renderYearView = () => {
    const months = Array.from({ length: 12 }, (_, i) => i)
    const today = new Date()
    
    return (
      <div className="grid grid-cols-4 gap-px bg-muted rounded-lg overflow-hidden h-[calc(100vh-280px)]">
        {months.map((month) => {
          const monthReservations = reservations.filter(reservation => {
            const resDate = new Date(reservation.start_time)
            return resDate.getMonth() === month && resDate.getFullYear() === selectedDate.getFullYear()
          })

          const visibleReservations = monthReservations.slice(0, 15)
          const remainingReservations = monthReservations.length - 15
          const isCurrentMonthHighlight = month === today.getMonth() && selectedDate.getFullYear() === today.getFullYear()

          return (
            <div 
              key={month} 
              className={cn(
                "bg-background p-4 min-h-full flex flex-col",
                isCurrentMonthHighlight && "bg-accent/5"
              )}
            >
              <h3 className={cn(
                "font-medium text-sm mb-3 text-center rounded-full py-1",
                isCurrentMonthHighlight && "text-accent-foreground"
              )}>
                {getMonthName(month)}
              </h3>
              <div className="flex-1 flex flex-col">
                {visibleReservations.length > 0 ? (
                  <>
                    <div className="flex-1 space-y-2">
                      {visibleReservations.map((reservation) => (
                        <ReservationItem 
                          key={reservation.id} 
                          reservation={reservation} 
                          onClick={() => {}}
                          showDay={true}
                        />
                      ))}
                    </div>
                    {remainingReservations > 0 && (
                      <div className="text-xs text-muted-foreground text-center mt-3 py-1 bg-muted/50 rounded-md">
                        {`+${remainingReservations} more`}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-xs text-muted-foreground text-center py-8 px-4 w-full">
                      No reservations
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <style jsx>{`
        .tasks-container {
            display: grid;
            grid-auto-rows: min-content;
            gap: 0.25rem;
            overflow: hidden;
            max-height: 100%;
          }
        `}</style>
        {/* Calendar Header */}
        <div className="flex items-center justify-between py-6 border-b pl-8 pr-[33px]">
          <div className="flex-1 flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                const now = new Date()
                setSelectedDate(now)
                // If we're already in day view and it's today, just scroll to current time
                if (viewMode === 'day' && isToday(now.toISOString().split('T')[0]) && dayViewRef.current) {
                  const currentHour = now.getHours()
                  const scrollPosition = (currentHour * 80) - (dayViewRef.current.clientHeight / 2) + 40
                  dayViewRef.current.scrollTo({
                    top: Math.max(0, scrollPosition),
                    behavior: 'smooth'
                  })
                }
              }}
              className={cn(
                "text-sm font-medium",
                isToday(selectedDate.toISOString().split('T')[0]) ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground hover:bg-muted/80 border-0"
              )}
            >
              {t('controlCenter.calendar.today') || 'Today'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={prevPeriod}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[200px] text-center">
              {getPeriodLabel()}
            </h2>
            <Button variant="ghost" size="sm" onClick={nextPeriod}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 flex justify-end">
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={(value: string) => value && setViewMode(value as CalendarViewMode)}
            >
              <ToggleGroupItem value="year" aria-label="Year view" className="px-3">
                {t('controlCenter.calendar.year') || 'Year'}
              </ToggleGroupItem>
              <ToggleGroupItem value="month" aria-label="Month view" className="px-3">
                {t('controlCenter.calendar.month') || 'Month'}
              </ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="Week view" className="px-3">
                {t('controlCenter.calendar.week') || 'Week'}
              </ToggleGroupItem>
              <ToggleGroupItem value="day" aria-label="Day view" className="px-3">
                {t('controlCenter.calendar.day') || 'Day'}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="p-6 md:p-8 flex-1">
          {renderCalendarContent()}
        </div>
    </div>
  )
} 