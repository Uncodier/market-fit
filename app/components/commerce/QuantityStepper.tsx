"use client"

import { Button } from "@/app/components/ui/button"
import { Minus, Plus } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  quantity: number
  onChange: (quantity: number) => void
  min: number
  canIncrease: boolean
  compact?: boolean
}

export function QuantityStepper({ label, quantity, onChange, min, canIncrease, compact }: Props) {
  const { t } = useLocalization()
  const buttonClass = cn(
    "text-foreground disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
    compact && "h-8 w-8",
  )
  const iconClass = cn("[&>svg]:stroke-2", compact ? "h-3 w-3" : "h-4 w-4")

  return (
    <div role="group" aria-label={label} className={cn("flex shrink-0 items-center", compact ? "gap-2" : "gap-4")}>
      <Button type="button" variant="outline" size="icon" className={buttonClass}
        aria-label={t("commerce.cart.decreaseQuantity")} disabled={quantity <= min} onClick={() => onChange(quantity - 1)}>
        <Minus className={iconClass} aria-hidden="true" />
      </Button>
      <span aria-live="polite" className={cn("tabular-nums", compact && "min-w-[1.25rem] text-center text-sm font-medium")}>{quantity}</span>
      <Button type="button" variant="outline" size="icon" className={buttonClass}
        aria-label={t("commerce.cart.increaseQuantity")} disabled={!canIncrease} onClick={() => onChange(quantity + 1)}>
        <Plus className={iconClass} aria-hidden="true" />
      </Button>
    </div>
  )
}