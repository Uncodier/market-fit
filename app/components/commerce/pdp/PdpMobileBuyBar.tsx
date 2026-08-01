"use client"

import { ReactNode } from "react"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { cn } from "@/lib/utils"

interface PdpMobileBuyBarProps {
  price: number
  isRecurring?: boolean
  validityDays?: number | null
  children: ReactNode // Usually the CTA button
  className?: string
}

export function PdpMobileBuyBar({ price, isRecurring, validityDays, children, className }: PdpMobileBuyBarProps) {
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 lg:hidden",
      "bg-background/80 backdrop-blur-xl border-t shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)]",
      "p-4 pb-safe", // Support iOS safe area
      className
    )}>
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <PdpPriceBlock 
          price={price} 
          isRecurring={isRecurring} 
          validityDays={validityDays}
          small={true}
          className="shrink-0"
        />
        <div className="flex-1 max-w-[200px] sm:max-w-xs">
          {children}
        </div>
      </div>
    </div>
  )
}
