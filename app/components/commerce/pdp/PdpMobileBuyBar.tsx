"use client"

import { ReactNode } from "react"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { cn } from "@/lib/utils"

interface PdpMobileBuyBarProps {
  price?: number | null
  isRecurring?: boolean
  validityDays?: number | null
  children: ReactNode // Usually the CTA button
  className?: string
  /** When set and price is 0, show this label instead of $0 */
  emptyPriceLabel?: string
  /**
   * Full-width CTA row (no separate price column).
   * Use when the action already includes the amount (e.g. "Checkout • $20").
   */
  fullWidthCta?: boolean
}

export function PdpMobileBuyBar({
  price = 0,
  isRecurring,
  validityDays,
  children,
  className,
  emptyPriceLabel,
  fullWidthCta = false,
}: PdpMobileBuyBarProps) {
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 lg:hidden",
      "bg-background/80 backdrop-blur-xl border-t shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)]",
      "p-4 pb-safe", // Support iOS safe area
      className
    )}>
      {fullWidthCta ? (
        <div className="max-w-7xl mx-auto w-full">{children}</div>
      ) : (
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          {price > 0 || !emptyPriceLabel ? (
            <PdpPriceBlock
              price={price}
              isRecurring={isRecurring}
              validityDays={validityDays}
              small={true}
              className="shrink-0"
            />
          ) : (
            <div className="shrink-0 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {emptyPriceLabel}
            </div>
          )}
          <div className="flex-1 min-w-0 max-w-[200px] sm:max-w-xs">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
