import React, { useMemo, useEffect, useState, useCallback } from "react"
import { ShoppingCart, ShieldCheck } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { CartCheckoutFields } from "@/app/components/commerce/CartCheckoutFields"
import { CartItem } from "@/app/components/commerce/CartItem"
import { PromoCodeField, AppliedPromo } from "@/app/components/commerce/PromoCodeField"
import { 
  getItemDeliveryOptions, 
  intersectDeliveryOptions, 
  hasMixedCartShippingWarning,
  defaultFulfillment,
  intersectPickupLocationIds,
  resolveOrderShippingCost
} from "@/app/commerce/delivery-options"
import { resolveCheckoutCopyMode, checkoutLabelKey } from "@/app/commerce/checkout-labels"
import { 
  getItemPaymentOptions, 
  intersectPaymentOptions, 
  getAvailablePaymentMethods,
  PaymentMethodType
} from "@/app/commerce/payment-options"
import { CheckoutIdentityPicker } from "@/app/components/commerce/CheckoutIdentityPicker"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

export function CartSidebar({
  cart, subtotal, updateQty,
  session,
  customerName, setCustomerName,
  customerEmail, setCustomerEmail,
  fulfillment, setFulfillment,
  originLocationId, setOriginLocationId,
  locations = [],
  promotionCode, setPromotionCode,
  promoDiscount = 0,
  setPromoDiscount,
  shippingAddress, setShippingAddress,
  ownerSiteId, setOwnerSiteId,
  paymentMethod, setPaymentMethod,
  orderTiming, setOrderTiming,
  scheduledFor, setScheduledFor,
  orderNotes, setOrderNotes,
  isOpen, nextOpenSlot, locationAvailable, deliveryTimeLabel,
  handleCheckout, checkoutLoading, closeCart, site
}: any) {
  
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)

  const copyMode = resolveCheckoutCopyMode(cart)

  const allowedOptions = useMemo(() => {
    return intersectDeliveryOptions(cart.map((i: any) => ({
      allowed: getItemDeliveryOptions(i, site?.settings?.shop?.default_delivery_options)
    })))
  }, [cart, site]);

  const showMixedCartWarning = useMemo(() => {
    return hasMixedCartShippingWarning(cart.map((i: any) => ({
      allowed: getItemDeliveryOptions(i, site?.settings?.shop?.default_delivery_options)
    })));
  }, [cart, site]);

  const allowedPaymentOptions = useMemo(() => {
    return intersectPaymentOptions(cart.map((i: any) => ({
      allowed: getItemPaymentOptions(i, site?.settings?.shop?.payment_methods)
    })))
  }, [cart, site])

  const availablePaymentMethods = useMemo(() => {
    return getAvailablePaymentMethods(fulfillment, allowedPaymentOptions, cart)
  }, [fulfillment, allowedPaymentOptions, cart])

  const pickupLocations = useMemo(() => {
    const restriction = intersectPickupLocationIds(cart);
    const active = (locations || []).filter((l: any) => l.is_active !== false);
    if (restriction === null) return active;
    return active.filter((l: any) => restriction.includes(l.id));
  }, [cart, locations]);

  const requiresAuth = cart.some((c: any) => c.kind === 'digital_asset' || c.is_recurring)
  const isPurelyReservableOrDigital = cart.length > 0 && cart.every((c: any) => c.is_reservation || c.kind === 'digital_asset')

  const promoCartLines = useMemo(() => {
    return cart.map((item: any) => {
      const modTotal = (item.modifiers || []).reduce(
        (s: number, m: any) =>
          s + Number(m.cartPrice || 0) * Number(m.cartQty || 0),
        0,
      )
      const unit = (item.cartPrice ?? item.target_sale_price ?? 0) + modTotal
      return {
        catalogItemId: item.id,
        subtotal: unit * (item.cartQty || 1),
        quantity: item.cartQty || 1,
      }
    })
  }, [cart])

  const discount = appliedPromo?.discount ?? promoDiscount ?? 0

  const shippingCost = useMemo(() => {
    return resolveOrderShippingCost(
      fulfillment,
      subtotal,
      site?.settings?.shop?.free_shipping_threshold,
      site?.settings?.shop?.shipping_cost,
      cart
    )
  }, [fulfillment, subtotal, site, cart])

  const payableTotal = Math.max(0, subtotal - discount + shippingCost)
  const currency = cart[0]?.currency || 'USD'

  const handleApplied = useCallback((promo: AppliedPromo) => {
    setAppliedPromo(promo)
    setPromotionCode(promo.code)
    setPromoDiscount?.(promo.discount)
  }, [setPromotionCode, setPromoDiscount])

  const handleCleared = useCallback(() => {
    setAppliedPromo(null)
    setPromoDiscount?.(0)
  }, [setPromoDiscount])

  useEffect(() => {
    if (allowedOptions.length > 0 && !allowedOptions.includes(fulfillment)) {
      setFulfillment(defaultFulfillment(allowedOptions) || 'none');
    }
  }, [allowedOptions, fulfillment, setFulfillment]);

  useEffect(() => {
    if (availablePaymentMethods.length > 0 && (!paymentMethod || !availablePaymentMethods.includes(paymentMethod as PaymentMethodType))) {
      setPaymentMethod(availablePaymentMethods[0]);
    } else if (availablePaymentMethods.length === 0) {
      setPaymentMethod('');
    }
  }, [availablePaymentMethods, paymentMethod, setPaymentMethod]);

  useEffect(() => {
    if (fulfillment !== 'pickup' && fulfillment !== 'dine_in') return;
    if (pickupLocations.length === 0) return;
    if (!pickupLocations.some((l: any) => l.id === originLocationId)) {
      setOriginLocationId(pickupLocations[0].id);
    }
  }, [fulfillment, pickupLocations, originLocationId, setOriginLocationId]);

  return (
    <div className="flex flex-col h-full bg-gray-50/30 dark:bg-gray-950">
      <div className="px-6 py-5 flex items-center gap-3 border-b dark:border-gray-800 bg-white dark:bg-gray-950 pr-12">
        <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100 tracking-tight">{t('shop.cart.title') || 'Your Cart'}</h2>
        <span className="text-gray-500 text-sm font-medium bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 rounded-full">{cart.length} {t('shop.cart.items') || 'items'}</span>
      </div>
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-6">
            <ShoppingCart className="h-16 w-16 opacity-20" />
            <div className="text-center">
              <p className="text-xl font-semibold text-gray-900 mb-2">{t('shop.cart.emptyTitle') || 'Your cart is empty'}</p>
              <p className="text-sm">{t('shop.cart.emptyDesc') || "Looks like you haven't added anything yet."}</p>
            </div>
            <Button variant="outline" className="mt-4 rounded-xl hover:text-black dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white dark:border-gray-700" onClick={closeCart}>
              {t('shop.cart.continueShopping') || 'Continue Shopping'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {cart.map((item: any) => (
                <CartItem 
                  key={item.lineKey || item.id} 
                  item={item} 
                  updateQty={updateQty} 
                  showSeller={false} 
                />
              ))}
            </div>
            
            <form id="checkout-form" onSubmit={handleCheckout} className="space-y-5 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="font-bold text-lg border-b dark:border-gray-800 pb-3">{t(checkoutLabelKey('shop.cart.contactShipping', copyMode)) || 'Contact & Shipping'}</h3>
              
              <div className="space-y-4 pt-2">
                <CheckoutIdentityPicker
                  session={session}
                  requiresAuth={requiresAuth}
                  customerName={customerName}
                  setCustomerName={setCustomerName}
                  customerEmail={customerEmail}
                  setCustomerEmail={setCustomerEmail}
                  ownerSiteId={ownerSiteId}
                  setOwnerSiteId={setOwnerSiteId}
                />

                <CartCheckoutFields 
                  allowedOptions={allowedOptions}
                  fulfillment={fulfillment}
                  setFulfillment={setFulfillment}
                  pickupLocations={pickupLocations}
                  originLocationId={originLocationId}
                  setOriginLocationId={setOriginLocationId}
                  shippingAddress={shippingAddress}
                  setShippingAddress={setShippingAddress}
                  availablePaymentMethods={availablePaymentMethods}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  orderTiming={isPurelyReservableOrDigital ? undefined : orderTiming}
                  setOrderTiming={isPurelyReservableOrDigital ? undefined : setOrderTiming}
                  scheduledFor={scheduledFor}
                  setScheduledFor={setScheduledFor}
                  isOpen={isOpen}
                  nextOpenSlot={nextOpenSlot}
                  deliveryTimeLabel={deliveryTimeLabel}
                  notes={orderNotes}
                  setNotes={setOrderNotes}
                  t={t}
                  copyMode={copyMode}
                  showMixedCartWarning={showMixedCartWarning}
                />
              </div>
            </form>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
              <PromoCodeField
                siteId={site.id}
                code={promotionCode}
                setCode={setPromotionCode}
                cartLines={promoCartLines}
                buyerUserId={session?.user?.id}
                source="shop"
                applied={appliedPromo}
                onApplied={handleApplied}
                onCleared={handleCleared}
              />

              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400 pt-2">
                <span>{t('shop.cart.subtotal') || 'Subtotal'}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatPrice(subtotal, currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                  <span>{t('checkout.discount') || 'Discount'}</span>
                  <span className="font-medium">-{formatPrice(discount, currency)}</span>
                </div>
              )}
              {fulfillment === 'ship' && (
                <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                  <span>{t('shop.cart.shipping') || 'Shipping'}</span>
                  {shippingCost === 0 ? (
                    <span className="font-medium text-green-600 dark:text-green-400">{t('shop.cart.free') || 'Free'}</span>
                  ) : (
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatPrice(shippingCost, currency)}</span>
                  )}
                </div>
              )}
              <div className="pt-3 border-t dark:border-gray-800 flex justify-between items-center">
                <span className="font-bold text-lg">{t('shop.cart.total') || 'Total'}</span>
                <span className="font-black text-2xl text-gray-900 dark:text-gray-100">{formatPrice(payableTotal, currency)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-white dark:bg-gray-950 border-t dark:border-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-none">
        <Button 
          type="submit"
          form="checkout-form"
          className="w-full h-14 text-lg font-bold rounded-xl" 
          disabled={cart.length === 0 || checkoutLoading || allowedOptions.length === 0 || ((fulfillment === 'pickup' || fulfillment === 'dine_in') && pickupLocations.length === 0) || !paymentMethod || !locationAvailable || (!isPurelyReservableOrDigital && orderTiming === 'scheduled' && !scheduledFor)}
        >
          {checkoutLoading
            ? (t('shop.cart.processing') || "Processing securely...")
            : paymentMethod === 'cash_on_pickup'
              ? (t(checkoutLabelKey('checkout.placeOrderCash', copyMode)) || 'Place order • Pay at store')
              : paymentMethod === 'bank_transfer'
                ? (t('checkout.placeOrderTransfer') || 'Place order • Pay by transfer')
                : (t('checkout.paySecurely') || 'Pay securely')}
        </Button>
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400 font-medium">
          <ShieldCheck className="h-4 w-4" />
          {t('shop.cart.secureCheckout') || 'Secure checkout powered by Stripe'}
        </div>
      </div>
    </div>
  )
}
