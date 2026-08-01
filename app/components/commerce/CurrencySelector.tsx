"use client"

import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { currencyFlag } from "@/app/lib/locale-currency"

export function CurrencySelector({ className }: { className?: string }) {
  const { mode, setMode, localCurrency } = useDisplayCurrency()
  const { t } = useLocalization()

  const localFlag = currencyFlag(localCurrency)
  const usdFlag = currencyFlag('USD')
  const activeFlag = mode === 'usd' ? usdFlag : localFlag

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
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setMode('local')}
          className={mode === 'local' ? "font-semibold" : undefined}
        >
          <span className="mr-2" aria-hidden>{localFlag}</span>
          {t('commerce.currency.local') || 'Local'} ({localCurrency})
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setMode('usd')}
          className={mode === 'usd' ? "font-semibold" : undefined}
        >
          <span className="mr-2" aria-hidden>{usdFlag}</span>
          {t('commerce.currency.usd') || 'USD'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
