"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface Chip {
  icon?: ReactNode
  imageUrl?: string | null
  label: string
}

interface PdpMetricChipsProps {
  chips: (Chip | null | undefined | false)[]
  className?: string
  chipClassName?: string
}

export function PdpMetricChips({ chips, className, chipClassName }: PdpMetricChipsProps) {
  const validChips = chips.filter(Boolean) as Chip[]
  
  if (validChips.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-2 sm:gap-3", className)}>
      {validChips.map((chip, i) => (
        <div 
          key={i} 
          className={cn(
            "inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium",
            chipClassName || "bg-muted/50 border text-muted-foreground"
          )}
        >
          {chip.imageUrl ? (
            <img src={chip.imageUrl} alt="" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover shrink-0" />
          ) : chip.icon ? (
            <span className="shrink-0">{chip.icon}</span>
          ) : null}
          <span>{chip.label}</span>
        </div>
      ))}
    </div>
  )
}
