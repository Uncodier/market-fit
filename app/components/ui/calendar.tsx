"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "@/app/components/ui/icons"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"

export type CalendarProps = React.HTMLAttributes<HTMLDivElement> & {
  showOutsideDays?: boolean
}

function Calendar({
  className,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <div className={cn("p-3", className)} {...props}>
      <div className="text-center text-sm text-muted-foreground">
        Calendario no disponible
      </div>
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
