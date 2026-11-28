import { Badge } from "@/app/components/ui/badge"
import { cn } from "@/lib/utils"
import type { useCurrentTime } from "@/app/hooks/useCurrentTime"
import { CurrentTimeIndicator } from "@/app/control-center/components/CurrentTimeIndicator"
import type { RecordItem } from "../actions"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { OpenRecordFromView } from "../lib/record-navigation"
import type { SaveRecordProperty } from "../lib/record-properties"
import { ArrowUpRight } from "@/app/components/ui/icons"
import { RecordPropertiesButton } from "./RecordPropertyEditor"
import { useRecordCardMembers, type RecordCardMembers } from "../hooks/useRecordCardMembers"
import { RecordMemberStack } from "./RecordMemberStack"
import { useSite } from "@/app/context/SiteContext"

export type CalendarViewMode = "year" | "month" | "week" | "day"

export function getWeekDates(date: Date) {
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

function RecordStatusDot({ status }: { status: string }) {
  return (
    <div className={cn(
      "w-2 h-2 shrink-0 rounded-full",
      (status === 'published' || status === 'active') && "bg-green-500",
      status === 'draft' && "bg-yellow-500",
      status === 'archived' && "bg-gray-500",
      !['published', 'active', 'draft', 'archived'].includes(status || '') && "bg-blue-500"
    )} />
  )
}

function RecordCalendarItem({ record, members, onClick, onSaveProperty, showDay, showTime }: {
  record: RecordItem
  members: RecordCardMembers
  onClick: (record: RecordItem) => void
  onSaveProperty?: SaveRecordProperty
  showDay?: boolean
  showTime?: boolean
}) {
  const recordDate = record.created_at ? new Date(record.created_at) : new Date()
  const timeStr = recordDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const dayStr = recordDate.getDate().toString()

  const status = record.status || 'draft'

  return (
    <div className="group/record flex min-w-0 items-center gap-0.5">
      <button type="button" onClick={() => onClick(record)} title="Open record" className="min-w-0 flex-1 rounded-md">
      <Badge
        variant="outline"
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-xs w-full px-1.5",
          (status === 'published' || status === 'active') && "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
          status === 'draft' && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
          status === 'archived' && "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
          !['published', 'active', 'draft', 'archived'].includes(status) && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left" title={record.title}>{record.title}</span>
        <RecordMemberStack record={record} members={members} compact />
        {record.category?.name && (
          <span className="hidden xl:inline text-[10px] text-muted-foreground bg-background/50 px-1 py-0.5 rounded truncate max-w-[60px]">
            {record.category.name}
          </span>
        )}
        {(showDay || showTime) && (
          <span className="shrink-0 text-muted-foreground text-[10px]">
            {showDay && dayStr}
            {showTime && timeStr}
          </span>
        )}
        <RecordStatusDot status={status} />
        <ArrowUpRight aria-hidden className="hidden 2xl:block size-3 shrink-0 [@media(hover:hover)]:opacity-0 group-hover/record:opacity-100 group-focus-within/record:opacity-100" />
      </Badge>
      </button>
      {onSaveProperty && <RecordPropertiesButton record={record} onSave={onSaveProperty} includeMetadata compact />}
    </div>
  )
}

export function RecordsCalendarViews({ records, selectedDate, viewMode, onRecordClick, onSaveProperty, time }: {
  records: RecordItem[]
  selectedDate: Date
  viewMode: CalendarViewMode
  onRecordClick: OpenRecordFromView
  onSaveProperty?: SaveRecordProperty
  time: ReturnType<typeof useCurrentTime>
}) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const members = useRecordCardMembers(records, currentSite?.id)
  const { currentTime, isToday, getCurrentTimePosition } = time

  // Group records by date
  const recordsByDate = records.reduce((acc, record) => {
    if (!record.created_at) return acc
    const dateStr = record.created_at.split('T')[0]
    if (!acc[dateStr]) {
      acc[dateStr] = []
    }
    acc[dateStr].push(record)
    return acc
  }, {} as Record<string, RecordItem[]>)
  const idsForDates = (dates: string[]) => dates.flatMap(date => (recordsByDate[date] || []).map(record => record.id))

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
          const dayRecords = recordsByDate[dateStr] || []
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
                {dayRecords.map((record) => (
                  <RecordCalendarItem
                    members={members}
                    key={record.id}
                    record={record}
                    onSaveProperty={onSaveProperty}
                    onClick={record => onRecordClick(record.id, idsForDates(calendarDays.map(day => day.dateStr)))}
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
                {[
                  t('common.days.short.sun') || 'Sun',
                  t('common.days.short.mon') || 'Mon',
                  t('common.days.short.tue') || 'Tue',
                  t('common.days.short.wed') || 'Wed',
                  t('common.days.short.thu') || 'Thu',
                  t('common.days.short.fri') || 'Fri',
                  t('common.days.short.sat') || 'Sat'
                ][date.getDay()]}
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
          const dayRecords = recordsByDate[dateStr] || []
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
                {dayRecords.map(record => (
                  <RecordCalendarItem
                    members={members}
                    key={record.id}
                    record={record}
                    onSaveProperty={onSaveProperty}
                    onClick={record => onRecordClick(record.id, idsForDates(weekDates.map(date => date.toISOString().split('T')[0])))}
                    showTime={true}
                  />
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
    const dayRecords = recordsByDate[dateStr] || []
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const isCurrentDay = isToday(selectedDate)
    const timePosition = getCurrentTimePosition()

    // Group records by hour
    const recordsByHour = hours.reduce((acc, hour) => {
      acc[hour] = dayRecords.filter(record => {
        if (!record.created_at) return false
        const recordDate = new Date(record.created_at)
        return recordDate.getHours() === hour
      })
      return acc
    }, {} as Record<number, RecordItem[]>)

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

          {/* Records column */}
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
                {recordsByHour[hour]?.map((record) => (
                  <RecordCalendarItem
                    members={members}
                    key={record.id}
                    record={record}
                    onSaveProperty={onSaveProperty}
                    onClick={record => onRecordClick(record.id, hours.flatMap(hour => recordsByHour[hour].map(item => item.id)))}
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
    const monthRecordsByMonth: RecordItem[][] = months.map(() => [])
    records.forEach(record => {
      if (!record.created_at) return
      const recordDate = new Date(record.created_at)
      if (recordDate.getFullYear() === selectedDate.getFullYear()) {
        monthRecordsByMonth[recordDate.getMonth()].push(record)
      }
    })

    return (
      <div className="grid grid-cols-4 gap-px bg-muted rounded-lg overflow-hidden">
        {months.map((month) => {
          const monthRecords = monthRecordsByMonth[month]

          const visibleRecords = monthRecords.slice(0, 15)
          const remainingRecords = monthRecords.length - 15
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
                {visibleRecords.length > 0 ? (
                  <>
                    <div className="flex-1 space-y-2">
                      {visibleRecords.map((record) => (
                        <RecordCalendarItem
                          members={members}
                          key={record.id}
                          record={record}
                          onSaveProperty={onSaveProperty}
                          onClick={record => onRecordClick(record.id, monthRecordsByMonth.flatMap(items => items.slice(0, 15).map(item => item.id)))}
                          showDay={true}
                        />
                      ))}
                    </div>
                    {remainingRecords > 0 && (
                      <div className="text-xs text-muted-foreground text-center mt-3 py-1 bg-muted/50 rounded-md">
                        {t('records.calendar.moreRecords')?.replace('{count}', remainingRecords.toString()) || `+${remainingRecords} more records`}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-xs text-muted-foreground text-center py-8 px-4 w-full">
                      {t('records.calendar.noRecords') || 'No records'}
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

  switch (viewMode) {
    case "month": return renderMonthView()
    case "week": return renderWeekView()
    case "day": return renderDayView()
    case "year": return renderYearView()
  }
}
