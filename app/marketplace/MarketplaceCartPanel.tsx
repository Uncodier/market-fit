import React, { useMemo, useEffect } from "react"
import { ShoppingCart, ShieldCheck, X } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { CheckoutIdentityPicker } from "@/app/components/commerce/CheckoutIdentityPicker"
import { CartCheckoutFields } from "@/app/components/commerce/CartCheckoutFields"
import { CartItem } from "@/app/components/commerce/CartItem"
import { 
  getItemDeliveryOptions, 
  intersectDeliveryOptions, 
  defaultFulfillment,
  intersectPickupLocationIds
} from "@/app/commerce/delivery-options"
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
  siteSettings,
  handleCheckout,
  checkoutLoading,
  setIsCartOpen,
  t
}: any) {
  const { formatPrice } = useDisplayCurrency()
  
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

  const pickupLocations = useMemo(() => {
    const restriction = intersectPickupLocationIds(cart);
    const active = (locations || []).filter((l: any) => l.is_active !== false);
    if (restriction === null) return active;
    return active.filter((l: any) => restriction.includes(l.id));
  }, [cart, locations]);

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
    if (fulfillment !== 'pickup') return;
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
                  key={item.id} 
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
                  t={t}
                />
              </form>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-6 border-t bg-card">
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-lg">{t('marketplace.cart.total') || 'Total'}</span>
              <span className="font-black text-2xl">{formatPrice(subtotal, cart[0]?.currency || 'USD')}</span>
            </div>
            <Button 
              type="submit"
              form="marketplace-checkout"
              className="w-full h-14 text-lg font-bold rounded-xl" 
              disabled={checkoutLoading || allowedOptions.length === 0 || (fulfillment === 'pickup' && pickupLocations.length === 0) || !paymentMethod}
            >
              {checkoutLoading ? (t('marketplace.checkout.processing') || "Processing securely...") : `${t('marketplace.checkout.btn') || 'Checkout'} • ${formatPrice(subtotal, cart[0]?.currency || 'USD')}`}
            </Button>
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground font-medium">
              <ShieldCheck className="h-4 w-4" />
              {t('marketplace.checkout.secure') || 'Secure checkout powered by Stripe'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
