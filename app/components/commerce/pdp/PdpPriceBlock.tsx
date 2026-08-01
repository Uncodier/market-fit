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
    <div className={cn("flex flex-col", className)}>
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
        <div className={cn("font-black tracking-tight", small ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl")}>
          {formatPrice(price || 0, currency)}
        </div>
        {isRecurring && (
          <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1 sm:mt-0">
            {t('pdp.perMonth') || 'PER MONTH'}
          </div>
        )}
      </div>
      {(!isRecurring && validityDays) && (
        <div className="mt-2 text-sm font-medium text-muted-foreground">
          {`${t('pdp.validFor') || 'Valid for'} ${validityDays} ${t('pdp.days') || 'days'}`}
        </div>
      )}
    </div>
  )
}
