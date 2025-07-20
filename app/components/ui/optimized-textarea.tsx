"use client"

import React, { forwardRef, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"

interface OptimizedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onOptimizedChange?: (value: string, e: React.ChangeEvent<HTMLTextAreaElement>) => void
}

export const OptimizedTextarea = forwardRef<HTMLTextAreaElement, OptimizedTextareaProps>(
  ({ className, onOptimizedChange, onChange, style, ...props }, ref) => {
    // Simplified styles - remove optimizations that might interfere
    const baseStyle = useMemo(() => ({
      resize: 'none' as const,
      ...style
    }), [style])

    // CRITICAL: Simple handler to ensure no characters are lost
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Call original onChange first to ensure immediate state update
      if (onChange) {
        onChange(e)
      }
      
      // Call optimized handler after if provided
      if (onOptimizedChange) {
        const value = e.target.value
        onOptimizedChange(value, e)
      }
    }, [onChange, onOptimizedChange])

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onChange={handleChange}
        style={baseStyle}
        {...props}
      />
    )
  }
)

OptimizedTextarea.displayName = "OptimizedTextarea" 