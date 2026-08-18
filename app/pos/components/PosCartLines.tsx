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
  const { locale, t } = useLocalization()
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
          <div key={lineKey} className={cn("rounded-lg border shadow-sm transition-all overflow-hidden", selectedCartItemId === lineKey ? "border-primary/50" : "hover:border-primary/50")}>
            <div
              className={cn(
                "flex items-center gap-3 p-0 pr-3 min-h-14 cursor-pointer",
                selectedCartItemId === lineKey
                  ? "bg-primary/5 dark:bg-primary/10"
                  : "bg-card",
              )}
              onClick={() => setSelectedCartItemId?.(lineKey)}
            >
              <div className="w-16 h-[4.5rem] bg-muted/30 overflow-hidden flex-shrink-0 self-start mt-0.5 ml-0.5 rounded-md">
                <img
                  src={resolveItemImage(item, "thumb")}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 py-2.5 flex flex-col justify-center">
                {((item as any)._parent?.name && (item as any)._parent.name !== item.name) || (item as any).parent?.name || (item as any).parent_name ? (
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 truncate">
                    {(item as any)._parent?.name && (item as any)._parent.name !== item.name ? (item as any)._parent.name : ((item as any).parent?.name || (item as any).parent_name)}
                  </div>
                ) : null}
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
              <div className="bg-muted/30 border-t px-3 py-2 shadow-inner">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  {(t as any)?.('pos.modifiers.title') || 'Extras'}
                </div>
                <div className="space-y-1">
                  {modifiers.map((m) => (
                    <div
                      key={`${lineKey}-${m.catalogItemId}`}
                      className="text-xs text-muted-foreground flex justify-between gap-2"
                    >
                      <div className="flex gap-1.5 items-center truncate">
                        <span>+</span>
                        <span className="truncate">{m.name}</span>
                      </div>
                      <div className="flex gap-3 items-center flex-shrink-0">
                        <span>{m.cartQty > 1 ? `${m.cartQty} × ` : ""}{money(m.cartPrice)}</span>
                        <span className="font-medium text-foreground w-12 text-right">{money(m.cartPrice * m.cartQty * item.cartQty)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
