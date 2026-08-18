import React from "react"
import { format } from "date-fns"
import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import { X, CalendarIcon, Clock } from "@/app/components/ui/icons"
import { resolveItemImage } from "@/app/lib/image-utils"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  cartLineExtendedTotal,
  cartLineKey,
  cartLineUnitTotal,
  type CartModifier,
} from "@/app/commerce/cart-modifiers"

interface CartItemProps {
  item: any
  updateQty: (id: string, delta: number) => void
  showSeller?: boolean
}

export function CartItem({ item, updateQty, showSeller = false }: CartItemProps) {
  const { formatPrice } = useDisplayCurrency()
  const { t } = useLocalization()
  const key = cartLineKey(item)
  const modifiers: CartModifier[] = Array.isArray(item.modifiers) ? item.modifiers : []
  const unit = cartLineUnitTotal(item)
  const currency = item.currency || "USD"

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="relative w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden flex-shrink-0">
          <img src={resolveItemImage(item, "card")} alt={item.name} className="absolute inset-0 h-full w-full object-cover object-center" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                {((item._parent?.name && item._parent.name !== item.name) || item.parent?.name || item.parent_name) && (
                  <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5 truncate leading-tight">
                    {item._parent?.name && item._parent.name !== item.name ? item._parent.name : (item.parent?.name || item.parent_name)}
                  </div>
                )}
                <h4 className="font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">{item.name}</h4>
              </div>
              <button onClick={() => updateQty(key, -item.cartQty)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            {showSeller && item.site?.name ? (
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5 truncate mt-1 leading-tight">{item.site.name}</p>
            ) : null}
            <div className="text-gray-500 dark:text-gray-400 text-sm mt-1 font-medium">
              {formatPrice(unit, currency)}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-lg hover:bg-gray-200 dark:hover:bg-gray-700" onClick={() => updateQty(key, -1)}>
                -
              </Button>
              <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-gray-100">{item.cartQty}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 rounded-md bg-white dark:bg-gray-700 shadow-sm text-lg hover:bg-gray-50 dark:hover:bg-gray-600" 
                onClick={() => updateQty(key, 1)}
                disabled={Boolean(item.reservationStart) && item.cartQty >= (item.reservationAvailableQty || 1)}
              >
                +
              </Button>
            </div>
            <div className="text-right shrink-0">
              <span className="font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {formatPrice(cartLineExtendedTotal(item), currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {modifiers.length > 0 && (
        <div className="bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 px-4 py-3 shadow-inner">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            {(t as any)?.('pos.modifiers.title') || 'Extras'}
          </div>
          <div className="space-y-1.5">
            {modifiers.map((m) => (
              <div
                key={`${m.groupId}:${m.catalogItemId}`}
                className="text-xs text-gray-600 dark:text-gray-300 flex justify-between gap-2"
              >
                <div className="flex gap-1.5 items-center truncate">
                  <span className="text-gray-400">+</span>
                  <span className="truncate">{m.name}</span>
                </div>
                <div className="flex gap-3 items-center flex-shrink-0">
                  <span>{m.cartQty > 1 ? `${m.cartQty} × ` : ""}{formatPrice(m.cartPrice, currency)}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 w-16 text-right">
                    {formatPrice(m.cartPrice * m.cartQty * item.cartQty, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {item.reservationStart && (
        <div className="px-4 pb-3 pt-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20">
          <Link 
            href={`/shop/${item.site?.slug || item.site_id}/${item.id}/book`}
            className="flex items-center justify-between hover:bg-white dark:hover:bg-gray-800 p-1.5 -mx-1.5 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
              <CalendarIcon className="w-3.5 h-3.5 opacity-70 shrink-0" />
              <span className="truncate">
                {format(new Date(item.reservationStart), "MMM d, yyyy")}
              </span>
              <Clock className="w-3.5 h-3.5 opacity-70 shrink-0 ml-1" />
              <span className="truncate">
                {format(new Date(item.reservationStart), "h:mm a")}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors mr-1">
              {t("common.edit") || "Edit"}
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}
