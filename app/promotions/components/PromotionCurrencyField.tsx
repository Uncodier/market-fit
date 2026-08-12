"use client"

import { Label } from "@/app/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { COMMON_CURRENCIES } from "@/app/lib/currencies"
import { useLocalization } from "@/app/context/LocalizationContext"

type Props = {
  value: string
  onChange: (currency: string) => void
  id?: string
}

/** Currency override control (same options as catalog products). */
export function PromotionCurrencyField({ value, onChange, id = "promo-currency" }: Props) {
  const { t } = useLocalization()

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("catalog.pricing.currency") || "Currency"}</Label>
      <Select value={value || "USD"} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select currency..." />
        </SelectTrigger>
        <SelectContent>
          {COMMON_CURRENCIES.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              {currency.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
