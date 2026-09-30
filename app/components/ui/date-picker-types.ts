import type { ReactNode } from "react"

export type DateEventType = 'day' | 'week' | 'month' | 'year' | 'custom'
export type DateEventPeriod = 'past' | 'future' | 'current'
export type DatePickerMode = 'default' | 'task' | 'report' | 'calendar' | 'range'

export interface DateEvent {
  id?: string
  label: string
  value: Date
  endDate?: Date
  type: DateEventType
  period: DateEventPeriod
  disabled?: boolean
  disabledReason?: string
}

export interface DatePickerProps {
  date?: Date
  setDate: (date: Date) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  showEvents?: boolean
  events?: DateEvent[]
  customEvents?: boolean
  position?: "top" | "bottom" | "left" | "right"
  onRangeSelect?: (start: Date, end: Date) => void
  mode?: DatePickerMode
  endDate?: Date
  setEndDate?: (date: Date) => void
  rangeDisplay?: string
  /** Maximum inclusive calendar days; omitted means no range limit. */
  maxRangeDays?: number
  showTimePicker?: boolean
  timeFormat?: '12h' | '24h'
  trigger?: ReactNode
}