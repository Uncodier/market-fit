"use client"

import { format } from "date-fns"
import { es, enUS } from "date-fns/locale"
import { Button } from "@/app/components/ui/button"
import { Minus, Plus } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { cn } from "@/lib/utils"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
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
}: Props) {
  const { locale, t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
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
                <div className="text-muted-foreground text-xs mt-0.5">
                  {formatPrice(unitTotal, item.currency || "USD")}
                  {item.cartDiscountPercent
                    ? ` · −${item.cartDiscountPercent}%`
                    : ""}
                  {modifiers.length > 0
                    ? ` · ${formatPrice(cartLineExtendedTotal(item), item.currency || "USD")}`
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
            {(reservationLabel || modifiers.length > 0) && (
              <div className="bg-muted/30 border-t px-3 py-2 shadow-inner space-y-2">
                {reservationLabel ? (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      {t("pos.cart.reservation") || "Reservation"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {reservationLabel}
                    </div>
                  </div>
                ) : null}
                {modifiers.length > 0 ? (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      {t("pos.modifiers.title") || "Extras"}
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
                            <span>{m.cartQty > 1 ? `${m.cartQty} × ` : ""}{formatPrice(m.cartPrice, item.currency || "USD")}</span>
                            <span className="font-medium text-foreground w-12 text-right">{formatPrice(m.cartPrice * m.cartQty * item.cartQty, item.currency || "USD")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
