"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface DelayTimerProps {
  delayTimer: string | number // ISO string or timestamp
  className?: string
  size?: number // diameter of the circle
}

export function DelayTimer({ delayTimer, className, size = 32 }: DelayTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [totalDuration, setTotalDuration] = useState<number>(0)

  useEffect(() => {
    // Convert delayTimer to timestamp
    const endTime = typeof delayTimer === 'string' ? new Date(delayTimer).getTime() : delayTimer
    const startTime = endTime - (2 * 60 * 60 * 1000) // 2 hours before
    const currentTime = Date.now()
    
    setTotalDuration(endTime - startTime)
    
    const updateTimer = () => {
      const now = Date.now()
      const remaining = Math.max(0, endTime - now)
      setTimeRemaining(remaining)
      
      if (remaining <= 0) {
        return
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [delayTimer])

  if (timeRemaining <= 0) {
    return null
  }

  // Calculate progress (0 to 1)
  const progress = Math.max(0, Math.min(1, (totalDuration - timeRemaining) / totalDuration))
  
  // Calculate stroke-dasharray for the progress circle
  const radius = (size - 4) / 2 // Account for stroke width
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = circumference
  const strokeDashoffset = circumference * (1 - progress)

  // Format time remaining
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60))
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000)
  
  const timeText = hours > 0 
    ? `${hours}h ${minutes}m` 
    : minutes > 0 
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`

  return (
    <div className={cn("relative inline-block", className)}>
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        style={{ 
          filter: 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.1))',
        }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(59, 130, 246, 0.1)"
          strokeWidth="2"
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgb(59, 130, 246)"
          strokeWidth="2"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-in-out"
        />
      </svg>
      
      {/* Tooltip on hover */}
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
        Sending in {timeText}
      </div>
    </div>
  )
} 