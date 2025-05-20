import { useState, useEffect } from 'react'

interface CurrentTimeState {
  currentDate: Date
  currentTime: Date
  isToday: (date: Date | string) => boolean
  isSameDay: (date1: Date | string, date2: Date | string) => boolean
  getCurrentTimePosition: () => number
}

export function useCurrentTime(): CurrentTimeState {
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    // Update every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const isToday = (date: Date | string): boolean => {
    const compareDate = typeof date === 'string' ? new Date(date) : date
    const today = currentTime
    
    return (
      compareDate.getDate() === today.getDate() &&
      compareDate.getMonth() === today.getMonth() &&
      compareDate.getFullYear() === today.getFullYear()
    )
  }

  const isSameDay = (date1: Date | string, date2: Date | string): boolean => {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2

    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    )
  }

  const getCurrentTimePosition = (): number => {
    const hours = currentTime.getHours()
    const minutes = currentTime.getMinutes()
    // Calculate position based on 80px per hour (matches the calendar grid)
    return (hours + minutes / 60) * 80
  }

  return {
    currentDate: currentTime,
    currentTime,
    isToday,
    isSameDay,
    getCurrentTimePosition
  }
} 