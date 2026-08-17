"use client"

import { format } from "date-fns"
import { es, enUS } from "date-fns/locale"
import { Button } from "@/app/components/ui/button"
import { Minus, Plus } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { cn } from "@/lib/utils"
import {
  cartLineExtendedTotal,
  cartLineKey,
  cartLineUnitTotal,
} from "@/app/pos/cart-line-utils"
import type { PosCartItem } from "./CartPanel"

type Props = {
  cart: PosCartItem[]
  selectedCartItemId: string | null
  setSelectedCartItemId: (id: string | null) => void
  updateQty: (id: string, delta: number) => void
  money: (n: number) => string
}

function formatReservationTime(iso: string, dateLocale: typeof enUS) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return format(date, "MMM d, h:mm a", { locale: dateLocale })
}

export function PosCartLines({
  cart,
  selectedCartItemId,
  setSelectedCartItemId,
  updateQty,
  money,
}: Props) {
  const { locale } = useLocalization()
  const dateLocale = locale === "es" ? es : enUS

  return (
    <div className="space-y-3">
      {cart.map((item) => {
        const lineKey = cartLineKey(item)
        const modifiers = item.modifiers || []
        const unitTotal = cartLineUnitTotal(item)
        const reservationLabel = item.reservationStart
          ? formatReservationTime(item.reservationStart, dateLocale)
          : null
        return (
          <div key={lineKey} className="space-y-1">
            <div
              className={cn(
                "flex items-center gap-3 p-0 pr-3 rounded-lg border shadow-sm min-h-14 cursor-pointer transition-all",
                selectedCartItemId === lineKey
                  ? "bg-primary/10 dark:bg-primary/20"
                  : "bg-card hover:border-primary/50",
              )}
              onClick={() => setSelectedCartItemId?.(lineKey)}
            >
              <div className="h-14 aspect-square rounded-l-lg bg-muted/30 overflow-hidden flex-shrink-0 self-stretch">
                <img
                  src={resolveItemImage(item, "thumb")}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 py-1.5">
                <h4 className="font-medium text-sm text-foreground truncate">
                  {item.name}
                </h4>
                {reservationLabel ? (
                  <div className="text-muted-foreground text-xs mt-0.5 truncate">
                    {reservationLabel}
                  </div>
                ) : null}
                <div className="text-muted-foreground text-xs mt-0.5">
                  {money(unitTotal)}
                  {item.cartDiscountPercent
                    ? ` · −${item.cartDiscountPercent}%`
                    : ""}
                  {modifiers.length > 0
                    ? ` · ${money(cartLineExtendedTotal(item))}`
                    : ""}
                </div>
              </div>
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={() => updateQty(lineKey, -1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-4 text-center text-sm font-medium">
                  {item.cartQty}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={() => updateQty(lineKey, 1)}
                  disabled={Boolean(item.reservationStart) && item.cartQty >= (item.reservationAvailableQty || 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {modifiers.length > 0 && (
              <div className="ml-12 space-y-0.5">
                {modifiers.map((m) => (
                  <div
                    key={`${lineKey}-${m.catalogItemId}`}
                    className="text-xs text-muted-foreground flex justify-between gap-2 pr-3"
                  >
                    <span className="truncate">
                      + {m.name}
                      {m.cartQty > 1 ? ` ×${m.cartQty}` : ""}
                    </span>
                    <span className="flex-shrink-0">
                      {money(m.cartPrice * m.cartQty * item.cartQty)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
