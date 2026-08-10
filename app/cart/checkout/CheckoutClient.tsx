"use client"

import React, { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { getCartItems, clearCart, CartMode } from "@/app/commerce/cart-storage"
import { CheckoutLine } from "@/app/commerce/checkout"
import { checkoutCartRequest, createStripeOrderCheckout } from "@/app/commerce/checkout-client"
import { toast } from "sonner"
import { ArrowLeft, User } from "@/app/components/ui/icons"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { CheckoutForm } from "./CheckoutForm"
import { OrderSummary } from "./OrderSummary"
import { Button } from "@/app/components/ui/button"
import { 
  getItemDeliveryOptions, 
  intersectDeliveryOptions, 
  defaultFulfillment,
  intersectPickupLocationIds,
  resolveOrderShippingCost,
  CheckoutFulfillmentMethod
} from "@/app/commerce/delivery-options"
import { getAvailablePaymentMethods, PaymentMethodType, getItemPaymentOptions, intersectPaymentOptions } from "@/app/commerce/payment-options"
import { listPublicLocations } from "@/app/inventory/actions"
import { getSiteInfoBySlug } from "@/app/book/actions"
import { isBusinessOpen, getNextOpenSlot } from "@/app/commerce/business-hours"
import { evaluateLocationRestrictions } from "@/app/commerce/location-restrictions"
import { formatDeliveryTime } from "@/app/commerce/delivery-time"
import { getBuyerGeoApprox, BuyerGeo } from "@/app/commerce/buyer-geo"

export default function CheckoutClient({
  buyerGeo
}: {
  buyerGeo?: BuyerGeo
} = {}) {
  const { t, locale } = useLocalization()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const session = user ? { user } : null

  // URL Params
  const source = searchParams?.get('source') || 'marketplace'
  const siteId = searchParams?.get('siteId')
  const returnTo = searchParams?.get('returnTo') || (source === 'shop' && siteId ? `/shop/${siteId}` : '/marketplace')
  const mode = (searchParams?.get('mode') as CartMode) || 'cart'
  const initialOwnerSiteId = searchParams?.get('ownerSiteId')

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [ownerSiteId, setOwnerSiteId] = useState<string | null>(initialOwnerSiteId)
  
  const [siteSettings, setSiteSettings] = useState<any>(null)
  
  // Contact info
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  
  // Shipping info
  const [fulfillment, setFulfillment] = useState<'pickup' | 'ship' | 'none' | 'dine_in'>('none')
  const [shippingAddress, setShippingAddress] = useState({ line1: "", line2: "", city: "", state: "", zip: "", country: "" })
  const [locations, setLocations] = useState<any[]>([])
  const [pickupLocationId, setPickupLocationId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType | ''>('')
  const [promotionCode, setPromotionCode] = useState("")
  const [promoDiscount, setPromoDiscount] = useState(0)

  // Order Timing
  const [orderTiming, setOrderTiming] = useState<'now' | 'scheduled'>('now')
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null)

  const businessHours = siteSettings?.business_hours || []
  const isOpen = businessHours.length > 0 ? isBusinessOpen(businessHours) : true
  const nextOpenSlot = !isOpen ? getNextOpenSlot(businessHours, new Date(), locale) : null

  const allowedOptions = React.useMemo(() => {
    return intersectDeliveryOptions(items.map((i: any) => ({
      allowed: getItemDeliveryOptions(i, siteSettings?.shop?.default_delivery_options)
    })))
  }, [items, siteSettings]);

  const allowedLocationIds = React.useMemo(() => {
    return intersectPickupLocationIds(items)
  }, [items])

  const allowedPaymentOptions = React.useMemo(() => {
    return intersectPaymentOptions(items.map((i: any) => ({
      allowed: getItemPaymentOptions(i, siteSettings?.shop?.payment_methods)
    })))
  }, [items, siteSettings])

  const availablePaymentMethods = React.useMemo(() => {
    return getAvailablePaymentMethods(fulfillment, allowedPaymentOptions)
  }, [fulfillment, allowedPaymentOptions])

  useEffect(() => {
    if (availablePaymentMethods.length > 0 && (!paymentMethod || !availablePaymentMethods.includes(paymentMethod as PaymentMethodType))) {
      setPaymentMethod(availablePaymentMethods[0]);
    } else if (availablePaymentMethods.length === 0) {
      setPaymentMethod('');
    }
  }, [availablePaymentMethods, paymentMethod, setPaymentMethod]);

  useEffect(() => {
    let currentSiteId = siteId;
    if (source === 'marketplace' && items.length > 0) {
      const uniqueSiteIds = Array.from(new Set(items.map(c => c.site_id)))
      if (uniqueSiteIds.length > 0) {
        currentSiteId = uniqueSiteIds[0];
      }
    }
    
    if (currentSiteId) {
      // Public storefront path (service role) — buyers are not site members, so RLS blocks listLocations
      listPublicLocations(currentSiteId).then(res => {
        let availableLocations = (res.data || []).filter((l: any) => l.is_active !== false);
        if (allowedLocationIds) {
          availableLocations = availableLocations.filter((l: any) => allowedLocationIds.includes(l.id));
        }
        setLocations(availableLocations);
        if (availableLocations.length > 0) {
          const defaultLoc = availableLocations.find((l: any) => l.is_default) || availableLocations[0];
          setPickupLocationId(defaultLoc.id);
        } else {
          setPickupLocationId("");
        }
      }).catch(console.error);

      // Load site settings (for shop policies)
      getSiteInfoBySlug(currentSiteId).then(site => {
        if (site && site.settings) {
          setSiteSettings(site.settings)
        }
      }).catch(console.error);
    }
  }, [siteId, source, items, allowedLocationIds]);

  useEffect(() => {
    if (allowedOptions.length > 0 && !allowedOptions.includes(fulfillment)) {
      setFulfillment(defaultFulfillment(allowedOptions) || 'none');
    }
  }, [allowedOptions, fulfillment, setFulfillment]);

  useEffect(() => {
    if (session?.user && !customerEmail) {
      setCustomerEmail(session.user.email || "")
      setCustomerName(session.user.user_metadata?.name || "")
    }
  }, [session])

  useEffect(() => {
    const loadedItems = getCartItems(mode, source, siteId)
    setItems(loadedItems)
    setLoading(false)
  }, [mode, source, siteId])

  const subtotal = items.reduce((sum, item) => sum + (item.cartPrice * item.cartQty), 0)

  const shippingCost = React.useMemo(() => {
    return resolveOrderShippingCost(
      fulfillment,
      subtotal,
      siteSettings?.shop?.free_shipping_threshold,
      siteSettings?.shop?.shipping_cost,
      items
    )
  }, [fulfillment, subtotal, siteSettings, items])
  const payableTotal = Math.max(0, subtotal - promoDiscount + shippingCost)

  const requiresAuth = items.some(item => item.kind === 'digital_asset' || item.is_recurring)

  const resolvedCheckoutSiteId = (() => {
    if (source === 'marketplace' && items.length > 0) {
      return items[0]?.site_id || siteId || undefined
    }
    return siteId || undefined
  })()

  const isLocationAvailable = React.useMemo(() => {
    if (!siteSettings?.locations || siteSettings.locations.length === 0) return true;
    
    // If we have a filled shipping address, use it
    if (fulfillment === 'ship' && shippingAddress.city && shippingAddress.zip) {
      return evaluateLocationRestrictions(siteSettings.locations, shippingAddress).available;
    }
    
    // Otherwise fallback to buyer geo (IP)
    if (buyerGeo) {
      return evaluateLocationRestrictions(siteSettings.locations, buyerGeo).available;
    }
    
    return true;
  }, [siteSettings, shippingAddress, fulfillment, buyerGeo]);

  const deliveryTimeLabel = formatDeliveryTime(siteSettings?.shop);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isLocationAvailable) {
      toast.error(t('checkout.unavailableLocation') || 'Service is not available in your area.');
      return;
    }

    if (orderTiming === 'scheduled' && !scheduledFor) {
      toast.error(t('checkout.selectTimeRequired') || 'Please select a date and time for your order.');
      return;
    }

    if (orderTiming === 'now' && !isOpen) {
      const confirmed = window.confirm(
        nextOpenSlot?.label
          ? (t('checkout.storeClosedConfirm', { time: nextOpenSlot.label }) ||
            `The store is currently closed. Your order will be processed ${nextOpenSlot.label}. Do you want to continue?`)
          : (t('checkout.storeClosedConfirmGeneric') ||
            'The store is currently closed. Your order will be processed when it opens. Do you want to continue?')
      );
      if (!confirmed) return;
    }
    
    const finalScheduledFor = orderTiming === 'scheduled' ? scheduledFor?.toISOString() : 
                              (orderTiming === 'now' && !isOpen && nextOpenSlot ? nextOpenSlot.at.toISOString() : undefined);

    if (items.length === 0) return

    if (requiresAuth && !session?.user) {
      toast.error(t("checkout.identity.signInToAccess") || "Please sign in to purchase digital items or subscriptions.")
      return
    }

    const resolvedName =
      customerName ||
      session?.user?.user_metadata?.name ||
      session?.user?.user_metadata?.full_name ||
      session?.user?.email ||
      ""
    const resolvedEmail = customerEmail || session?.user?.email || ""

    if (!resolvedName || !resolvedEmail) {
      toast.error("Please enter your name and email")
      return
    }

    if (source === 'shop' && fulfillment === 'ship' && (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.zip)) {
      toast.error("Please enter a complete shipping address")
      return
    }

    setCheckoutLoading(true)
    let redirectingToStripe = false

    // For marketplace, ensure we only have one seller
    let checkoutSiteId = siteId
    if (source === 'marketplace') {
      const uniqueSiteIds = Array.from(new Set(items.map(c => c.site_id)))
      if (uniqueSiteIds.length > 1) {
        toast.error("V1 only supports checking out from one seller at a time.")
        setCheckoutLoading(false)
        return
      }
      checkoutSiteId = uniqueSiteIds[0]
    }

    // Ensure cart only has one currency
    const uniqueCurrencies = Array.from(new Set(items.map(c => c.currency || 'USD')))
    if (uniqueCurrencies.length > 1) {
      toast.error("All items in the cart must use the same currency.")
      setCheckoutLoading(false)
      return
    }

    if (!checkoutSiteId) {
      toast.error("Missing seller information.")
      setCheckoutLoading(false)
      return
    }

    if (!paymentMethod) {
      toast.error("Please select a payment method.")
      setCheckoutLoading(false)
      return
    }

    try {
      const lines: CheckoutLine[] = items.map(c => ({
        catalogItemId: c.id,
        quantity: c.cartQty,
        reservationStart: c.reservationStart,
        reservationEnd: c.reservationEnd
      }))

      const res = await checkoutCartRequest({
        siteId: checkoutSiteId,
        lines,
        customerName: resolvedName,
        customerEmail: resolvedEmail,
        buyerUserId: session?.user?.id,
        ownerSiteId,
        fulfillment,
        originLocationId: (fulfillment === 'pickup' || fulfillment === 'dine_in') ? pickupLocationId : undefined,
        shippingAddress: fulfillment === 'ship' ? shippingAddress : undefined,
        promotionCode: promotionCode || undefined,
        scheduledFor: finalScheduledFor,
        source: source as 'shop' | 'marketplace',
        paymentMethod: paymentMethod === 'cash_on_pickup' ? 'cash' : paymentMethod === 'bank_transfer' ? 'bank_transfer' : undefined,
        intent: payableTotal === 0 ? 'complete' : (paymentMethod === 'cash_on_pickup' || paymentMethod === 'bank_transfer' ? 'send' : 'draft')
      })

      if (res.error) {
        toast.error(res.error)
        return
      }

      if (payableTotal > 0 && paymentMethod === 'card') {
        const stripeData = await createStripeOrderCheckout({
          orderId: res.orderId!,
          siteId: checkoutSiteId,
          returnUrl: window.location.origin + returnTo
        })
        if (stripeData.url) {
          if (mode === 'buynow') clearCart(mode, source, siteId)
          redirectingToStripe = true
          window.location.href = stripeData.url
          return
        }
        toast.error(stripeData.error || "Failed to initiate payment")
        return
      }

      clearCart(mode, source, siteId)
      const payParam = paymentMethod === 'bank_transfer' ? '&pay=bank_transfer' : ''
      router.push(`${returnTo}${returnTo.includes('?') ? '&' : '?'}success=true${payParam}`)
    } catch (e: any) {
      console.error('Checkout failed:', e)
      toast.error(e?.message || "Checkout failed. Please try again.")
    } finally {
      if (!redirectingToStripe) {
        setCheckoutLoading(false)
      }
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-muted/30 flex items-center justify-center">Loading checkout...</div>
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <div className="h-4 w-full shrink-0" />
        <CommerceShellHeader
          brand={
            <Link href={returnTo} className="flex items-center text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">{t('checkout.backToStore') || 'Return to store'}</span>
            </Link>
          }
          actions={<div />}
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Checkout empty</h2>
            <p className="text-muted-foreground mb-6">You don't have any items to checkout.</p>
            <Link href={returnTo}>
              <Button size="lg" className="rounded-xl">Continue Shopping</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        brand={
          <Link href={returnTo} className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="font-medium">{t('checkout.backToStore') || 'Back to store'}</span>
          </Link>
        }
        center={
          <span className="font-black text-xl tracking-tight uppercase">{t('checkout.title') || 'CHECKOUT'}</span>
        }
        actions={
          <>
            {session ? (
              <div className="flex items-center gap-2 shrink-0">
                {session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture ? (
                  <img 
                    src={session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture} 
                    alt="Avatar" 
                    className="w-8 h-8 min-w-8 rounded-full object-cover border border-border shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 min-w-8 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={`/auth?returnTo=${encodeURIComponent(
                  `/cart/checkout?${new URLSearchParams({
                    ...(source ? { source } : {}),
                    ...(siteId ? { siteId } : {}),
                    ...(mode ? { mode } : {}),
                    ...(initialOwnerSiteId ? { ownerSiteId: initialOwnerSiteId } : {}),
                    ...(returnTo ? { returnTo } : {}),
                  }).toString()}`
                )}`}
                className={shellClasses.primaryCta}
              >
                {t('shop.signIn') || 'Sign In'}
              </Link>
            )}
          </>
        }
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 max-w-[1400px] mx-auto">
          
          <div className="lg:col-span-7 xl:col-span-8 order-1">
            <div className="bg-card border border-border/50 rounded-3xl p-6 lg:p-10 shadow-sm relative overflow-hidden">
              <CheckoutForm 
                session={session}
                requiresAuth={requiresAuth}
                source={source}
                fulfillment={fulfillment}
                setFulfillment={setFulfillment}
                allowedOptions={allowedOptions}
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerEmail={customerEmail}
                setCustomerEmail={setCustomerEmail}
                shippingAddress={shippingAddress}
                setShippingAddress={setShippingAddress}
                ownerSiteId={ownerSiteId}
                setOwnerSiteId={setOwnerSiteId}
                handleCheckout={handleCheckout}
                lockedDestination={!!initialOwnerSiteId}
                locations={locations}
                pickupLocationId={pickupLocationId}
                setPickupLocationId={setPickupLocationId}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                availablePaymentMethods={availablePaymentMethods}
                orderTiming={orderTiming}
                setOrderTiming={setOrderTiming}
                scheduledFor={scheduledFor}
                setScheduledFor={setScheduledFor}
                businessHours={businessHours}
                isOpen={isOpen}
                nextOpenSlot={nextOpenSlot}
                deliveryTimeLabel={deliveryTimeLabel}
              />
            </div>
          </div>

          <div className="lg:col-span-5 xl:col-span-4 order-2">
            <OrderSummary 
              items={items}
              subtotal={subtotal}
              shippingCost={shippingCost}
              checkoutLoading={checkoutLoading}
              disabledReason={
                !isLocationAvailable
                  ? t("checkout.unavailableLocation") || "Service is not available in your area"
                  : (orderTiming === 'scheduled' && !scheduledFor)
                    ? t("checkout.selectTimeRequired") || "Please select a date and time"
                    : !allowedOptions.includes(fulfillment) 
                      ? "Selected delivery method not allowed"
                      : (!paymentMethod || !availablePaymentMethods.includes(paymentMethod))
                        ? "Payment method not allowed"
                        : undefined
              }
              fulfillment={fulfillment}
              paymentMethod={paymentMethod}
              siteId={resolvedCheckoutSiteId}
              buyerUserId={session?.user?.id}
              promotionCode={promotionCode}
              setPromotionCode={setPromotionCode}
              promoDiscount={promoDiscount}
              setPromoDiscount={setPromoDiscount}
            />
          </div>
          
        </div>
      </main>

      {/* Footer */}
      {source === 'shop' ? (
        <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-2xl font-black tracking-tight text-gray-400 dark:text-gray-600">{items[0]?.site?.name || 'Store'}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} {items[0]?.site?.name || 'Store'}. All rights reserved. Powered by Uncodie.
            </div>
          </div>
        </footer>
      ) : (
        <footer className="bg-card border-t py-12 mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-2xl font-black tracking-tight text-muted-foreground">Makinri</div>
            <div className="text-sm text-muted-foreground font-medium">
              &copy; {new Date().getFullYear()} Makinri. All rights reserved.
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
