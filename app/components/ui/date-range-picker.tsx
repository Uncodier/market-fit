"use client"

import * as React from "react"
import { CalendarIcon } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { cn } from "@/lib/utils"

export function CalendarDateRangePicker({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Button
        variant="outline"
        className={cn(
          "w-[240px] justify-start text-left font-normal",
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        <span>Last 30 days</span>
      </Button>
    </div>
  )
} 