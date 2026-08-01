import React from "react"
import { Button } from "@/app/components/ui/button"
import { X } from "@/app/components/ui/icons"
import { resolveItemImage } from "@/app/lib/image-utils"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

interface CartItemProps {
  item: any
  updateQty: (id: string, delta: number) => void
  showSeller?: boolean
}

export function CartItem({ item, updateQty, showSeller = false }: CartItemProps) {
  const { formatPrice } = useDisplayCurrency()

  return (
    <div className="flex gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
         <img src={resolveItemImage(item)} alt={item.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start gap-2">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">{item.name}</h4>
            <button onClick={() => updateQty(item.id, -item.cartQty)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          {showSeller && item.site?.name ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.site.name}</p>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-sm mt-1 font-medium">
              {formatPrice(item.cartPrice, item.currency || 'USD')}
            </div>
          )}
        </div>
        <div className="flex items-center mt-2">
          <div className="flex-1" />
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-lg hover:bg-gray-200 dark:hover:bg-gray-700" onClick={() => updateQty(item.id, -1)}>
              -
            </Button>
            <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-gray-100">{item.cartQty}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md bg-white dark:bg-gray-700 shadow-sm text-lg hover:bg-gray-50 dark:hover:bg-gray-600" onClick={() => updateQty(item.id, 1)}>
              +
            </Button>
          </div>
          <div className="flex-1 text-right">
            <span className="font-bold text-gray-900 dark:text-gray-100">
              {formatPrice(item.cartPrice * item.cartQty, item.currency || 'USD')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
