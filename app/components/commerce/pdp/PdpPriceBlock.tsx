"use client"

import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

interface PdpPriceBlockProps {
  price: number
  currency?: string
  isRecurring?: boolean
  validityDays?: number | null
  className?: string
  small?: boolean
}

export function PdpPriceBlock({ price, currency = 'USD', isRecurring, validityDays, className, small = false }: PdpPriceBlockProps) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  
  return (
    <div className={cn("flex flex-col min-w-0", className)}>
      <div className={cn(
        "flex gap-1",
        small ? "flex-col items-start" : "flex-col sm:flex-row sm:items-baseline sm:gap-2"
      )}>
        <div className={cn(
          "font-black tracking-tight truncate",
          small ? "text-lg leading-tight" : "text-4xl sm:text-5xl"
        )}>
          {formatPrice(price || 0, currency)}
        </div>
        {isRecurring && (
          <div className={cn(
            "font-bold text-muted-foreground uppercase tracking-widest",
            small ? "text-[10px] leading-none" : "text-sm mt-1 sm:mt-0"
          )}>
            {t('pdp.perMonth') || 'PER MONTH'}
          </div>
        )}
      </div>
      {(!isRecurring && validityDays) && (
        <div className={cn(
          "font-medium text-muted-foreground",
          small ? "mt-0.5 text-xs" : "mt-2 text-sm"
        )}>
          {`${t('pdp.validFor') || 'Valid for'} ${validityDays} ${t('pdp.days') || 'days'}`}
        </div>
      )}
    </div>
  )
}
