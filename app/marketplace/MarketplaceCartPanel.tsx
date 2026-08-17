import React, { useMemo, useEffect, useState, useCallback } from "react"
import { ShoppingCart, ShieldCheck, X } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { CheckoutIdentityPicker } from "@/app/components/commerce/CheckoutIdentityPicker"
import { CartCheckoutFields } from "@/app/components/commerce/CartCheckoutFields"
import { CartItem } from "@/app/components/commerce/CartItem"
import { PromoCodeField, AppliedPromo } from "@/app/components/commerce/PromoCodeField"
import { 
  getItemDeliveryOptions, 
  intersectDeliveryOptions, 
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
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

export function MarketplaceCartPanel({
  cart,
  subtotal,
  updateQty,
  session,
  isLockedDestination,
  ownerSiteId,
  setOwnerSiteId,
  customerName,
  setCustomerName,
  customerEmail,
  setCustomerEmail,
  fulfillment,
  setFulfillment,
  originLocationId,
  setOriginLocationId,
  locations,
  shippingAddress,
  setShippingAddress,
  paymentMethod,
  setPaymentMethod,
  orderTiming,
  setOrderTiming,
  scheduledFor,
  setScheduledFor,
  orderNotes,
  setOrderNotes,
  isOpen,
  nextOpenSlot,
  locationAvailable,
  deliveryTimeLabel,
  promotionCode,
  setPromotionCode,
  promoDiscount = 0,
  setPromoDiscount,
  siteSettings,
  handleCheckout,
  checkoutLoading,
  setIsCartOpen,
  t
}: any) {
  const { formatPrice } = useDisplayCurrency()
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)

  const copyMode = resolveCheckoutCopyMode(cart)
  
  const allowedOptions = useMemo(() => {
    return intersectDeliveryOptions(cart.map((i: any) => ({
      allowed: getItemDeliveryOptions(i, siteSettings?.shop?.default_delivery_options)
    })))
  }, [cart, siteSettings]);

  const allowedPaymentOptions = useMemo(() => {
    return intersectPaymentOptions(cart.map((i: any) => ({
      allowed: getItemPaymentOptions(i, siteSettings?.shop?.payment_methods)
    })))
  }, [cart, siteSettings])

  const availablePaymentMethods = useMemo(() => {
    return getAvailablePaymentMethods(fulfillment, allowedPaymentOptions)
  }, [fulfillment, allowedPaymentOptions])

  const requiresAuth = cart.some((c: any) => c.kind === 'digital_asset' || c.is_recurring)
  const isPurelyReservableOrDigital = cart.length > 0 && cart.every((c: any) => c.is_reservation || c.kind === 'digital_asset')

  const pickupLocations = useMemo(() => {
    const restriction = intersectPickupLocationIds(cart);
    const active = (locations || []).filter((l: any) => l.is_active !== false);
    if (restriction === null) return active;
    return active.filter((l: any) => restriction.includes(l.id));
  }, [cart, locations]);

  const promoSiteId = cart[0]?.site_id || ""

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
      siteSettings?.shop?.free_shipping_threshold,
      siteSettings?.shop?.shipping_cost,
      cart
    )
  }, [fulfillment, subtotal, siteSettings, cart])

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
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm transition-all">
      <div className="w-full max-w-md bg-card shadow-2xl h-full flex flex-col border-l animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-black tracking-tight">{t('marketplace.cart.title') || 'Your Cart'}</h2>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsCartOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-2">
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-lg">{t('marketplace.cart.empty') || 'Your cart is empty'}</p>
              <Button variant="outline" className="rounded-full px-8" onClick={() => setIsCartOpen(false)}>
                {t('marketplace.cart.browse') || 'Browse Marketplace'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {cart.map((item: any) => (
                <CartItem 
                  key={item.lineKey || item.id} 
                  item={item} 
                  updateQty={updateQty} 
                  showSeller={true} 
                />
              ))}

              <form id="marketplace-checkout" onSubmit={handleCheckout} className="space-y-5 border-t pt-6">
                <h3 className="font-bold text-lg">{t('marketplace.checkout.title') || 'Checkout Details'}</h3>
                
                <CheckoutIdentityPicker
                  session={session}
                  requiresAuth={requiresAuth}
                  customerName={customerName}
                  setCustomerName={setCustomerName}
                  customerEmail={customerEmail}
                  setCustomerEmail={setCustomerEmail}
                  ownerSiteId={ownerSiteId}
                  setOwnerSiteId={setOwnerSiteId}
                  lockedDestination={isLockedDestination}
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
            />
              </form>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-6 border-t bg-card space-y-4">
            <PromoCodeField
              siteId={promoSiteId}
              code={promotionCode}
              setCode={setPromotionCode}
              cartLines={promoCartLines}
              buyerUserId={session?.user?.id}
              source="marketplace"
              applied={appliedPromo}
              onApplied={handleApplied}
              onCleared={handleCleared}
            />

            <div className="space-y-2">
              <div className="flex justify-between items-center text-muted-foreground text-sm">
                <span>{t('marketplace.cart.subtotal') || t('shop.cart.subtotal') || 'Subtotal'}</span>
                <span className="font-medium text-foreground">{formatPrice(subtotal, currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-green-600 dark:text-green-400 text-sm">
                  <span>{t('checkout.discount') || 'Discount'}</span>
                  <span className="font-medium">-{formatPrice(discount, currency)}</span>
                </div>
              )}
              {fulfillment === 'ship' && (
                <div className="flex justify-between items-center text-muted-foreground text-sm">
                  <span>{t('shop.cart.shipping') || 'Shipping'}</span>
                  <span className="font-medium text-foreground">
                    {shippingCost === 0 ? (t('shop.cart.free') || 'Free') : formatPrice(shippingCost, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">{t('marketplace.cart.total') || 'Total'}</span>
                <span className="font-black text-2xl">{formatPrice(payableTotal, currency)}</span>
              </div>
            </div>
            <Button 
              type="submit"
              form="marketplace-checkout"
              className="w-full h-14 text-lg font-bold rounded-xl" 
              disabled={checkoutLoading || allowedOptions.length === 0 || ((fulfillment === 'pickup' || fulfillment === 'dine_in') && pickupLocations.length === 0) || !paymentMethod || !locationAvailable || (!isPurelyReservableOrDigital && orderTiming === 'scheduled' && !scheduledFor)}
            >
              {checkoutLoading
                ? (t('marketplace.checkout.processing') || "Processing securely...")
                : paymentMethod === 'cash_on_pickup'
                  ? (t(checkoutLabelKey('checkout.placeOrderCash', copyMode)) || 'Place order • Pay at store')
                  : paymentMethod === 'bank_transfer'
                    ? (t('checkout.placeOrderTransfer') || 'Place order • Pay by transfer')
                    : (t('checkout.paySecurely') || 'Pay securely')}
            </Button>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium">
              <ShieldCheck className="h-4 w-4" />
              {t('marketplace.checkout.secure') || 'Secure checkout powered by Stripe'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
