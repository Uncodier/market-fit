import { cn } from "@/lib/utils"
import type { useCurrentTime } from "@/app/hooks/useCurrentTime"
import { CurrentTimeIndicator } from "./CurrentTimeIndicator"
import { useLocalization } from "@/app/context/LocalizationContext"
import { TaskItem, type ExtendedTask, type CalendarViewMode } from "./task-calendar-item"

// Get week dates starting from the current date's week
export const getWeekDates = (date: Date) => {
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

export function TaskCalendarViews({ tasks, selectedDate, viewMode, onTaskClick, time }: {
  tasks: ExtendedTask[]
  selectedDate: Date
  viewMode: CalendarViewMode
  onTaskClick: (task: ExtendedTask, order?: ExtendedTask[]) => void
  time: ReturnType<typeof useCurrentTime>
}) {
  const { t } = useLocalization()
  const { currentTime, isToday, getCurrentTimePosition } = time

  // Group tasks by date
  const tasksByDate = tasks.reduce((acc, task) => {
    const dateStr = task.scheduled_date.split('T')[0]
    if (!acc[dateStr]) {
      acc[dateStr] = []
    }
    acc[dateStr].push(task)
    return acc
  }, {} as Record<string, ExtendedTask[]>)

  const forDates = (dates: string[]) => dates.flatMap(date => tasksByDate[date] || [])

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
    const calendarDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = []

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
      <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
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
          const dayTasks = tasksByDate[dateStr] || []
          const isCurrentDay = isToday(dateStr)

          return (
            <div
              key={`${dateStr}-${index}`}
              className={cn(
                "bg-background p-2 relative min-h-[120px]",
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
                {dayTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onClick={task => onTaskClick(task, forDates(calendarDays.map(day => day.dateStr)))}
                    showTime={true}
                    showSerialId={true}
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
      <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
        {/* Week day headers */}
        {weekDates.map((date) => {
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
          const dayTasks = tasksByDate[dateStr] || []
          const isCurrentDay = isToday(date)

          return (
            <div
              key={dateStr}
              className={cn(
                "bg-background relative",
                isCurrentDay && "bg-accent/5"
              )}
            >
              <div className="p-2 space-y-2">
                {dayTasks.map((task) => (
                  <TaskItem key={task.id} task={task} showTime showSerialId
                    onClick={task => onTaskClick(task, forDates(weekDates.map(date => date.toISOString().split('T')[0])))} />
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
    const dayTasks = tasksByDate[dateStr] || []
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const isCurrentDay = isToday(selectedDate)
    const timePosition = getCurrentTimePosition()

    // Group tasks by hour
    const tasksByHour = hours.reduce((acc, hour) => {
      acc[hour] = dayTasks.filter(task => {
        const taskDate = new Date(task.scheduled_date)
        return taskDate.getHours() === hour
      })
      return acc
    }, {} as Record<number, ExtendedTask[]>)

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

    return (
      <div className="bg-background rounded-lg">
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
                data-calendar-current-hour={isCurrentHourBlock(hour) || undefined}
                className={cn(
                  "h-20 border-b border-border p-2 relative group transition-colors",
                  !isHourPassed(hour) && "hover:bg-accent/5",
                  isCurrentHourBlock(hour) && "bg-accent/20 dark:bg-accent/30"
                )}
              >
                {tasksByHour[hour]?.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onClick={task => onTaskClick(task, hours.flatMap(hour => tasksByHour[hour]))}
                    showTime={true}
                    showSerialId={true}
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
    const tasksByMonth: ExtendedTask[][] = months.map(() => [])
    for (const task of tasks) {
      const date = new Date(task.scheduled_date)
      if (date.getFullYear() === selectedDate.getFullYear()) tasksByMonth[date.getMonth()].push(task)
    }
    const today = new Date()

    return (
      <div className="grid grid-cols-4 gap-px bg-muted rounded-lg overflow-hidden">
        {months.map((month) => {
          const monthTasks = tasksByMonth[month]

          const visibleTasks = monthTasks.slice(0, 15)
          const remainingTasks = monthTasks.length - 15
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
                {visibleTasks.length > 0 ? (
                  <>
                    <div className="flex-1 space-y-2">
                      {visibleTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onClick={task => onTaskClick(task, tasksByMonth.flatMap(items => items.slice(0, 15)))}
                          showDay={true}
                          showSerialId={true}
                        />
                      ))}
                    </div>
                    {remainingTasks > 0 && (
                      <div className="text-xs text-muted-foreground text-center mt-3 py-1 bg-muted/50 rounded-md">
                        {t('controlCenter.calendar.moreTasks')?.replace('{count}', remainingTasks.toString()) || `+${remainingTasks} more tasks`}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-xs text-muted-foreground text-center py-8 px-4 w-full">
                      {t('controlCenter.calendar.noTasks') || 'No tasks'}
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

  return renderCalendarContent()
}
