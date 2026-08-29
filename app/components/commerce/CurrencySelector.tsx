"use client"

import { useMemo } from "react"
import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { currencyFlag } from "@/app/lib/locale-currency"

export function CurrencySelector({ className, storeCurrency: propStoreCurrency }: { className?: string, storeCurrency?: string }) {
  const { mode, setMode, localCurrency, displayCurrency, rates, storeCurrency: contextStoreCurrency } = useDisplayCurrency()
  const { t } = useLocalization()

  const storeCurrency = propStoreCurrency || contextStoreCurrency || 'USD'

  const activeFlag = currencyFlag(displayCurrency)

  const otherCurrencies = useMemo(() => {
    const set = new Set<string>()
    set.add('USD') // Base currency is always available if we have rates
    Object.keys(rates).forEach(c => set.add(c))
    set.delete(localCurrency)
    set.delete(storeCurrency)
    return Array.from(set).sort()
  }, [rates, localCurrency, storeCurrency])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className}>
          <span className="text-base leading-none" aria-hidden>
            {activeFlag}
          </span>
          <span className="sr-only">{t('commerce.currency.change') || 'Change currency'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => setMode('local')}
          className={mode === 'local' ? "font-semibold bg-gray-100 dark:bg-gray-800" : undefined}
        >
          <span className="mr-2" aria-hidden>{currencyFlag(localCurrency)}</span>
          {t('commerce.currency.local') || 'Local'} ({localCurrency})
        </DropdownMenuItem>
        
        {localCurrency !== storeCurrency && (
          <DropdownMenuItem
            onClick={() => setMode('store')}
            className={mode === 'store' ? "font-semibold bg-gray-100 dark:bg-gray-800" : undefined}
          >
            <span className="mr-2" aria-hidden>{currencyFlag(storeCurrency)}</span>
            Store ({storeCurrency})
          </DropdownMenuItem>
        )}

        {otherCurrencies.length > 0 && <DropdownMenuSeparator />}
        
        {otherCurrencies.length > 0 && (
          <ScrollArea className="h-64">
            {otherCurrencies.map(currency => (
              <DropdownMenuItem
                key={currency}
                onClick={() => setMode(currency)}
                className={mode === currency ? "font-semibold bg-gray-100 dark:bg-gray-800" : undefined}
              >
                <span className="mr-2" aria-hidden>{currencyFlag(currency)}</span>
                {currency}
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

