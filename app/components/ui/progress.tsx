"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

interface ProgressSegment {
  label: string
  /** Width as a percentage of the track. Segment values should total at most 100. */
  value: number
  className?: string
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string
    segments?: ProgressSegment[]
  }
>(({ className, value, indicatorClassName, segments, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={value}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      segments && "flex",
      className
    )}
    {...props}
  >
    {segments ? segments.map((segment) => (
      <ProgressPrimitive.Indicator
        key={segment.label}
        title={segment.label}
        className={cn("h-full shrink-0 transition-all", segment.className)}
        style={{ width: `${segment.value}%` }}
      />
    )) : (
      <ProgressPrimitive.Indicator
        className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClassName)}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    )}
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress } 