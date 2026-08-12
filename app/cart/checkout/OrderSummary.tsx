"use client"

import { useState, useCallback, useMemo } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { ShieldCheck } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { PromoCodeField, AppliedPromo } from "@/app/components/commerce/PromoCodeField"
import { checkoutLabelKey, CheckoutCopyMode } from "@/app/commerce/checkout-labels"
import { cartLineExtendedTotal } from "@/app/commerce/cart-modifiers"

interface OrderSummaryProps {
  items: any[]
  subtotal: number
  shippingCost?: number
  checkoutLoading: boolean
  disabledReason?: string
  fulfillment?: string
  paymentMethod?: string
  siteId?: string
  buyerUserId?: string | null
  source?: string | null
  locationId?: string | null
  promotionCode: string
  setPromotionCode: (val: string) => void
  promoDiscount: number
  setPromoDiscount: (val: number) => void
  copyMode?: CheckoutCopyMode
}

export function OrderSummary({
  items,
  subtotal,
  shippingCost = 0,
  checkoutLoading,
  disabledReason,
  fulfillment,
  paymentMethod,
  siteId,
  buyerUserId,
  source,
  locationId,
  promotionCode,
  setPromotionCode,
  promoDiscount,
  setPromoDiscount,
  copyMode = 'retail'
}: OrderSummaryProps) {
  const { t } = useLocalization()
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const currency = items[0]?.currency || 'USD'
  const discount = appliedPromo?.discount ?? promoDiscount ?? 0
  const payableTotal = Math.max(0, subtotal - discount + shippingCost)

  const promoCartLines = useMemo(() => {
    return items.map((item: any) => ({
      catalogItemId: item.id,
      subtotal: cartLineExtendedTotal(item),
      quantity: item.cartQty || 1,
    }))
  }, [items])

  const handleApplied = useCallback((promo: AppliedPromo) => {
    setAppliedPromo(promo)
    setPromotionCode(promo.code)
    setPromoDiscount(promo.discount)
  }, [setPromotionCode, setPromoDiscount])

  const handleCleared = useCallback(() => {
    setAppliedPromo(null)
    setPromoDiscount(0)
  }, [setPromoDiscount])

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  return (
    <div className="bg-card border border-border/50 rounded-3xl p-6 lg:p-8 shadow-sm lg:sticky lg:top-32 relative overflow-hidden">
      <h2 className="text-xl font-bold mb-6">{t('checkout.orderSummary') || 'Order Summary'}</h2>
      
      <div className="space-y-4 mb-8 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
        {items.map((item, idx) => (
          <div key={(item.lineKey || item.id) + idx} className="flex gap-4 p-3 bg-muted/30 rounded-2xl border border-border/40">
            <div className="relative w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0 shadow-sm border border-border/50">
              <img src={resolveItemImage(item)} alt={item.name} className="absolute inset-0 h-full w-full object-cover object-center" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h4 className="font-bold truncate text-sm">{item.name}</h4>
              <div className="text-xs text-muted-foreground mt-1 font-medium tracking-wide">{t('qty') || 'QTY:'} {item.cartQty}</div>
              {Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {item.modifiers.map((m: any) => (
                    <li key={`${m.groupId}:${m.catalogItemId}`} className="text-xs text-muted-foreground truncate">
                      + {m.name}{m.cartQty > 1 ? ` ×${m.cartQty}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="font-black text-sm flex items-center shrink-0">
              {formatMoney(cartLineExtendedTotal(item))}
            </div>
          </div>
        ))}
      </div>

      {siteId && (
        <div className="mb-6">
          <PromoCodeField
            siteId={siteId}
            code={promotionCode}
            setCode={setPromotionCode}
            cartLines={promoCartLines}
            buyerUserId={buyerUserId}
            source={source}
            locationId={locationId}
            applied={appliedPromo}
            onApplied={handleApplied}
            onCleared={handleCleared}
          />
        </div>
      )}

      <div className="space-y-3 pt-6 border-t mb-8">
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-muted-foreground">{t('subtotal') || 'Subtotal'}</span>
          <span>{formatMoney(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between items-center text-sm font-medium text-green-600 dark:text-green-400">
            <span>{t('checkout.discount') || 'Discount'}</span>
            <span>-{formatMoney(discount)}</span>
          </div>
        )}
        {fulfillment === 'ship' && (
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-muted-foreground">{t('checkout.shipping') || 'Shipping'}</span>
            <span className={shippingCost === 0 ? "text-green-600 dark:text-green-400" : ""}>
              {shippingCost === 0 ? (t('checkout.free') || 'Free') : formatMoney(shippingCost)}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-muted-foreground">{t('taxes') || 'Taxes'}</span>
          <span className="text-muted-foreground text-xs font-semibold">{t('checkout.calculatedAtNextStep') || 'Calculated at next step'}</span>
        </div>
        
        <div className="flex justify-between items-center text-sm font-medium pt-2 border-t mt-2">
          <span className="text-muted-foreground">{t('payment') || 'Payment'}</span>
          <span className="font-semibold text-right">
            {paymentMethod === 'cash_on_pickup' ? (
              <span className="text-emerald-600 dark:text-emerald-500">{t(checkoutLabelKey('checkout.cashOnPickup', copyMode)) || 'Cash — pay at store'}</span>
            ) : paymentMethod === 'bank_transfer' ? (
              <span className="text-indigo-600 dark:text-indigo-500">{t('checkout.bankTransfer') || 'Bank Transfer'}</span>
            ) : (
              <span>{t('checkout.cardStripe') || 'Card (Stripe)'}</span>
            )}
          </span>
        </div>

        <div className="flex justify-between items-center pt-4 mt-2 border-t">
          <span className="font-bold text-lg">{t('total') || 'Total'}</span>
          <span className="font-black text-2xl tracking-tight">{formatMoney(payableTotal)}</span>
        </div>
      </div>

      <Button 
        type="submit"
        form="checkout-form"
        className="w-full h-14 text-lg font-bold rounded-xl shadow-md transition-all active:scale-[0.98]" 
        disabled={checkoutLoading || items.length === 0 || !!disabledReason}
      >
        {checkoutLoading 
          ? (paymentMethod === 'cash_on_pickup' || paymentMethod === 'bank_transfer' ? (t('checkout.placingOrder') || "Placing order...") : (t('checkout.processing') || "Processing securely..."))
          : disabledReason 
            ? disabledReason 
            : paymentMethod === 'cash_on_pickup'
              ? `${t(checkoutLabelKey('checkout.placeOrderCash', copyMode)) || 'Place order • Pay at store'}`
              : paymentMethod === 'bank_transfer'
              ? `${t('checkout.placeOrderTransfer') || 'Place order • Pay by transfer'}`
              : (t('checkout.paySecurely') || 'Pay securely')
        }
      </Button>
      
      {paymentMethod !== 'cash_on_pickup' && paymentMethod !== 'bank_transfer' && (
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground font-semibold uppercase tracking-widest">
          <ShieldCheck className="h-4 w-4" />
          {t('checkout.secure') || 'Secure checkout powered by Stripe'}
        </div>
      )}
    </div>
  )
}
